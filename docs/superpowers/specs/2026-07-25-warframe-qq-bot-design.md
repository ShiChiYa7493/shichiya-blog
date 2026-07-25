# Warframe QQ 群机器人 设计文档

- 日期：2026-07-25
- 状态：设计已确认，待转实现计划
- 代码位置：`packages/wf-bot`（已跑通验证环境）

---

## 1. 目标

给 QQ 群提供一个 Warframe 工具机器人，群友用中文短命令查询游戏实时信息与市场价格，**所有回复以图片形式输出**。同时承载常规群务功能（签到、积分、欢迎、违规管理）。

不做主动推送——纯响应式，群友问一句答一句。

## 2. 范围

### v1 做

| 领域 | 内容 |
|---|---|
| Warframe 查询 | 裂缝（含钢铁/九重天）、平原周期、遗物、奸商、周常、灵化、赏金、1999 日历 |
| 市场查价 | wm 物品价格、紫卡订单、P 卡历史、周紫卡 |
| 输出形式 | 全部出图；图中嵌入物品/遗物/部件图像 |
| 命令触发 | 中文短命令 + 可组合过滤器 + **错字缺字容错** |
| 群务 | 签到 / 积分 / 排行榜 / 娱乐小功能 / 进群欢迎 / 退群提醒 / 违规管理 |

### v2 推迟

- **玩家数据查询**——无可用公开源（见 §3.4），架构上预留 provider 接口位
- **仲裁**——上游数据已损坏，现有插件自建了推算，先沿用其能力，不自研
- 渲染主题切换（`风格` 命令）

### 明确不做

- 定时主动推送 / 订阅。主动发消息是账号被风控的头号行为，且不做可省掉调度器与订阅存储。
- 进群欢迎、退群提醒虽然是"未经询问就发言"，但由事件触发，不需要调度器。

## 3. 数据源（2026-07-25 实测）

### 3.1 DE 官方 worldstate —— 主力源

```
GET https://api.warframe.com/cdn/worldState.php
```

一次请求返回 44 个字段、约 129KB，覆盖绝大多数查询命令。部署服务器实测 HTTP 200 / 1.7s。

已确认字段映射：

| 功能 | 原始字段 |
|---|---|
| 裂缝 | `ActiveMissions`（23 条）；九重天为 `VoidStorms` |
| 赏金 | `SyndicateMissions`（37 条） |
| 1999 日历 | `KnownCalendarSeasons` |
| 电波 | `SeasonInfo` |
| 突击 / 执行官 | `Sorties` / `LiteSorties` |
| 奸商 / 出库 | `VoidTraders` / `PrimeVaultTraders` |
| 入侵 / 警报 / 特惠 | `Invasions` / `Alerts` / `DailyDeals` |

**结论：二三十个命令背后只有一个 HTTP 请求。** 工作量在渲染模板，不在接口集成。

⚠️ **端点已搬家**。旧的 `content.warframe.com/dynamic/worldState.php` 现在返回 404，网上现存教程绝大多数仍在用它。当前正确地址是 `api.warframe.com/cdn/worldState.php`。

⚠️ 原始 worldstate 无任何中文，也无二次加工（节点是 `SolNodeXXX`，需自行映射）。解析交给 `warframe-worldstate-parser`（WFCD 官方库，插件已依赖）。

### 3.1b 为什么不用 warframestat.us

`api.warframestat.us` 是 DE 数据的社区二次封装，本机可用，但**部署服务器访问返回 HTTP 403**——Cloudflare WAF 按 IP/ASN 直接拦截（`Attention Required`，非 JS 挑战，无法靠改 UA 绕过）。`cdn.warframestat.us`（图片）同样 403。

所幸现有插件本就不依赖 warframestat，走的是 DE 原始源，因此该封禁**不影响主链路**。设计中任何新增功能也不得引入 warframestat 依赖。

### 3.1c 其他数据源

| 用途 | 地址 | 服务器实测 |
|---|---|---|
| 赏金轮换 | `https://oracle.browse.wf/bounty-cycle` | ✅ 200 / 1.5s |
| 热门紫卡排行 | `https://lab.webutilitykit.com/api/RivenTracker/hot-weapons` | ✅ 200 / 5.1s |
| 周紫卡参考价 | `https://docs.google.com/spreadsheets/d/1cdT…/export?format=csv` | ❌ **不通**（超时）→ **已决定砍掉该命令** |
| 仲裁 | 插件内置静态轮换表（`arbitrationSchedule`，`time,node` 对），本地推算 | ✅ 完全离线 |

