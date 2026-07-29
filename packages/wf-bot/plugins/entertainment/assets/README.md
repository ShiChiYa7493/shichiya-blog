# Warframe 背景素材来源

签到卡和对战卡使用 Warframe Public Export 中的 Fragment Artwork 资源。运行时首次使用时从 `browse.wf` 下载并写入 `data/entertainment-backgrounds/`，后续渲染只读取本地缓存，不把外链直接交给 Puppeteer。

当前清单：

- [`Earth1_6213x4142.png`](https://browse.wf/Lotus/Interface/FragmentArtwork/Earth1_6213x4142.png) — 地球森林（星图/行星主题）
- [`Void1_3138x2092.png`](https://browse.wf/Lotus/Interface/FragmentArtwork/Void1_3138x2092.png) — 虚空遗迹（主线探索主题）
- [`Tennoorbiter_4827x3218.png`](https://browse.wf/Lotus/Interface/FragmentArtwork/Tennoorbiter_4827x3218.png) — 轨道飞行器（任务准备主题）
- [`Lotusconcept_2327x1551.png`](https://browse.wf/Lotus/Interface/FragmentArtwork/Lotusconcept_2327x1551.png) — Lotus（主线叙事主题）
- [`Derelict1_1535x1023.png`](https://browse.wf/Lotus/Interface/FragmentArtwork/Derelict1_1535x1023.png) — 废弃遗迹（支线/遗迹探索主题）

来源：<https://browse.wf/>（Warframe Public Export 镜像）。素材版权归 Digital Extremes，项目仅作为 Warframe 粉丝机器人使用；如项目公开部署或分发，请按 Digital Extremes 的最新 Fan Content Policy 核对使用范围。

这些资源的路径来自 Warframe Public Export；`browse.wf` 只是便于机器人部署的公开镜像，并非项目自带素材。背景按用户 ID 与日期固定轮换，同一用户当天签到和对战会看到一致的主题。若镜像暂时不可用，插件会自动回退为文字回复，不会阻塞积分或战斗结算。
