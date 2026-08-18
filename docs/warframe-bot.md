# Warframe QQ 机器人与插件完整文档

本文档覆盖 `packages/wf-bot` 机器人运行环境、`koishi-plugin-warframe` Warframe 插件、两个本地辅助插件、发布流程、缓存策略和常见运维。

## 1. 系统定位

机器人是博客 monorepo 内的独立 Koishi 应用，面向 QQ 群提供 Warframe 查询、订阅提醒、市场行情、紫卡分析、出图和娱乐功能。

线上运行链路：

```text
QQ <-> NapCat(OneBot 11 WebSocket) <-> Koishi(wf-bot) <-> 插件
                                               |
                                               +-- warframe 插件
                                               +-- entertainment 插件
                                               +-- fuzzy-command 插件
                                               +-- SQLite 数据库
                                               +-- Puppeteer/Chrome 出图
```

关键目录：

| 路径 | 说明 |
| --- | --- |
| `packages/wf-bot` | Koishi 机器人应用根目录 |
| `packages/wf-bot/koishi.yml` | Koishi 插件编排、OneBot、数据库、Puppeteer 配置 |
| `packages/wf-bot/data/koishi.db` | Koishi SQLite 数据库；包含机器人持久数据 |
| `packages/wf-bot/napcat` | NapCat Docker 配置、QQ 登录态和 WebUI |
| `packages/wf-bot/external/warframe` | Warframe 插件源码 |
| `packages/wf-bot/plugins/entertainment` | 本地娱乐插件 |
| `packages/wf-bot/plugins/fuzzy-command` | 本地命令容错插件 |
| `scripts/deploy-wf-bot.sh` | 机器人专项发布脚本 |
| `scripts/send-onebot-private-message.cjs` | 发布公告发送脚本 |

## 2. 运行环境

### 2.1 基础要求

| 项 | 要求 |
| --- | --- |
| Node.js | 发布和构建使用 Node 22 |
| 包管理 | 根仓库用 npm；Warframe 插件包内使用 yarn |
| 进程管理 | PM2，进程名 `blog-bot` |
| QQ 协议端 | NapCat Docker |
| OneBot 连接 | `ws://127.0.0.1:3011` |
| Koishi 服务端口 | `127.0.0.1:5140` |
| 图片渲染 | `koishi-plugin-puppeteer` + Chrome |
| 数据库 | Koishi SQLite，默认 `packages/wf-bot/data/koishi.db` |

### 2.2 Koishi 配置

`packages/wf-bot/koishi.yml` 当前启用：

- `database-sqlite`：保存订阅、签到、娱乐数据。
- `server`：监听 `127.0.0.1:5140`。
- `cron`：世界状态推送、订阅检测、缓存刷新。
- `puppeteer`：所有图片卡片渲染。
- `adapter-onebot`：通过 `ws://127.0.0.1:3011` 连接 NapCat。
- `group:features`：限定功能插件只在白名单群启用。
- `fuzzy-command`：命令容错。
- `entertainment`：娱乐系统。
- `warframe`：Warframe 主功能。

### 2.3 关键环境变量

| 变量 | 用途 | 默认/示例 |
| --- | --- | --- |
| `ONEBOT_TOKEN` | Koishi 和公告脚本连接 NapCat 的鉴权 token | 必填 |
| `CHROME_PATH` | Puppeteer 使用的 Chrome 路径 | `/usr/bin/google-chrome` |
| `WF_CACHE_DIR` | Warframe 插件持久缓存根目录 | `.cache/koishi-warframe` |
| `WF_IMAGE_CACHE_DIR` | 图片缓存目录 | `${WF_CACHE_DIR}/images` |
| `WF_REMOTE_HOST` | 机器人发布 SSH 主机别名 | `tencent` |
| `WF_SSH_CONTROL_PATH` | 可选；复用调用方已建立的 SSH ControlMaster | `/tmp/.../control` |
| `WF_REMOTE_PRIMARY` | 线上主插件目录 | `/root/shichiya-bot-release/packages/wf-bot/external/warframe` |
| `WF_REMOTE_MIRROR` | 博客仓库镜像插件目录 | `/root/shichiya-blog/packages/wf-bot/external/warframe` |
| `WF_REMOTE_BOT_ROOT` | 线上机器人根目录 | `/root/shichiya-bot-release/packages/wf-bot` |