**周紫卡功能在国内服务器上必然失败，已决定砍掉**（`riven-weekly` / `周紫卡` / `周卡` 命令在 fork 中移除或禁用）。若日后需要，可镜像该 CSV 到自有服务器定期同步。

### 3.2 warframe.market —— 市场价格

```
GET /v2/items                    3837 个物品，1.6MB，启动拉一次建索引
GET /v2/item/{slug}              单品详情
GET /v2/orders/item/{slug}/top   查价用这个
GET /v1/auctions/search?type=riven&...   紫卡（v2 无此端点）
```

关键事实：

- **v1 的 items 与 orders 已死**（`/v1/items` → 404，`/v1/items/{x}/orders` → 403 Deprecated）。网上现存教程绝大多数还在用 v1，照抄即死。
- **但 `/v1/auctions` 仍然活着**（HTTP 200），且 v2 没有 auctions 端点（404）。紫卡只能走 v1。
- 中文要用 **HTTP header** `Language: zh-hans` 传，query 参数无效。
- 返回的 `user.status` 有 `ingame` / `online` / `offline`。**查价必须过滤**，否则会报出两周前挂单的离线玩家价格。同理要按 `user.platform == pc` 过滤（返回里混有主机单，有 `crossplay` 字段）。
- MOD/赋能有等级（rank 0 vs 满级）、套装与单件是不同 slug，查价须明确这一维。

### 3.3 图片源

**只能用 warframe.market。**

```
https://warframe.market/static/assets/{i18n.<lang>.icon}     ~209KB   服务器实测 200 / 2.9s
```

- icon 路径藏在物品详情的 `i18n.zh-hans.icon`，形如 `items/images/en/wukong_prime_set.{hash}.png`。
- 路径**自带内容 hash**，内容变了文件名才变，因此可永久缓存。

⚠️ 原计划优先使用的 `cdn.warframestat.us/img/{imageName}`（约 73KB，体积仅三分之一）**在部署服务器上 403**，与 §3.1b 同一个 Cloudflare 封禁。只能退回 wm 图源，代价是单张图大三倍——这让 §5.5 的本地缓存从"重要"变成"必须"。

冷取一张约 2.9 秒。

### 3.4 玩家数据 —— 无源

```
content.warframe.com/PublicExport/…                     200   host 存活
content.warframe.com/dynamic/worldState.php             404
content.warframe.com/dynamic/getProfileViewingData.php  404   （试过 n/playerId/accountId）
api.warframestat.us/profile/{name}                      404
```

`getProfileViewingData.php` 是社区做玩家查询长期依赖的非官方端点，现已消失。DE 从未提供公开的玩家数据 API。

剩余路径只有第三方站（大概率同源同死）或登录态抓取（违反 ToS + 需在服务器存账号凭据）。**因此 v1 不做，架构预留接口位。**

### 3.5 中文映射

worldstate 侧的中文化成本极低：星球约 20 条、任务类型约 25 条、纪元 6 条、阵营 5 条，合计约 60 条硬编码映射即可。**节点名保留英文**（`赤毒要塞 - Taveuni`），452 个节点无需翻译。

物品名侧才是难点（3837 个物品 + 社区黑话），但已有现成方案，见 §4。

## 4. 技术选型

**Koishi 4.18.11（Node/TS）+ fork `koishi-plugin-warframe`。**

### 为什么不自研

实测 `koishi-plugin-warframe`（GPL-3.0，55 个版本，2026-07-21 仍在更新）已覆盖绝大部分需求：

| 沙盒实测 | 结果 |
|---|---|
| `钢铁裂缝` | ✅ 出图，纪元/星球/任务类型/阵营全中文，带等级区间与标红倒计时 |
| `wmi 猴p` | ✅ 出图，已按 `ingame` 过滤，附 7 天价格走势、90 天区间、成交笔数，并给出可复制的 `/w` 交易命令 |
| `遗物 后纪A2` | ✅ 出图，带掉率 / 金币值 / 平台价 |
| `扎里曼` | ⚠️ 有响应但**是纯文本，不是图** |
| `赏金` | ❌ 无此命令 |
| `钢铁裂逢`（错一字） | ❌ 无响应 |

