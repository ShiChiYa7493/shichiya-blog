# Warframe 机器人本地开发、测试与发布流程

本文是 `packages/wf-bot` 的日常开发与发布 SOP。目标是所有改动先在本地完成并验证，只在全部检查通过后发布一次、发送一次公告；涉及服务器的命令在同一工作阶段复用一个 SSH ControlMaster。

## 1. 基本原则

1. 源码只在本地修改，不直接编辑服务器文件。
2. Warframe 插件的测试、类型检查和构建统一使用 Node 22。
3. 先完成全部代码和出图调整，再执行完整验证。
4. 验证未通过时不发布、不重启、不发公告。
5. 一组相关改动只执行一次正式发布，公告由发布脚本在最后发送。
6. 日志查询、文件同步、哈希校验、重启和公告发送复用同一个 SSH 主连接。
7. `packages/wf-bot/external/warframe` 是独立 Git 工作区，检查差异时不要只看 monorepo 根目录。

## 2. 首次准备

本机需要 Node 22、npm、yarn、rsync，以及可用的 `tencent` SSH 别名：

```sshconfig
Host tencent
  HostName <server-host>
  User <server-user>
  IdentityFile <private-key-path>
```

检查环境：

```bash
ssh tencent true
node --version
yarn --version
rsync --version
```

安装依赖：

```bash
npm install
npm --prefix packages/wf-bot install

cd packages/wf-bot/external/warframe
yarn install
```

若当前 Node 不是 22：

```bash
source "${NVM_DIR:-$HOME/.nvm}/nvm.sh"
nvm use 22
```

## 3. 标准工作流

### 3.1 开始前检查工作区

分别检查 monorepo 和 Warframe 插件，已有改动默认属于当前开发者，不要随意还原：

```bash
git status --short
git -C packages/wf-bot/external/warframe status --short
```

确认本次改动范围后再编辑。涉及组件出图时，同时定位服务层数据、类型定义、组件和预览 fixture；不要只调整最终 CSS。

### 3.2 本地开发与定向验证

在插件目录执行与改动最接近的测试：

```bash
cd packages/wf-bot/external/warframe
yarn vitest run tests/services/wf/operations.wf.spec.ts
```

按实际改动替换测试文件。涉及出图时运行预览并检查生成图片：

```bash
yarn preview
```

视觉检查至少包括：

- 文案、数字和本地化是否正确。
- 中英文是否使用预期字体。
- 长文本是否换行，是否存在裁切或重叠。
- 图片资源是否加载，画布是否为空。
- 常用卡片宽度和信息层级是否合理。

### 3.3 发布前完整验证

所有改动完成后，按顺序执行：

```bash
cd packages/wf-bot/external/warframe
yarn test
yarn dtsc
yarn build
git diff --check
```

`yarn build` 不只生成 `lib/index.js` 和复制静态资源，还会真实执行一次 `require('../lib/index.js')`。这一步用于发现 CommonJS/ESM 边界错误，防止出现“单元测试通过，但 Koishi 插件无法注册”。

回到仓库根目录，再检查启动脚本和发布脚本：

```bash
cd ../../../..
node --check packages/wf-bot/start.js
bash -n scripts/deploy-wf-bot.sh
git diff --check
```

### 3.4 发布参数预检

正式发布前可运行 dry-run。它不会构建、连接服务器、写远端或发公告：

```bash
npm run deploy:bot -- --notice "本次完整更新内容" --dry-run
```

公告应概括整批改动，不要为每个小步骤分别发布或公告。

### 3.5 正式发布一次

需要在发布后继续观察真实命令时，先按 4.2 节建立工作阶段共用的 ControlMaster，再执行：

```bash
WF_SSH_CONTROL_PATH="$WF_SSH_CONTROL_PATH" \
  npm run deploy:bot -- --notice "本次完整更新内容"
```

如果不需要发布后的远端日志验收，也可以让脚本自行管理连接：

```bash
npm run deploy:bot -- --notice "本次完整更新内容"
```

未传 `WF_SSH_CONTROL_PATH` 时，脚本会建立一个临时 SSH ControlMaster。测试、构建完成后的所有 `rsync`、远端 SHA 校验、PM2 重启、日志检查和 OneBot 公告发送都复用该连接，脚本退出时关闭它。传入已有连接时，脚本复用但不关闭，由工作阶段在发布后验收完成时统一关闭。

正式发布包含以下门禁：

1. 全量测试通过。
2. Node 22 构建及 bundle 加载冒烟检查通过。
3. Warframe、娱乐、模糊命令插件的 `lib/` 和 `start.js` 同步到线上主目录及镜像目录。
4. bundle、启动文件和 Georgia 字体 SHA256 与本地一致。
5. PM2 在 180 秒内进入 `online`。
6. 新启动日志出现 `server listening at`。
7. 新启动日志出现 `Warframe 插件已加载，命令注册完成`。
8. 新启动日志出现 `Public Export 每日检查` 和 `WFM 元数据`，确认两类每日数据初始化完成。
9. 本次启动没有新增 error 日志。
10. 最后只向好友 QQ `1071342037` 私聊发送一次公告，并确认 OneBot 回执；不向任何群发送。

## 4. SSH ControlMaster 复用

### 4.1 脚本内部自动复用