Warframe 插件内部还有可选配置：

| 配置 | 用途 |
| --- | --- |
| `channelIds` | 世界状态定时推送的频道列表，需带平台前缀，如 `qq:123456` |
| `developerMode` | 开启 Koishi 消息与命令调试日志 |
| `rivenVisionProvider` | 紫卡识图优先方式：`llm` 或 `ocr` |
| `arkVision.apiKey` / `model` / `baseUrl` / `timeoutMs` | 火山方舟多模态识图 |
| `ocrAPISecret.id` / `key` | 腾讯云 OCR，作为兜底 |

## 3. NapCat 登录与维护

NapCat 提供 OneBot 11 WebSocket，Koishi 通过它收发 QQ 消息。

启动：

```bash
cd packages/wf-bot/napcat
cp .env.example .env
chmod 600 .env
docker compose up -d
```

`.env` 需要至少配置：

```env
NAPCAT_UID=0
NAPCAT_GID=0
ACCOUNT=1805790388
NAPCAT_QUICK_PASSWORD=
```

登录：

1. 打开 WebUI：`http://127.0.0.1:6099/webui`
2. 从日志获取 token：

   ```bash
   docker logs napcat 2>&1 | grep -i token
   ```

3. 扫码登录或使用快速登录。

注意事项：

- `3011` 是 OneBot WebSocket 端口，只绑定回环地址。
- `6099` 是 NapCat WebUI，只绑定回环地址。
- `./ntqq` 保存 QQ 登录态，不要删除。
- `mac_address` 固定设备指纹，避免容器重建后触发额外风控。
- QQ 登录掉线时，优先检查 NapCat WebUI；必要时重新扫码。

## 4. Warframe 插件功能

用户可直接发送 `功能列表` 查看图片版总览；可发送 `命令搜索 关键词` 搜索命令。

### 4.1 订阅提醒

订阅系统每分钟检测一次世界状态。个人订阅保存在数据库中，群级推送开关只影响是否发送，不删除个人订阅。

| 功能 | 命令 / 别名 | 示例 |
| --- | --- | --- |
| 新增订阅 | `watch` / `订阅` / `蹲` | `蹲 地球黑夜` |
| 取消订阅 | `unwatch` / `取消订阅` / `不蹲` | `不蹲 地球黑夜` |
| 续订 | `watch-renew` / `续订` / `续蹲` | `续订 地球黑夜 7天` |
| 查询分类订阅 | `watch-query` / `查` / `查裂缝` 等 | `查裂缝` |
| 删除分类订阅 | `watch-remove` / `删` / `删裂缝` 等 | `删裂缝 全部` |
| 我的订阅 | `watch-list` / `订阅列表` / `我的订阅` | `我的订阅` |
| 推送状态 | `push-status` / `推送状态` | `推送状态` |
| 开启群推送 | `push-enable` / `开启群推送` | `开启群推送 裂缝` |
| 关闭群推送 | `push-disable` / `关闭群推送` | `关闭群推送 1999` |
| 授权管理 | `push-grant` / `推送授权` | `推送授权 @成员` |
| 取消授权 | `push-revoke` / `取消推送授权` | `取消推送授权 @成员` |
| 帮助 | `push-help` / `推送帮助` | `推送帮助` |

支持的订阅类别包括：

- 裂缝、钢铁裂缝、九重天裂缝
- 夜灵 / 地球黑夜 / 三傻
- 仲裁
- 扎里曼赏金
- 1999 / 六人组赏金
- 双衍王境
- 入侵
- Darvo 每日特惠，可订阅全部特惠或指定商品

订阅条件支持自然写法和常见缩写，例如：

```text
蹲 地球黑夜
蹲 1999 五歼+保险箱
蹲 中虚歼
蹲 扎里曼 7天
蹲 每日特惠
蹲 每日特惠 西伯利亚冰锤
蹲 每日特惠 冰矿锤
```

普通群员的新订阅和续订后剩余有效期最多为 7 天。群主、管理员及推送授权白名单成员可以创建永久有效的订阅。

### 4.2 市场行情

市场行情主要依赖 Warframe Market。WM 临时不可用时，硬依赖功能会提示失败；非核心增强会降级。