它自带 65 个战甲的黑话别名表（`猴/鬼/奶妈/咖喱棒/轮椅/脑溢血`…），把本项目原本判定为"最大工作量"的中文黑话解析直接消化掉了。

### GPL-3.0 的实际约束

fork 自改自用完全没问题——GPL 只在**分发**时触发义务，QQ 群里给人用不算分发（这点与 AGPL 不同）。仅当把改过的版本发布到 npm/GitHub 时，须同样以 GPL-3.0 开源。

### 环境约束（已踩过的坑）

- **Node 22+**。`warframe-worldstate-data` 要求 `>=22`，`warframe-worldstate-parser` 要求 `^22.18 || >=24.11`。仓库内已放 `.nvmrc`。
- **不要装 `@koishijs/cli`**。它 npm 上的 latest 是陈旧的 4.10.10，依赖 cordis 2.x，会把顶层 cordis 拽成 2.10.3 与 koishi 的 3.18.1 冲突，启动时报一连串 `cordis`/`minato` 内部 TypeError。`koishi` 包自带 `bin`，直接 `koishi start` 即可。
- **registry 必须指向官方 npmjs**。公司私有源上 `warframe-public-export-plus` 停在 0.5.96，而插件要求 `^0.6.5`。项目内 `.npmrc` 已单独覆盖，不影响全局配置。
- `koishi-plugin-puppeteer` 依赖 `puppeteer-core` + `puppeteer-finder`，使用本机已装的 Chrome，不下载 Chromium。
- **`packages/wf-bot` 已排除在根 workspaces 之外**（根 `package.json` 改为显式列出 `frontend`/`server`），避免它的依赖与 registry 覆盖被 npm workspaces 提升后失效、进而搞坏 `npm run deploy`。

## 5. 架构

```
QQ 群
  │  群消息
  ▼
NapCat（第三方协议端，登录小号；官方渠道只推送 @机器人 的消息，
        做不了关键词触发，故必须走 OneBot 11）
  │  OneBot 11 事件（反向 WebSocket）
  ▼
┌──────────────── 单个 Koishi 实例 ────────────────┐
│  adapter-onebot     接入 / 重连 / 消息去重        │  框架内建
│  ┌────────────────────────────────────────────┐  │
│  │ ① 模糊触发中间件        ★ 自研核心          │  │
│  └────────────────────────────────────────────┘  │
│  ┌──────────────────┐  ┌──────────────────────┐  │
│  │ ② warframe (fork)│  │ ③ 群务插件组          │  │
│  │   数据 / 渲染     │  │   签到 积分 榜 欢迎   │  │
│  └────────┬─────────┘  └──────────────────────┘  │
│  ┌────────▼─────────┐                            │
│  │ ④ 图片缓存层 ★自研│                            │
│  └──────────────────┘                            │
│  puppeteer · 数据库 · 权限 · 冷却限流             │  框架内建
└──────────────────────────────────────────────────┘
```

群务与 Warframe 跑**同一个实例**（用户已确认）：省资源、共用一套用户体系。代价是二者故障互相牵连——Warframe 插件崩溃会连带影响签到。缓解手段见 §7。

### 5.1 模糊触发中间件（自研核心）

现有插件用的是精确别名，`钢铁裂逢`、`钢铁裂` 不命中。这是本项目最主要的自研内容。

以 Koishi 中间件形式挂在命令解析之前，把模糊输入归一化成插件已注册的命令名：

```
"钢铁裂逢"
 │
 ├─ L0 归一化    全角→半角、繁→简、去空格、大小写
 ├─ L1 精确匹配  命中已注册命令名/别名 → 原样放行，零成本
 ├─ L2 模糊匹配  拼音（全拼+首字母）+ 编辑距离 + 子串
 │               → 单一高分候选：改写消息后放行
 │               → 多个相近候选：回一句"你是指？1.钢铁裂缝 2.九重天裂缝"
 └─ L3 不命中    静默放行，交给后续中间件（绝不能吞掉正常聊天）
```

设计要点：

- **命令词表是封闭的几十个词**，可以做得很激进（容忍 1-2 字错漏）；这与物品名匹配是**两套**——物品名有 3837 条，同样激进会导致误匹配满天飞，那一侧交给插件已有的解析。
- 参考实现支持"无需空格"（`遗物后A2`），归一化时需要处理命令与参数粘连的切分。
- 未命中必须静默放行。群里正常聊天不能被 bot 插嘴。

