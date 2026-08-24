# Warframe 实时噩梦节点获取方案

- 生成日期: 2026-08-06
- 结果目录: `docs/research/warframe-nightmare-live-nodes/results`
- 已纳入对象数: 5

## 目录

1. [Authenticated Game and Companion Channels](#authenticated-game-and-companion-channels)
2. [Deterministic Rotation Reconstruction](#deterministic-rotation-reconstruction)
3. [Official World State and Public Export](#official-world-state-and-public-export)
4. [Open Source Bots and Trackers](#open-source-bots-and-trackers)
5. [Warframe Community API Ecosystem](#warframe-community-api-ecosystem)

## Authenticated Game and Companion Channels

- 来源文件: `docs/research/warframe-nightmare-live-nodes/results/authenticated-game-and-companion-channels.json`
- 不确定字段: update_latency

### Availability

- **provides_live_nodes**: 游戏客户端可以显示玩家当前可见的噩梦节点；没有证据表明官方 Companion 提供独立、稳定、可公开调用的噩梦列表端点。
- **access_method**: 游戏客户端在本地根据全局轮换和账户的星球完成/本轮完成状态生成 CachedSkullNodes。账户任务完成上报携带节点与 nightmareMode 标志，而不是由世界状态响应下发节点。
- **authentication**: 游戏客户端需要玩家会话；公开重建全局节点不需要认证。
- **observable_fields**: 客户端可见全局候选节点、玩家是否解锁该星球以及本轮是否已经完成；后两项属于账户个体状态。

### Reliability

- **source_of_truth**: 节点选择是客户端计算；玩家解锁与完成记录来自账户状态。
- **maintenance_status**: 游戏客户端当然有效，但协议和内部接口未公开且会随版本变化。
#### evidence

- url: https://github.com/Gipn0za/warframe-lua-dump/blob/main/dis/Lotus/Interface/Background.lua | accessed_at: 2026-08-06 | finding: 生成函数先检查区域完成状态和 periodic mission 完成状态，再把合格节点写入 CachedSkullNodes。
- url: https://github.com/Gipn0za/warframe-lua-dump/blob/main/dis/Lotus/Interface/LotusNetworkUtilities.lua | accessed_at: 2026-08-06 | finding: 启动噩梦任务时设置 periodicMissionTag=NightmareRegion{region} 和 periodicMissionCooldown=28800。
- url: https://github.com/SpaceNinjaServer/SpaceNinjaServer/blob/master/src/services/missionInventoryUpdateService.ts | accessed_at: 2026-08-06 | finding: 任务完成请求使用 rewardInfo.node 与 rewardInfo.nightmareMode，支持节点由客户端先确定的判断。

### Integration

- **implementation_fit**: 机器人应发布不含个人完成状态的全局节点。若未来提供个人完成提醒，应让用户自行勾选或在机器人侧记录，不应索取 Warframe 账号、密码或会话令牌。
- **security_legal_risk**: 高于公开重建。保存游戏凭证、抓取私有接口或模拟客户端会增加账号安全、协议变化和服务条款风险。
- **recommendation**: 不采用认证接口；只把游戏客户端列表作为人工校准基准。
- **confidence**: medium：客户端和私服源码支持计算流程，但官方 Companion 的完整当前协议未公开。

### Other Info

- **name**: Authenticated Game and Companion Channels
- **category**: authenticated
- **url**: https://github.com/Gipn0za/warframe-lua-dump/blob/main/dis/Lotus/Interface/Background.lua
- **accessed_at**: 2026-08-06
- **finding**: 生成函数先检查区域完成状态和 periodic mission 完成状态，再把合格节点写入 CachedSkullNodes。

## Deterministic Rotation Reconstruction

- 来源文件: `docs/research/warframe-nightmare-live-nodes/results/deterministic-rotation-reconstruction.json`
- 不确定字段: 2026_client_filter_exactness, dynamic_conflict_snapshot_timing, full_get_node_list_order, railjack_internal_region_assignment, srandomint_test_vectors

### Availability

- **provides_live_nodes**: 理论上可由客户端算法本地重建，但目前缺少客户端完整 GetNodeList 顺序和 2026 游戏内真值，现有实现不能视为准确实时源。
- **access_method**: > 领先候选为 seed=floor(worldState.Time/28800)：客户端调用独立的原生轮换种子函数，随后设置全局随机种子；ShuffleTable 默认使用引擎 SRandomInt(1,n) 对每个区域做倒序 Fisher-Yates。必须按客户端 GetNodeList 的完整原始顺序先将所有节点（包括随后会被过滤的 Hub、Junction 等）分组并洗牌，最后才应用静态及动态排除条件。官方 Public Export 的 269 个节点不是完整 GetNodeList，不能单独作为已确认节点池。
- **authentication**: 不需要认证。
- **observable_fields**: 可生成星球、节点、普通任务类型、8 小时轮换起止时间；不能知道某个玩家是否已解锁星球或是否已领取本轮奖励。噩梦修正条件不是节点选择阶段下发的固定字段。

### Reliability

- **update_latency**: 算法本身可即时计算，轮换边界为 UTC 00:00、08:00、16:00。没有证据要求固定等待 1-3 分钟；应以官方 worldState.Time 判断 seed，仅在接口缓存或网络时钟未跨界时短暂重试。客户端同一 seed 会复用 CachedSkullNodes，因此动态冲突集合取决于客户端本轮首次生成时刻。
- **source_of_truth**: 官方服务器时间 + 客户端完整星图节点数组及顺序 + 客户端 SRandomInt 实现 + 本轮首次生成时的世界状态冲突集合。Public Export 只能提供其中一部分静态节点。
- **maintenance_status**: 8 小时轮换和总体流程自 Recurring Nightmares 后长期稳定；2022 Lua 与 2026 Wiki 相互印证。2026 完整节点数组、精确区域归属和新区域过滤代码未公开。
#### evidence

- url: https://wiki.warframe.com/w/Nightmare_Mode#Mechanics | accessed_at: 2026-08-06 | finding: 当前页面说明每个合格星球一个随机节点、所有玩家共享节点、每 8 小时轮换；排除 Empyrean Proximas、Zariman、Deimos 的 Albrecht's Laboratories 与 Hollvania。
- url: https://wiki.warframe.com/w/Nightmare_Mode/Rewards | accessed_at: 2026-08-06 | finding: 当前奖励分组列出 18 个适用区域：Mercury、Venus、Earth、Mars、Phobos、Ceres、Jupiter、Europa、Void、Lua、Kuva Fortress、Deimos、Saturn、Uranus、Nept...
- url: https://github.com/Gipn0za/warframe-lua-dump/blob/main/dis/Lotus/Interface/Background.lua | accessed_at: 2026-08-06 | finding: 算法从 GetNodeList 取得完整节点数组，按 region 分组全部节点，设置一次全局随机种子并逐区域调用 ShuffleTable；洗牌完成后才排除 Hub/Junction、突击、裂缝、警报、入侵、活动、集团任务及特殊任务类型...
- url: https://github.com/Gipn0za/warframe-lua-dump/blob/main/dis/EE/Interface/Utilities.lua | accessed_at: 2026-08-06 | finding: ShuffleTable 在未传入随机函数时明确使用引擎全局 SRandomInt(1,n)，再执行倒序 Fisher-Yates；噩梦调用没有传入替代随机函数。
- url: https://github.com/calamity-inc/warframe-public-export-plus/commit/96180b982eaa61ac9f2e98b33a1d1bf8760fd15f | accessed_at: 2026-08-06 | finding: 项目曾一次补入官方 ExportRegions 缺失的 Hub、Junction、PvP、Sanctuary Onslaught、Railjack 等节点，证明 Public Export 不是客户端完整节点池；后续又按 Wiki 数据重...
- url: https://github.com/SpaceNinjaServer/SpaceNinjaServer/blob/master/src/services/rngService.ts | accessed_at: 2026-08-06 | finding: 社区私服实现提供了声称与客户端相同的 64 位 SRandomInt 算法，但公开仓库没有附带可由官方客户端独立复核的测试向量，因此仍需用实际噩梦节点校准。

### Integration

- **implementation_fit**: > 适合作为最终方向，但当前只能用于离线校准。应同时生成官方 269 节点、全部补充节点、排除 Railjack 补充节点、将 Railjack 归入 Deep Space 等候选方案，并与同一时间戳的游戏内 18 节点列表比较。只有找到连续轮换 18/18 一致的节点池顺序与 RNG 后，才应替换生产算法；生产结果仍需按 seed 持久化。
- **security_legal_risk**: 低，不需账号和私有接口。主要是正确性风险：公开节点表可能不等同于客户端 GetNodeList 的完整集合，新区域规则可能变化，动态冲突缓存也可能产生短暂偏差。
- **recommendation**: 保留为首选研究方向，但立即停止把当前 269 节点结果当作准确值。取得 PC 端同一轮完整 18 节点、截图时间、登录或首次打开星图时间及本轮是否完成过噩梦任务后做候选匹配；一轮可大量排除错误方案，连续三轮最适合确认节点池顺序、RNG 和动态冲突行为。
- **confidence**: medium-low：周期、种子入口、分组、洗牌调用和大部分过滤规则有源码支撑；完整节点池顺序、SRandomInt 独立测试向量、2026 过滤规则和游戏内真值仍缺失。

### Other Info

- **name**: Deterministic Rotation Reconstruction
- **category**: algorithm
- **url**: https://wiki.warframe.com/w/Nightmare_Mode#Mechanics
- **accessed_at**: 2026-08-06
- **finding**: 当前页面说明每个合格星球一个随机节点、所有玩家共享节点、每 8 小时轮换；排除 Empyrean Proximas、Zariman、Deimos 的 Albrecht's Laboratories 与 Hollvania。

## Official World State and Public Export

- 来源文件: `docs/research/warframe-nightmare-live-nodes/results/official-world-state-and-public-export.json`

### Availability

- **provides_live_nodes**: 否。官方 worldState.php 明确不包含 Nightmare Mode；Public Export 提供当前静态星图节点及顺序，但不标记本轮噩梦节点。
- **access_method**: 轮询 https://api.warframe.com/cdn/worldState.php 获取服务器 Time 和会影响选点的动态任务；通过 Public Export 的 index_en.txt.lzma 定位带哈希的 ExportRegions_en.json，取得官方公开的有序节点子集。
- **authentication**: 不需要认证。
- **observable_fields**: > worldState.php 可取得 Time、ActiveMissions、Alerts、Invasions、Goals、SyndicateMissions、Sorties、NodeOverrides 等；ExportRegions 可取得 uniqueName、systemIndex、节点名称、任务类型索引和阵营索引。两者都没有当前 Nightmare 节点字段。

### Reliability

- **update_latency**: worldState.php 可按分钟级轮询；噩梦本身按 8 小时轮换。没有证据要求固定延迟 1-3 分钟，应直接以响应中的官方 Time 判断是否跨界；若边界请求仍返回旧 Time，再做短暂重试。轮换中途持续用新的冲突任务重算会偏离客户端 CachedSkullNodes 行为。
- **source_of_truth**: 官方 worldState 是服务器时间和动态冲突任务的来源；Public Export 只覆盖部分静态星图节点。当前噩梦节点由客户端结合内部完整节点数组计算，而不是由服务端直接下发。
- **maintenance_status**: 活跃。2026-08-06 实测 worldState Time 为 1785981614，顶层无任何 nightmare 字段；当前 Public Export 含 269 个 ExportRegions 节点。
#### evidence

- url: https://api.warframe.com/cdn/worldState.php | accessed_at: 2026-08-06 | finding: 顶层字段无 NightmareModeMissions/nightmare；Time 可用，WorldSeed 是签名字符串。
- url: https://wiki.warframe.com/w/World_State#Not_Included | accessed_at: 2026-08-06 | finding: Wiki 的 Not Included 明确列出 Nightmare Mode；同页说明 WorldSeed 是 World State 的 RSA signature，而非可直接使用的轮换种子。
- url: https://content.warframe.com/PublicExport/index_en.txt.lzma | accessed_at: 2026-08-06 | finding: 索引提供当前 ExportRegions_en.json 的内容哈希；下载后的 269 个节点与 warframe-public-export-plus 0.6.6 的前 269 个对象键逐项一致，但客户端 GetNodeList 还会包...

### Integration

- **implementation_fit**: 适合作为本地重建的部分输入：以 Time 计算 8 小时种子，以 worldState 提供动态排除集合。ExportRegions 可提供普通星图节点字段，但不能独自构成客户端完整洗牌池；还需校准缺失特殊节点的原始顺序与内部区域归属。不能把 WorldSeed 解码后当噩梦种子。
- **security_legal_risk**: 低。只读取公开官方端点；需要缓存、合理限流并容忍字段变更。Public Export URL 含内容哈希，应先刷新索引，不能写死旧哈希。
- **recommendation**: 采用，作为重建方案的官方输入；不要期待官方端点直接返回实时噩梦列表。
- **confidence**: high：接口响应、Wiki 文档和本地实测互相一致。

### Other Info

- **name**: Official World State and Public Export
- **category**: official-public
- **url**: https://api.warframe.com/cdn/worldState.php
- **accessed_at**: 2026-08-06
- **finding**: 顶层字段无 NightmareModeMissions/nightmare；Time 可用，WorldSeed 是签名字符串。

## Open Source Bots and Trackers

- 来源文件: `docs/research/warframe-nightmare-live-nodes/results/open-source-bots-and-trackers.json`
- 不确定字段: update_latency

### Availability

- **provides_live_nodes**: 未发现可直接复用且持续维护的公开实时噩梦节点 API、机器人或跟踪器。
- **access_method**: 通过 GitHub 代码搜索 NightmareRegion、CachedSkullNodes、nightmareMode，并检查公开 Warframe 机器人、状态项目与 Lua 转储。
- **authentication**: 公开代码无需认证；GitHub 搜索受 API 配额限制。
- **observable_fields**: 可找到旧客户端的生成逻辑和私服中的任务完成字段，但没有可信的实时节点列表服务。

### Reliability

- **source_of_truth**: 反编译客户端逻辑、公开静态数据和社区实现。
- **maintenance_status**: rogerxiii 转储停在 2020；Gipn0za 转储标注为 2022-07-28；Gudov 转储停在 2019。SpaceNinjaServer 在 2026-08 仍活跃，但它是私服实现，不是实时公共节点 API。
#### evidence

- url: https://github.com/Gipn0za/warframe-lua-dump/blob/main/dis/Lotus/Interface/Background.lua | accessed_at: 2026-08-06 | finding: 2022 客户端逻辑仍按区域分组、设置轮换种子并依次洗牌；排除 Dojo、Dark Sector、Deep Space、Zariman 和多类特殊任务。
- url: https://github.com/rogerxiii/warframe-lua-disassembled/blob/master/lua/Lotus/Interface/Background.lua | accessed_at: 2026-08-06 | finding: 2020 代码提供完整生成流程，但地域规则早于 Deimos/Zariman/Hollvania，不能直接视为 2026 规则。
- url: https://github.com/SpaceNinjaServer/SpaceNinjaServer/blob/master/src/services/rngService.ts | accessed_at: 2026-08-06 | finding: 提供声称与客户端一致的 SRng 线性同余算法及 Fisher-Yates shuffle，可用于可重复原型。

### Integration

- **implementation_fit**: 应复用已验证的 SRng 数学实现思路，但不能依赖任何私服。算法代码应在机器人内独立实现，并以固定种子测试向量锁定行为。
- **security_legal_risk**: 反编译来源只能作为互操作研究证据；不要分发游戏资源、绕过认证或连接私有游戏接口。开源代码复用前需单独核对许可证。
- **recommendation**: 仅将客户端逻辑和 RNG 实现用于研究/重建；没有可采用的第三方实时 API。
- **confidence**: medium：算法证据强，但最新公开 Lua 转储只到 2022，2026 新区域过滤仍需实测校准。

### Other Info

- **name**: Open Source Bots and Trackers
- **category**: open-source
- **url**: https://github.com/Gipn0za/warframe-lua-dump/blob/main/dis/Lotus/Interface/Background.lua
- **accessed_at**: 2026-08-06
- **finding**: 2022 客户端逻辑仍按区域分组、设置轮换种子并依次洗牌；排除 Dojo、Dark Sector、Deep Space、Zariman 和多类特殊任务。

## Warframe Community API Ecosystem

- 来源文件: `docs/research/warframe-nightmare-live-nodes/results/warframe-community-api-ecosystem.json`

### Availability

- **provides_live_nodes**: 否。WarframeStat.us 当前 PC 响应没有 nightmare/nightmares 字段，WFCD 的世界状态解析生态也没有产生实时噩梦列表。
- **access_method**: 可查询 https://api.warframestat.us/pc 以及 WFCD 的 warframe-status、warframe-worldstate-parser 源码，但只能取得它们已经从官方 worldState 解析出的内容。
- **authentication**: 不需要认证。
- **observable_fields**: 可取得警报、裂缝、入侵、突击、集团任务等常见世界状态；不能取得当前噩梦星球、节点或本轮完成状态。

### Reliability

- **update_latency**: 社区 API 通常为分钟级缓存，但对噩梦无数据，因此延迟指标不适用。
- **source_of_truth**: 官方 worldState.php 的二次解析，并非独立噩梦来源。
- **maintenance_status**: WarframeStat.us 可用；其返回字段截至 2026-08-06 仍无噩梦。
#### evidence

- url: https://api.warframestat.us/pc | accessed_at: 2026-08-06 | finding: nightmare 与 nightmares 查询均为 null，顶层 keys 不含相关字段。
- url: https://github.com/WFCD/warframe-status | accessed_at: 2026-08-06 | finding: 社区状态服务依赖官方世界状态，不包含独立噩梦采集链路。
- url: https://github.com/WFCD/warframe-worldstate-parser | accessed_at: 2026-08-06 | finding: 解析器没有可供消费的实时 Nightmare 节点模型。

### Integration

- **implementation_fit**: 可继续用作其他 Warframe 数据来源，但不应为噩梦功能增加对 WarframeStat.us 的依赖。本地重建仍需直接使用官方 Time 和静态节点数据。
- **security_legal_risk**: 低，但增加第三方可用性和缓存延迟风险，且无法解决噩梦数据缺失。
- **recommendation**: 拒绝作为噩梦节点来源；仅保留为其他世界状态功能的可选上游。
- **confidence**: high：已检查实时响应和相关开源项目的数据边界。

### Other Info

- **name**: Warframe Community API Ecosystem
- **category**: community-api
- **url**: https://api.warframestat.us/pc
- **accessed_at**: 2026-08-06
- **finding**: nightmare 与 nightmares 查询均为 null，顶层 keys 不含相关字段。