| 功能 | 命令 / 别名 | 示例 |
| --- | --- | --- |
| 普通物品查价 | `wmi` / `查价` / `多少p` | `查价 膛室 Prime` |
| 旧入口 | `wm` | 兼容旧用法，推荐改用 `wmi` |
| 价格走势 | `wm-trend` / `wmt` / `走势` / `价格走势` | `走势 毒襄双枪` |
| 紫卡拍卖 | `wmr` / `zk` / `紫卡查价` / `紫卡拍卖` | `zk 托里德` |
| 同词条紫卡查价 | `wmr` / `zk` | `zk 托里德 暴击率 暴击伤害 多重射击 -弹药上限` |
| P 卡排行 | `pmod-history` / `pmod` / `P卡` | `P卡 时间` |
| 统一榜单 | `market-ranking` / `榜单` | `榜单 赋能 满级 前20` |
| 图片查价 | `image-price` / `图片查价` / `识图查价` | 发送截图并附带 `图片查价` |
| WM 缓存刷新 | `wmu` | 维护命令，不在功能列表展示 |

榜单支持：

- `榜单 P卡`
- `榜单 赋能 满级 前20`
- `榜单 MOD 前10`
- `榜单 未开紫卡`
- `榜单 战甲套装`
- `榜单 武器套装`
- `榜单 成品武器`
- `榜单 金垃圾 反序`
- `榜单 银垃圾`
- `榜单 铜垃圾`
- `榜单 套装`
- `榜单 战甲部件`
- `榜单 武器部件`
- `榜单 蓝图`

### 4.3 世界状态

| 功能 | 命令 / 别名 |
| --- | --- |
| 普通裂缝 | `fissure` / `裂缝` / `裂隙` |
| 钢铁裂缝 | `fissure-sp` / `钢铁裂缝` / `钢铁裂隙` |
| 九重天裂缝 | `fissure-rj` / `九重天裂缝` / `九重天裂隙` |
| 开放世界周期 | `environment` / `env` / `平原` / `夜灵平野` / `奥布山谷` / `魔胎之境` |
| 虚空商人 | `void-trader` / `voidtrader` / `虚空商人` / `奸商` |
| 仲裁表 | `arbitration` / `arbi` / `仲裁` / `仲裁表` |
| 入侵 | `invasion` / `入侵` / `入侵警报` |
| 警报 | `alert` / `警报` |
| 每日突击 | `sortie` / `突击` / `每日突击` |
| Darvo 特惠 | `daily-deal` / `每日特惠` / `特惠` / `达尔沃特惠` |
| 钢铁侵袭 | `steel-incursion` / `侵袭` / `钢铁侵袭` / `钢铁精华` |
| 限时活动 | `event` / `活动` / `限时活动` |
| 活动兑换 | `event-shop` / `活动兑换` / `娜卡商店` / `娜卡兑换` |
| 官方新闻 | `news` / `新闻` / `官方新闻` |
| 热修日志 | `hotfix` / `热修` / `更新日志` / `热修日志` |

### 4.4 赏金

赏金卡片会展示任务、等级、声望、奖励池、普通/钢铁虚空刺翎、背景图和集团标识。奖励图优先使用 DE 官方图标，WM 只作为兜底。

| 地区 | 命令 / 别名 |
| --- | --- |
| 希图斯 | `bounty-cetus` / `希图斯` / `希图斯赏金` / `赏金希图斯` / `地球赏金` |
| 福尔图娜 | `bounty-fortuna` / `福尔图娜` / `金星赏金` |
| 火卫二 | `bounty-deimos` / `火卫二` / `火卫二赏金` |
| 扎里曼 | `bounty-zariman` / `扎里曼` / `扎里曼赏金` |
| 科维兽 / 圣所 | `bounty-cavia` / `科维兽` / `圣所` / `圣所赏金` |
| 六人组 / 1999 | `bounty-hex` / `六人组` / `1999` / `1999赏金` |

### 4.5 周期内容