### 5.2 Warframe 插件（fork）

fork `CloudeaSoft/koishi-plugin-warframe`，改动集中在三处：

1. **换皮**——渲染是 HTML + CSS + puppeteer（`src/components/render.tsx` 走 slot 模板注入 `assets/render.html` / `render.css` / `render-icons.svg`），改 CSS 与各 component 结构即可，不碰数据层。目标风格：深色、徽章化、高信息密度。
2. **补命令**——读过 fork 源码后修正（此前依据 npm README 的判断有误，该 README 滞后于 master）：

   - **赏金：已完整实现，无需新增。** `src/commands/index.ts` 里已注册 6 个地点命令
     （`bounty-cetus` / `fortuna` / `deimos` / `zariman` / `cavia` / `hex`），
     且**本就出图**（`render(BountyComponent(...))`）。
     此前沙盒里发 `赏金` 无响应，只是因为裸的「赏金」二字没被注册成别名——
     别名都是带地点的组合（`希图斯赏金`、`地球赏金`、`赏金希图斯`）。
     实际缺口仅为「一个不带地点的总览入口」，属可选增强。
   - **1999 日历：确实缺失**，源码中无任何 calendar 实现。数据在 worldstate 的
     `KnownCalendarSeasons`，同一个请求里已有，无需新增数据源。
3. **统一出图**——`environment`（平原周期）是**唯一**不出图的命令，实现为
   `environmentCommand: async () => getEnvironment()`，直接返回字符串。
   其余命令均已走 `render(...)`。套用已有渲染设施改造即可。

4. **移除周紫卡**——`riven-weekly` / `周紫卡` / `周卡`，其数据源 `docs.google.com` 在部署机不通。

组件只有 4 个文件（`render / wf / wfm / miscs`），改动面可控。持续成本是跟上游同步，但因改动集中在 CSS 与少量 command，冲突面小。

### 5.2b fork 的落地方式（已实测）

- **目录必须命名为 `warframe`**。其架构测试中 `packageRoot()` 的实现是
  `cwd.endsWith('warframe') ? cwd : resolve(cwd, 'external/warframe')`；
  目录名不符会导致 22 个架构测试因路径解析错误而失败（曾误判为「上游测试不过」）。
- **用 npm 即可，不需要 yarn 4**。仓库未声明 `packageManager`，`.yarnrc.yml`
  仅设 `nodeLinker: node-modules`。实测 `npm install` + `npm run build`（yakumo + copy-assets）均正常。
- **基线 474 个测试全绿**（47 个测试文件），其中包含架构约束测试
  （资源必须经统一入口加载、CSS/SVG/HTML 不得内联进 `render.tsx`），
  可作为改动不跑偏的护栏。
- **放在 `packages/wf-bot/external/warframe`，并在博客仓库中 gitignore。**
  理由：其一，GPL-3.0 代码不进入 Apache-2.0 的公开仓库，许可边界干净；
  其二，`external/*` 正是上游 `yarn clone` 的预期布局，架构测试与之吻合；
  其三，便于以自身 git remote 跟上游同步。
  wf-bot 的 `workspaces` 需增加 `external/*` 以便 Koishi 解析该模块。
  服务器部署时单独 clone，不随博客仓库分发。

### 5.3 渲染层

- 数据 → HTML + CSS → puppeteer 截图 → 图片消息
- **中文字体必须自带**。服务器（尤其精简 Docker 镜像）默认无中文字体，会渲染成豆腐块。字体文件须进仓库或镜像，并注意商用授权。
- **渲染是 CPU 密集**，需串行/小并发队列。群里连刷十条查询若同时起十个渲染会打满机器。
- **图不可缓存**。倒计时是相对时间（"剩余 12 分 57 秒"），渲染那一刻即固化。worldstate 数据可以缓存，但**图必须每次现渲**，且倒计时须由 `expiry` 时间戳在回复时刻现算——上游返回的 `timeLeft` 是预渲染字符串，缓存后直接使用会导致时间错误。
- **图 + 关键文本并发**。图里的字不能复制，查价场景群友需要复制卖家 ID 或交易命令。现有插件已经这么做（附 `/w xxx Hi! I want to buy...`），保留该行为。

### 5.4 数据层缓存