只需要完成脚本内发布时，不必手工运行 `ssh tencent`。直接使用 `npm run deploy:bot`，脚本会管理发布期间的唯一连接，并在退出时关闭。不要在脚本执行期间另开独立 SSH 会话查询日志。

需要把发布前诊断、正式发布和发布后真实命令验收视为一个连续工作阶段时，使用下一节的外部 ControlMaster 模式。

### 4.2 先诊断、再沿用同一连接发布

需要先查日志时，在本地建立一个工作阶段专用的 ControlMaster：

```bash
WF_SSH_DIR=$(mktemp -d "${TMPDIR:-/tmp}/wf-bot-ops.XXXXXX")
WF_SSH_CONTROL_PATH="$WF_SSH_DIR/control"

ssh -MNf \
  -o ControlMaster=yes \
  -o ControlPersist=30m \
  -o ControlPath="$WF_SSH_CONTROL_PATH" \
  tencent

ssh -o ControlMaster=no \
  -o ControlPath="$WF_SSH_CONTROL_PATH" \
  -O check tencent
```

之后的查询统一显式使用该路径：

```bash
ssh -o ControlMaster=no \
  -o ControlPath="$WF_SSH_CONTROL_PATH" \
  tencent 'sudo pm2 status'

ssh -o ControlMaster=no \
  -o ControlPath="$WF_SSH_CONTROL_PATH" \
  tencent 'sudo tail -n 200 /root/.pm2/logs/blog-bot-out.log'
```

确认修复并完成本地全量验证后，把同一 ControlPath 交给发布脚本：

```bash
WF_SSH_CONTROL_PATH="$WF_SSH_CONTROL_PATH" \
  npm run deploy:bot -- --notice "本次完整更新内容"
```

发布脚本会先执行 `ssh -O check`，连接不可用时立即失败；可用时所有远端操作继续复用该连接。因为连接由外部创建，发布脚本不会关闭它。

工作阶段全部结束后再关闭：

```bash
ssh -o ControlPath="$WF_SSH_CONTROL_PATH" -O exit tencent
rmdir "$WF_SSH_DIR"
unset WF_SSH_CONTROL_PATH WF_SSH_DIR
```

不要在每次日志查询后执行 `ssh -O exit`，也不要为每条远端命令重新创建 ControlPath。

### 4.3 rsync 也必须复用连接

需要手工只读验证或临时同步时，`rsync` 的远端 shell 也要指向同一个 ControlPath：

```bash
rsync -az --checksum \
  -e "ssh -o ControlMaster=no -o ControlPath=$WF_SSH_CONTROL_PATH" \
  <local-path> tencent:<remote-path>
```

正式发布优先使用发布脚本，不手工复制部分文件，以免主目录、镜像目录或哈希校验遗漏。

## 5. 发布后核验

发布脚本成功退出后，先看公告回执和版本 SHA，再发送一条与本次改动直接相关的真实命令。例如周常改动可依次验证：

```text
周常
午夜电波
执行官
钢铁兑换
```

按 4.2 节使用外部 ControlMaster 发布时，继续使用同一连接观察从收命令到发图成功的日志：

```bash
ssh -o ControlMaster=no \
  -o ControlPath="$WF_SSH_CONTROL_PATH" \
  tencent 'sudo tail -n 200 /root/.pm2/logs/blog-bot-out.log'
```

成功链路应依次出现：

```text
Koishi recieved message: <命令>
WFM Plugin received command <command-name>
出图耗时 ...ms                  # 仅超过阈值时出现
OneBot 开始发送 ... 图片大小=...B
OneBot 发送成功 ... 耗时 ...ms，收到命令到发送成功 ...ms
```

还要检查：

```bash
ssh -o ControlMaster=no \
  -o ControlPath="$WF_SSH_CONTROL_PATH" \
  tencent 'sudo tail -n 100 /root/.pm2/logs/blog-bot-error.log'
```

## 6. 失败处理

- 本地测试、类型检查或构建失败：修复后重新完成本地门禁，不发布。
- SSH 主连接失效：先用 `ssh -O check` 确认；不要让发布脚本静默新建第二条连接。
- 远端 SHA 不一致：停止重启和公告，检查同步目标后重新同步完整 `lib/`。
- PM2 `online` 但没有“命令注册完成”：视为发布失败，检查 stdout 中的模块加载错误。
- OneBot 未连接：检查 `127.0.0.1:3011`、NapCat 容器和 WebSocket 日志。
- 世界状态取数失败：区分插件注册、OneBot 连接和外部 API；不要仅凭 PM2 `online` 判定服务可用。
- 发布脚本失败时不会发送成功公告。修复后重新走完整门禁，只在最终成功时公告一次。

## 7. 最短检查清单

```text
[ ] 本地改动全部完成
[ ] 定向测试通过
[ ] 出图预览已检查
[ ] yarn test 通过
[ ] yarn dtsc 通过
[ ] yarn build 通过，bundle 可加载
[ ] git diff --check 通过
[ ] dry-run 参数正确
[ ] 整批改动只正式发布一次
[ ] SSH 全程复用同一 ControlPath
[ ] PM2 online 且 Warframe 命令注册完成
[ ] 真实命令收到 OneBot 发送成功回执
[ ] 最终公告只发送一次
```