| 功能 | 命令 / 别名 | 说明 |
| --- | --- | --- |
| 1999 日历 | `calendar` / `日历` / `1999日历` | 当前 1999 日历状态 |
| 周报 / 周常总览 | `weekly` / `周常` / `周报` | 默认汇总全部自然周内容；可按板块筛选 |
| 执行官猎杀 | `archon-hunt` / `执行官` | 单独查看本周执行官 |
| 深层科研 | `deep-archimedea` / `深层科研` / `科研` | 单独查看本周深层科研 |
| 时光科研 | `temporal-archimedea` / `时光科研` | 单独查看本周时光科研 |
| 钢铁兑换 | `steel-exchange` / `钢铁兑换` | Teshin 本周轮换商品 |
| 回廊 | `circuit` / `灵化之源` / `灵化` / `回廊` | 当前周回廊奖励；加 `全部` 看整轮 |
| 午夜电波 | `nightwave` / `午夜电波` / `电波` / `夜波` | Cred 可兑换奖励摘要、当前赛季等级奖励、周常/精英周常任务 |
| Prime 复兴 | `resurgence` / `重生` / `复兴` / `阿耶` | 复兴轮换 |

自然周统一按 Warframe 的 UTC 周重置计算，即北京时间每周一 `08:00`：

| 数据 | 更新时间 | 周报处理 |
| --- | --- | --- |
| 执行官猎杀 | 周一 00:00 UTC / 08:00 北京时间 | 默认包含 |
| 深层科研 | 周一 00:00 UTC / 08:00 北京时间 | 默认包含 |
| 时光科研 | 周一 00:00 UTC / 08:00 北京时间 | 默认包含 |
| Teshin 钢铁兑换 | 周一 00:00 UTC / 08:00 北京时间 | 默认包含 |
| 回廊战甲与灵化奖励 | 周一 00:00 UTC / 08:00 北京时间 | 默认包含 |
| 午夜电波每周 / 精英挑战 | 周一 00:00 UTC / 08:00 北京时间 | 默认包含；每日挑战不纳入 |
| 每周紫卡行情归档 | 第三方按 ISO 周发布，无固定到点 SLA | 不纳入自动周报 |

`周常` 默认生成 1120px 宽的全量周报；可发送 `周常 钢铁 回廊 电波` 等组合只看指定板块。机器人每分钟检查一次自然周周期键，新周开始后会主动刷新世界状态并预生成默认周报。图片消息持久化到 `${WF_CACHE_DIR}/weekly-reports`，到下周一 08:00 强制失效；这等价于最多缓存 7 天，同时避免周日首次生成后跨周继续返回旧图。筛选组合首次查询时生成一次，之后复用同一周期缓存。

1999 日历、Prime 复兴、午夜电波每日挑战以及每日钢铁侵袭各自有非周粒度的轮换，不应按 7 天缓存。

### 4.6 资料查询

| 功能 | 命令 / 别名 | 示例 |
| --- | --- | --- |
| 遗物查询 | `relic` / `遗物` / `核桃` | `遗物 后纪 A1` |
| 遗物反查 | `relic` / `遗物` / `核桃` | `遗物 绝路 Prime 枪管` |
| 战甲总览 | `warframes` / `战甲` / `战甲列表` | `战甲` |
| 掉落查询 | `drop` / `掉落` | `掉落 内融核心` |
| Wiki 查询 | `wiki` / `百科` / `wk` | `wk 夜灵水力使` |
| 命令搜索 | `command-search` / `命令搜索` / `搜命令` / `找命令` | `命令搜索 裂缝` |

遗物查询和返回结果中涉及遗物时，会标记状态：

- 已入库
- 出库中
- 重生中

Wiki 使用本地中英文字典和社区别名直接生成灰机 Warframe Wiki 词条链接，不请求 Wiki API。

### 4.7 紫卡与武器

| 功能 | 命令 / 别名 | 示例 |
| --- | --- | --- |
| 紫卡识别 / 分析 | `riven` / `紫卡识别` | 可附带紫卡截图，也可直接输入武器、词条和数值 |
| 紫卡分析 / 识别 | `riven-text` / `紫卡分析` / `文字紫卡` | 同样兼容截图和文字：`紫卡分析 托里德 | 暴击率 187.2 | 暴击伤害 146.8 | 多重射击 112.5` |
| 紫卡数值范围 | `riven-stat` / `rivenstat` / `紫卡数值` | `riven-stat 步枪 31 0.7` |
| 武器倾向 | `riven-disposition` / `倾向` / `武器倾向` | `倾向 托里德` |
| 配卡建议 | `weapon-advice` / `配卡建议` / `武器建议` / `配卡思路` | `配卡建议 托里德 克隆尼` |
| 热门紫卡 | `riven-hot` / `hotriven` / `热门紫卡` / `紫卡热度` | `热门紫卡` |