- worldstate：惰性 TTL（30~60s）+ 过期后台刷新，全群全命令共用一份。不做推送后无需常驻定时器。
- wm 物品表：启动拉一次（约 2.4MB）常驻内存，24h 刷新。
- wm 订单：按 slug 缓存 60s。
- 请求须带自定义 User-Agent（默认 UA 会吃 403）。

### 5.5 图片缓存层（自研）

边界干净，可独立单测：**输入 slug / imageName，输出本地文件路径。**

```
请求图片
 ├─ 本地命中 → 直接返回路径
 └─ 未命中   → 下载 → 落盘 → 返回路径
                    └─ 失败 → 返回占位图路径
```

- 渲染时用 `file://` 或 base64 内联，**让 puppeteer 完全不碰网络**。否则 puppeteer 会等所有外链图加载完才截图，一次遗物查询 6 张图冷缓存 ≈ 15 秒。
- LRU 上限约 500MB。全量 3837 物品 × ~100KB ≈ 380MB，按需缓存实际只沉淀热门物品，但必须设上限防止磁盘被慢慢吃光。
- wm 图源 URL 带内容 hash → 永久缓存；WFCD 无 hash → 长 TTL。
- 启动预热常用物品（战甲、热门 Prime 套），把首次访问的慢命中提前吃掉。国内服务器对两个图源的连通性不一定稳定，预热尤其重要。
- 单张图取不到时用占位符降级，**不能让一张图失败导致整个卡片渲染失败**。

### 5.6 群务插件组

> **本节只界定边界，不展开设计。** 群务与 Warframe 是两个互不相干的子系统——数据源、状态模型、失败模式完全不同，共同点仅是"都要往群里发消息"。它应当有自己的 spec 与实现计划，在本项目 Warframe 部分完成后单独进行。

与 Warframe 域完全解耦，用 Koishi 生态的现成插件（签到、欢迎等），不足的部分自研。需要用户表、权限模型与持久化状态。

签到的"每日重置"用懒计算（比对上次签到日期），不需要定时任务。

违规管理误判代价高，建议保守配置，先只做关键词与刷屏，不做自动踢人。

## 6. 命令语法

沿用参考实现的**可组合过滤器**形状，而非"一个功能一个命令"：

```
命令 = 域 + 零到多个过滤器

域       裂缝 / 钢铁裂缝 / 九重天裂缝 / 平原 / 遗物 / 赏金 / 奸商 …
过滤器   纪元：古纪 前纪 中纪 后纪 安魂 全能
         任务类型：捕获 歼灭 防御 间谍 生存 …

例：  钢铁裂缝        → isHard
      中纪裂缝        → tier=Meso
      裂缝推荐        → 筛选歼灭/捕获等快速任务
```

数据字段可 1:1 映射：`普通 = !isHard && !isStorm`、`钢铁 = isHard`、`飞船/九重天 = isStorm`、`纪元 = tier`、`任务类型 = missionType`。

## 7. 错误处理与降级

| 场景 | 处理 |
|---|---|
| 上游超时 / 5xx | 用过期缓存顶上，**但必须在回复里标注"数据可能已过期"** |
| 完全无缓存 | 明说不可用，不装作正常 |
| 单张图片取不到 | 占位图，卡片照常渲染 |
| 渲染失败 | 降级为纯文本回复，不静默失败 |
| 协议端掉线 | 告警。掉登录是常态，无告警就是 bot 静默死掉几小时没人知道 |

静默返回旧数据比报错更糟——群友会拿着一小时前的希图斯时间去开门。

## 8. 风控

非官方协议端，刷屏是账号被风控的头号诱因。以下从第一版就要有，不是优化项：

- 每群每指令冷却 10~30s
- 全局 QPS 上限
- 群白名单（别让 bot 被拉进陌生群就开始工作）
- 回复长度截断（裂缝原始数据 9.7KB，须先按纪元/任务类型筛选再输出）
- 渲染队列并发上限

## 9. 测试策略

- **模糊触发中间件**：纯函数，直接单测。重点覆盖错字、缺字、粘连参数、以及"正常聊天不被误触发"。
- **渲染器**：注入 clock 后可测（倒计时是相对时间，不能用真实时钟）。
- **图片缓存层**：注入假 downloader，测命中/未命中/失败降级/LRU 淘汰。
- **数据客户端**：用录制的 fixture 回放，测试不打真实网络。
- 测试不得对真实数据库执行写操作。

