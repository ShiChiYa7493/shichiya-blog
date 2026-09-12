# Warframe 背景素材来源

签到卡和对战卡使用 Warframe Public Export 中的 Fragment Artwork 资源。运行时首次使用时从 `browse.wf` 下载并写入 `data/entertainment-backgrounds/`，后续渲染只读取本地缓存，不把外链直接交给 Puppeteer。

当前共 25 张，分为两组：

场景与星图：

- [`Earth1_6213x4142.png`](https://browse.wf/Lotus/Interface/FragmentArtwork/Earth1_6213x4142.png) — 地球森林（星图/行星主题）
- [`Void1_3138x2092.png`](https://browse.wf/Lotus/Interface/FragmentArtwork/Void1_3138x2092.png) — 虚空遗迹（主线探索主题）
- [`Tennoorbiter_4827x3218.png`](https://browse.wf/Lotus/Interface/FragmentArtwork/Tennoorbiter_4827x3218.png) — 轨道飞行器（任务准备主题）
- [`Lotusconcept_2327x1551.png`](https://browse.wf/Lotus/Interface/FragmentArtwork/Lotusconcept_2327x1551.png) — Lotus（主线叙事主题）
- [`Derelict1_1535x1023.png`](https://browse.wf/Lotus/Interface/FragmentArtwork/Derelict1_1535x1023.png) — 废弃遗迹（支线/遗迹探索主题）

主线、序章与支线任务：

- [`AwakeningQuestKeychain.png`](https://browse.wf/Lotus/Interface/Quests/AwakeningQuestKeychain.png) — 觉醒
- [`VorsPrizeQuestKeyChain.png`](https://browse.wf/Lotus/Interface/Quests/VorsPrizeQuestKeyChain.png) — 沃尔的战利品
- [`SentientQuestKeyChain.png`](https://browse.wf/Lotus/Interface/Quests/SentientQuestKeyChain.png) — Natah
- [`OrokinMoonQuestKeyChain.png`](https://browse.wf/Lotus/Interface/Quests/OrokinMoonQuestKeyChain.png) — 第二梦
- [`TheWarWithinQuestKeychain.png`](https://browse.wf/Lotus/Interface/Quests/TheWarWithinQuestKeychain.png) — 内战
- [`ApostasyPrologueStartQuestKeyChain.png`](https://browse.wf/Lotus/Interface/Quests/ApostasyPrologueStartQuestKeyChain.png) — 变节序言
- [`SacrificeQuestKeyChain.png`](https://browse.wf/Lotus/Interface/Quests/SacrificeQuestKeyChain.png) — 牺牲
- [`ChimeraKeyChain.png`](https://browse.wf/Lotus/Interface/Quests/ChimeraKeyChain.png) — 奇美拉序言
- [`NewWarIntroQuestKeychain.png`](https://browse.wf/Lotus/Interface/Quests/NewWarIntroQuestKeychain.png) — 新纪之战序章
- [`TheNewWarQuestKeyChain.png`](https://browse.wf/Lotus/Interface/Quests/TheNewWarQuestKeyChain.png) — 新纪之战
- [`AngelsOfTheZarimanQuestKeychain.png`](https://browse.wf/Lotus/Interface/Quests/AngelsOfTheZarimanQuestKeychain.png) — 扎里曼的天使
- [`JadeShadowsQuestKeychain.png`](https://browse.wf/Lotus/Interface/Quests/JadeShadowsQuestKeychain.png) — 翠玉暗影
- [`EntratiQuestKeyChain.png`](https://browse.wf/Lotus/Interface/Quests/EntratiQuestKeyChain.png) — 墙中低语
- [`DuviriParadoxMain.png`](https://browse.wf/Lotus/Interface/Quests/Duviri/DuviriParadoxMain.png) — 双衍悖论
- [`1999QuestKeyChain.png`](https://browse.wf/Lotus/Interface/Quests/1999QuestKeyChain.png) — Warframe：1999
- [`DeadlockProtocolQuestKeychain.png`](https://browse.wf/Lotus/Interface/Quests/DeadlockProtocolQuestKeychain.png) — 僵局协议
- [`HeartOfDeimosKeychain.png`](https://browse.wf/Lotus/Interface/Quests/HeartOfDeimosKeychain.png) — 惊惧之心
- [`SolarisQuestKeyChain.png`](https://browse.wf/Lotus/Interface/Quests/SolarisQuestKeyChain.png) — 索拉里斯之声
- [`TempestariiQuestKeychain.png`](https://browse.wf/Lotus/Interface/Quests/TempestariiQuestKeychain.png) — 风暴的呼唤
- [`VeilbreakerQuestKeychain.png`](https://browse.wf/Lotus/Interface/Quests/VeilbreakerQuestKeychain.png) — 破障者

来源：<https://browse.wf/>（Warframe Public Export 镜像）。素材版权归 Digital Extremes，项目仅作为 Warframe 粉丝机器人使用；如项目公开部署或分发，请按 Digital Extremes 的最新 Fan Content Policy 核对使用范围。

这些资源的路径来自 Warframe Public Export；`browse.wf` 只是便于机器人部署的公开镜像，并非项目自带素材。背景按用户 ID 与日期固定轮换，同一用户当天签到和对战会看到一致的主题。若镜像暂时不可用，插件会自动回退为文字回复，不会阻塞积分或战斗结算。

外观商店的签到背景在 `assets/cosmetics/backgrounds/`，构建时复制到 `lib/assets/cosmetics/backgrounds/`。商店出图使用 `assets/cosmetics/thumbs/` 里最长边 240px、JPEG 压缩后的缩略图。未装备商店背景时仍使用上面的官方图；装备后签到卡改用对应本地图。