紫卡识图支持两条路径：

- 火山方舟多模态模型：默认优先。
- 腾讯云 OCR：可作为兜底。

`紫卡识别` 与 `紫卡分析` 两组命令输入能力相同：检测到图片时先识图，只有文字时解析文字；随后统一执行结构化校验、紫卡数值分析、WM 同词条报价和结果图渲染。

紫卡分析中的 WM 市场报价是增强信息。WM 异常、无挂单或词条过冷时，只是不显示市场参考，不影响基础分析结果。

### 4.8 玄骸、信条与终幕

| 功能 | 命令 / 别名 | 示例 |
| --- | --- | --- |
| 赤毒玄骸武器 | `lich-g` / `赤毒玄骸` / `赤毒武器` | `赤毒玄骸` |
| 信条玄骸武器 | `lich-c` / `信条玄骸` / `信条武器` | `信条武器` |
| 终幕玄骸武器 | `lich-i` / `终幕玄骸` / `终幕武器` | `终幕武器` |
| 信条商店 | `tenet-shop` / `信条` / `信条商店` / `葛拉斯` | `信条` |
| 终幕商店 | `coda-shop` / `终幕` / `终幕商店` | `终幕` |
| 玄骸估价 | `lich-estimate` / `玄骸估价` / `xh` | `玄骸估价 60 火 赤毒·布拉玛` |

玄骸估价依赖 WM auction 搜索，会返回同条件和 ±5% 附近订单的最低价/中位价。

## 5. 娱乐插件

娱乐插件独立于 Warframe 主插件，负责群内签到、积分、奇遇、对战、商店和排行。

| 功能 | 命令 / 别名 | 说明 |
| --- | --- | --- |
| 今日运势 | `今日运势` / `运势` | 按用户和日期固定生成；签到卡展示紫卡、交易、掉落、核桃、赏金、生息六维雷达图 |
| 随机战甲 | `随机战甲` / `随机甲` | 随机推荐 Warframe |
| 随机武器 | `随机武器` / `随机枪` / `随机装备` | 随机推荐武器 |
| 签到 | `签到` | 每日积分、经验、对战券、今日奇遇 |
| 我的资料 | `我的资料` / `积分` / `战斗力` / `战力` | 查看积分、等级、战斗力、战绩 |
| 今日奇遇 | `今日奇遇` / `奇遇` | 查看当日奇遇及生效条件 |
| 对战 | `对战` / `匹配对战` / `自动匹配` | 随机匹配 MMR 接近的群友并直接结算 |
| 指定对战 | `对战 <target> [stake]` / `挑战 <target> [stake]` | MMR 匹配时直接结算，否则等待对方接受 |
| 接受挑战 | `接受挑战` | 接受最新未过期对战邀请 |
| 拒绝挑战 | `拒绝挑战` | 拒绝最新未过期对战邀请 |
| 战术复盘 | `战术复盘 [battleId]` / `对战复盘` | 查看可复盘战报 |
| 积分商店 | `积分商店` / `商店` | 查看可购买道具 |
| 购买 | `购买 <item> [quantity]` | 购买积分商店商品 |
| 背包 | `背包` / `我的道具` | 查看已购买道具 |
| 赠送积分 | `赠送 <target> <amount>` / `送积分` | 向今日已签到群友赠送积分 |
| 积分排行 | `积分排行` / `排行榜` | 本群积分排行 |
| 对战排行 | `对战排行` | 本群 MMR 排行 |

对战结算中仅发起方消耗对战券并支付完整积分，被挑战方支付一半积分；被挑战方获胜时，积分奖励、胜利奇遇积分和胜利经验均减半。

娱乐数据表：

- `entertainment_profile`
- `entertainment_battle`
- `entertainment_inventory`
- `entertainment_transfer`

娱乐出图背景使用 DE Public Export 资源，首次使用时下载并缓存到本地。

## 6. 模糊命令插件

`fuzzy-command` 是前置中间件，在 Koishi 命令解析前改写用户输入。