## 10. 部署

### 10.1 目标机器现状（2026-07-25 实测，`ssh tencent` → 101.43.8.213）

```
Ubuntu 22.04.5 LTS  x86_64
4 核 / 3.3G 内存 / 40G 磁盘（可用 27G）
Docker 29.4.0 已装，当前无容器运行
Node v20.20.2 (/usr/bin/node)，无 nvm
```

**blog 与 bot 同机。** blog 以 **root** 身份运行（不是 `shichiya` 用户——该机不存在此用户），实际路径 `/root/shichiya-blog`，与 `nginx.conf.example` 里写的 `/home/shichiya/shichiya-blog/` 不符（文档过时）。

```
PM2 (root)   blog-api  100.7MB  online     blog-web  160.2MB  online
监听         127.0.0.1:3000 / 127.0.0.1:3001，nginx 占 80/443
仓库         /root/shichiya-blog，分支 master-docker，commit 与本地一致
内存实况     已用 654M，可用 2.4G
```

内存预算：blog 约 260MB，新增 Koishi（约 150MB）+ Chrome（200~500MB）后仍余约 1.8G，可行但不宽裕。

### 10.1b 接入现有部署流程

服务器上有一个**未入库**的 `/root/shichiya-blog/deploy.sh`：

```bash
cd /root/shichiya-blog && git pull && npm install && npm run build && pm2 restart all
```

⚠️ **该脚本不会安装也不会构建 wf-bot**——因为 `packages/wf-bot` 被排除在根 workspaces 之外（见 §4），根目录的 `npm install` 与 `npm run build` 都会跳过它。

因此接入部署流程必须显式追加步骤：

```bash
cd /root/shichiya-blog/packages/wf-bot && npm install && npm run build
```

并在 `ecosystem.config.js` 中新增 `blog-bot` 进程（PM2 归 root 管）。注意 `pm2 restart all` 会连带重启 blog——若不希望 bot 的发布影响博客，应改用具名重启而非 `all`。

### 10.2 上线前必须解决的四件事

| # | 问题 | 影响 | 处理 |
|---|---|---|---|
| 1 | Node 20，但依赖要求 22+ | `warframe-worldstate-data` 要求 `>=22`，`warframe-worldstate-parser` 要求 `^22.18 \|\| >=24.11`，跑不起来 | 装 Node 22（nvm 或 NodeSource） |
| 2 | **无 Chrome/Chromium** | `puppeteer-finder` 找不到浏览器，**所有出图功能直接不可用** | 装 `chromium` 或 `google-chrome-stable` |
| 3 | **中文字体 0 个**（`fc-list :lang=zh` 为空） | 渲染出来全是豆腐块 | 装中文字体（如 Noto Sans CJK），注意商用授权 |
| 4 | `docs.google.com` 不通 | 周紫卡命令必然失败 | 镜像 CSV / 单独代理 / 砍掉，见 §11 |

### 10.3 内存约束

可用内存仅 2.4G，而 Chrome 单实例约占 200~500MB。因此：

- 渲染队列并发上限设为 **1**（串行），不要并行起多个页面
- 复用同一个浏览器实例与页面，不要每次请求新开浏览器
- 若后续 blog 也迁到这台机器，需重新评估内存预算

### 10.4 其他

- NapCat 用 Docker 起（Docker 已就绪），配反向 WS 指向 Koishi。
- `packages/wf-bot/.nvmrc` 已固定 Node 22。
- `packages/wf-bot` 不参与根 workspaces，自管依赖与 registry。
- 服务器到 npm 官方源连通正常（实测 200 / 4.8s），`.npmrc` 的 registry 覆盖在服务器上同样有效。

## 11. 未决事项

- **`deploy.sh` 未入库**。它只存在于服务器上，本地仓库没有。接入 bot 时应把它纳入版本管理，否则部署逻辑会持续漂移。

- 渲染的具体视觉稿（深色/徽章/布局）尚未定稿。参考图（沃沃）本身不含物品图片，本项目要嵌图，没有现成样式可抄，布局需自行设计。
- 群务具体用哪些现成插件、哪些自研，待逐个评估——实测 Koishi 生态里签到/欢迎类插件存在但多数较旧且零散，`积分/排行榜` 未找到合适的通用插件。
- 中文字体的选型与授权。
- NapCat 所用 QQ 小号的准备。