能力：

- 全角转半角。
- 繁体转简体。
- 支持命令和参数粘连，例如 `遗物后纪a2`。
- 支持轻微错字和拼音距离匹配。
- 多个命令同分时返回候选，不盲猜。
- 超过 `maxInputLength` 的普通聊天不匹配。

配置：

| 配置 | 默认 | 说明 |
| --- | --- | --- |
| `maxInputLength` | `12` | 超过该字数不做模糊匹配 |
| `minFuzzyLength` | `2` | 参与模糊匹配的最短命令长度 |

## 7. 出图与缓存

### 7.1 出图链路

插件使用 TSX 组件生成 HTML，再交给 Puppeteer 截图。渲染入口：

- `src/components/render.tsx`
- `src/assets/render.html`
- `src/assets/render.css`
- `src/assets/render-icons.svg`

图片资源一律应在服务层解析为本地路径，组件层使用 `file://` 引用，避免 Puppeteer 截图时等待远程图片。

### 7.2 图片缓存

Warframe 插件共用 `globalImageCache`：

- 默认目录：`${WF_CACHE_DIR}/images`
- 未配置 `WF_CACHE_DIR` 时：当前工作目录下 `.cache/koishi-warframe/images`
- 同 URL 并发请求会合并为一次下载。
- 缓存上限默认 128 MB，超过后按最旧文件淘汰。
- 下载失败返回 `undefined`，调用方降级为无图。

### 7.3 WM 元数据缓存

下列 WM 元数据成功获取后会写入本地 JSON 快照：

| 快照文件 | 内容 |
| --- | --- |
| `wfm-items.json` | WM 普通物品列表 |
| `wfm-riven-attributes.json` | WM 紫卡词条表 |
| `wfm-riven-items.json` | WM 紫卡武器表 |
| `wfm-ducatnator.json` | Ducatnator 行情 |

读取策略：

1. 优先请求实时 WM。
2. 成功后覆盖本地快照。
3. 实时请求失败时读取本地快照。
4. 没有快照时，硬依赖功能返回失败；软依赖功能降级。

### 7.4 WM 依赖分级

硬依赖 WM：

- `wmi` / `wm` / `查价`
- `wm-trend` / `走势`
- `wmr` / `zk`
- `lich-estimate` / `玄骸估价`
- `image-price` 的价格部分
- `market-ranking` / `榜单`
- `pmod-history` 的价值榜
- `wmu`

软依赖 WM：

- 遗物奖励价格、杜卡德、缩略图
- 掉落查询缩略图
- 赏金奖励缩略图兜底
- 虚空商人、警报、入侵、复兴、玄骸武器列表等缩略图
- 紫卡分析市场参考价
- 热门紫卡名称本地化

不应被 WM 故障影响的核心功能：

- 平原/开放世界周期
- 裂缝、仲裁、突击、警报、入侵的核心世界状态
- 赏金核心任务和奖励文本
- 周常、执行官、科研、钢铁兑换
- Wiki、新闻、热修
- 订阅调度和群级推送管理
- 紫卡基础分析中的非市场部分

## 8. 数据源

| 数据源 | 用途 | 失败策略 |
| --- | --- | --- |
| Warframe Worldstate | 裂缝、赏金、周期、活动等 | 查询失败返回明确错误；订阅记录失败状态 |
| `warframe-worldstate-data` / Public Export | 本地化、星图、任务、掉落、武器数据 | 随包快照；启动及每日 04:15 检查上游提交，变化时原子更新 30 张核心表并持久化 |
| Warframe Market 元数据 | 物品目录、紫卡武器、紫卡词条 | 启动及每日 04:15 刷新，失败时继续使用持久快照 |
| DE Public Export / browse.wf 图标 | 物品图标、背景、集团图标 | 下载后本地缓存；失败无图 |
| Warframe Market | 行情、交易物品、紫卡词条、缩略图兜底 | 元数据持久缓存；硬依赖失败提示 |
| 灰机 Warframe Wiki | `wiki` / `wk` 词条链接 | 按本地规则生成，不调用 Wiki API |
| Warframe 官方新闻 | `news` / `hotfix` | 访问失败提示 |
| 火山方舟 / 腾讯云 OCR | 图片识别 | 识别失败提示；紫卡可互为兜底 |

## 9. 持久化数据

Koishi SQLite 默认在 `packages/wf-bot/data/koishi.db`。

Warframe 插件表：

| 表 | 用途 |
| --- | --- |
| `wf_subscription` | 个人订阅 |
| `wf_subscription_state` | 每个频道/条件的上一轮推送状态，避免重复提醒 |
| `wf_subscription_group` | 群级总开关、分类开关、授权成员 |
| `wf_checkin` | Warframe 插件内旧签到数据 |

娱乐插件表：

| 表 | 用途 |
| --- | --- |
| `entertainment_profile` | 用户积分、经验、等级、战绩 |
| `entertainment_battle` | 对战记录 |
| `entertainment_inventory` | 道具背包 |
| `entertainment_transfer` | 积分赠送记录 |

发布脚本只同步 `lib/`，不会覆盖 `data/` 和 `.cache/`。

## 10. 开发

从本地修改、定向测试、完整验证到单次发布的操作规范，以及诊断和发布期间复用同一条 SSH ControlMaster 的方法，见 [Warframe 机器人本地开发、测试与发布流程](./wf-bot-development-release-workflow.md)。

### 10.1 安装依赖

根仓库：

```bash
npm install
npm --prefix packages/wf-bot install
```

Warframe 插件：

```bash
cd packages/wf-bot/external/warframe
yarn install
```

### 10.2 常用命令

根仓库：

```bash
npm run build:bot
npm run deploy:bot -- --dry-run --notice "检查发布参数"
```

Warframe 插件：

```bash
cd packages/wf-bot/external/warframe
yarn dtsc
yarn test
yarn build
yarn preview
```

注意：Vitest 需要 Node 22。若本地默认 Node 不是 22：

```bash
source "${NVM_DIR:-$HOME/.nvm}/nvm.sh"
nvm use 22
yarn test
```

### 10.3 出图预览

预览测试在 `tests/preview`，不属于全量断言套件，会启动浏览器并可能联网。

示例：

```bash
cd packages/wf-bot/external/warframe
CARD=bounty LOC=hex OUT=/tmp/wf-bounty-hex.png yarn preview
```

### 10.4 开发约束

- Warframe 领域层不直接 import Koishi；Koishi 相关逻辑放在 `commands/`、`schedules/`、`store/`。
- 服务层负责取数和图片路径解析；组件层只负责渲染。
- 外部网络失败不能拖垮非硬依赖功能。
- 发布测试不应依赖实时外部 API；需要 fixture 或注入 fetch/client。
- 出图资源应本地化或使用图片缓存，不让 Puppeteer 直接加载远程图。

## 11. 发布

### 11.1 博客全栈发布

在服务器上执行：

```bash
npm run deploy
```

等价流程：

```text
git pull
-> npm install
-> npm --prefix packages/wf-bot install
-> npm run db:migrate
-> npm run build
-> pm2 reload ecosystem.config.js --update-env
```

该流程更新博客前端、后端、机器人构建产物和数据库迁移。

### 11.2 机器人专项发布

在本地执行：

```bash
npm run deploy:bot -- --notice "本次更新内容"
```

脚本行为：

1. 检查 `--notice`。
2. 建立发布期间唯一 SSH ControlMaster，或复用 `WF_SSH_CONTROL_PATH` 指向的已有连接。
3. 切换 Node 22。
4. 运行 Warframe、娱乐和模糊命令插件的完整测试。
5. 构建三个插件。
6. 计算本地 `lib/index.js` SHA256。
7. rsync 同步 Warframe、娱乐和模糊命令插件的 `lib/` 到两个线上目录：
   - `/root/shichiya-bot-release/packages/wf-bot/external/warframe`
   - `/root/shichiya-blog/packages/wf-bot/external/warframe`
8. SSH 计算两个线上目录的 `lib/index.js` SHA256，必须与本地一致。
9. `sudo pm2 restart blog-bot`。
10. 最多等待 30 秒，要求 PM2 状态 online，且 stdout 同时出现 `server listening at` 和 `Warframe 插件已加载，命令注册完成`。
11. 检查本次启动后新增 error 日志；有新增错误则失败。
12. 通过 OneBot WebSocket 只向好友 QQ `1071342037` 发送更新公告。
13. 私聊 OneBot 回执成功后退出。

发布公告格式：

```text
【机器人更新公告】
本次更新内容

发布时间：YYYY-MM-DD HH:mm:ss
版本：bundle SHA 前 12 位
```

支持：

```bash
npm run deploy:bot -- --notice "..." --dry-run
```

`--dry-run` 只检查参数和目标路径，不构建、不连接服务器、不发送公告。

若发布前已经使用 ControlMaster 查询日志，可将其继续交给发布脚本：

```bash
WF_SSH_CONTROL_PATH="$WF_SSH_CONTROL_PATH" \
  npm run deploy:bot -- --notice "本次更新内容"
```

脚本会校验并复用该连接，但不会在退出时关闭它；发布后真实命令验收结束，再由调用方统一执行 `ssh -O exit`。完整操作见 [本地开发、测试与发布流程](./wf-bot-development-release-workflow.md)。

### 11.3 成功标准

机器人专项发布必须同时满足：

- 全量测试通过。
- 构建成功。
- 主目录和镜像目录 SHA 与本地一致。
- `blog-bot` online。
- stdout 明确记录 Warframe 插件命令注册完成。
- 本次启动无新增 error 日志。
- 私聊公告收到 OneBot 成功回执。

## 12. 运维排查

### 12.1 查看进程

```bash
pm2 status
pm2 logs blog-bot --lines 100
sudo tail -n 100 /root/.pm2/logs/blog-bot-error.log
sudo tail -n 100 /root/.pm2/logs/blog-bot-out.log
```

### 12.2 检查 NapCat

```bash
docker ps | grep napcat
docker logs napcat --tail 100
```

WebUI：

```text
http://127.0.0.1:6099/webui
```

远程访问 WebUI 应走 SSH 隧道，不要开放公网端口。

### 12.3 检查 OneBot

```bash
ss -tlnp | grep 3011
```

若发布公告失败：

- 确认 NapCat 在线。
- 确认 `ONEBOT_TOKEN` 与 Koishi/NapCat 一致。
- 确认 `packages/wf-bot/.env` 可被线上脚本读取。
- 确认 QQ 没有掉线。

### 12.4 检查出图

常见原因：

- `CHROME_PATH` 未配置或 Chrome 不存在。
- `koishi-plugin-puppeteer` 未启用。
- CSS/图片引用不是本地 `file://`。
- 远程图源首次下载失败。

处理：

```bash
which google-chrome
ls -lah packages/wf-bot/external/warframe/.cache/koishi-warframe/images
```

线上如果工作目录不同，缓存可能位于运行进程的当前工作目录下；可通过 `WF_CACHE_DIR` 固定。

### 12.5 WM 异常

表现：

- `wmi` / `wmr` / `榜单` / `玄骸估价` 返回市场数据失败。
- 图片或价格缺失，但世界状态、赏金、订阅仍应可用。

处理：

```text
wmu
```

如果 WM 仍不可用，等待恢复。已存在本地快照时，部分功能会继续使用快照。

### 12.6 订阅没有提醒

排查顺序：

1. `推送状态`
2. `我的订阅`
3. `查裂缝` 或对应分类查询
4. 检查群推送是否被关闭：`开启群推送`
5. 检查分类是否被关闭：`开启群推送 1999`
6. 查看 `blog-bot` 日志里的取数失败、渲染失败或发送失败。

## 13. 安全约束

- NapCat WebUI 和 OneBot WebSocket 只绑定 `127.0.0.1`。
- `.env`、QQ 密码、OneBot token 不提交仓库。
- `packages/wf-bot/data/koishi.db` 不应被发布脚本覆盖。
- 发布公告脚本只读取指定 `.env` 中的 `ONEBOT_TOKEN`，不把 token 打到日志。
- SSH 发布复用单个 ControlMaster 连接，避免重复登录和多连接干扰。

## 14. 当前维护重点

- 所有出图组件继续减少空白、压缩尺寸、补相关背景和实物图。
- 新功能优先保证核心查询不被图片、WM 或单个外部源拖垮。
- 新增外部依赖时必须：
  - 标清硬依赖还是软依赖。
  - 给测试提供 fixture 或注入点。
  - 明确失败文案或降级路径。
  - 如会影响发布，必须从发布测试中隔离实时网络。
