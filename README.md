# shichiya-blog

> 优川七夜的个人博客系统 — Weigh Anchor!

[![站点](https://img.shields.io/badge/site-shichiya.cn-blue)](https://shichiya.cn)
[![备案](https://img.shields.io/badge/ICP-蜀ICP备2026017856号-lightgrey)](https://beian.miit.gov.cn/)

基于 NestJS + Next.js 的全栈博客，含文章、分类、标签、评论、相册、统计等模块，支持 Markdown 写作与后台管理。

## 技术栈

| 层 | 技术 |
| --- | --- |
| 前端 | Next.js 14 (App Router) · React · Tailwind CSS · shadcn/ui · framer-motion |
| 后端 | NestJS · Prisma · PostgreSQL · JWT · Passport |
| 部署 | PM2 · Nginx · Let's Encrypt |
| 工程 | npm workspaces · TypeScript |

## 目录结构

```
shichiya-blog/
├── packages/
│   ├── frontend/         Next.js 应用（端口 3000）
│   │   └── src/app/
│   │       ├── blog/     博客前台（首页、文章、分类、标签、归档、相册、关于）
│   │       └── admin/    后台管理（登录、文章、评论、相册、设置）
│   └── server/           NestJS 应用（端口 3001）
│       ├── src/modules/  article / auth / category / tag / comment /
│       │                 gallery / gallery-category / stats / upload
│       └── prisma/       数据模型与迁移
├── uploads/              用户上传文件（被 Nginx 直接 alias）
├── ecosystem.config.js   PM2 配置
└── nginx.conf.example    Nginx 反代示例
```

## 快速开始

### 环境要求

- Node.js ≥ 18
- PostgreSQL ≥ 14

### 安装与配置

```bash
git clone https://github.com/ShiChiYa7493/shichiya-blog.git
cd shichiya-blog
npm install

# 配置环境变量
cp packages/server/.env.example   packages/server/.env
cp packages/frontend/.env.example packages/frontend/.env
# 编辑 .env，填入 DATABASE_URL、JWT_SECRET 等

# 初始化数据库
npm run -w packages/server prisma migrate deploy
npm run -w packages/server prisma generate
```

### 开发

```bash
npm run dev:server     # 启动后端（http://localhost:3001）
npm run dev:frontend   # 启动前端（http://localhost:3000）
```

### 构建

```bash
npm run build          # 同时构建 server 与 frontend
```

## 部署

生产环境采用 **PM2 + Nginx** 部署：

```bash
# 拉取最新代码并构建
git pull
npm install
npm run build
npx -w packages/server prisma migrate deploy

# 重载服务
pm2 reload ecosystem.config.js --update-env
```

PM2 进程：

| 名称 | 端口 | 监听地址 |
| --- | --- | --- |
| `blog-api` | 3001 | 127.0.0.1（仅回环） |
| `blog-web` | 3000 | 127.0.0.1（仅回环） |

Nginx 负责对外提供 80/443，反代到上述本地端口。HTTPS 由 Let's Encrypt 通过 certbot 自动续期。

参考 `nginx.conf.example` 编写实际站点配置。

## 环境变量

详见 `packages/server/.env.example` 与 `packages/frontend/.env.example`。

**关键变量：**

- `DATABASE_URL` — PostgreSQL 连接串
- `JWT_SECRET` — JWT 签名密钥（必须自行生成长随机串）
- `SITE_URL` — 站点对外 URL（用于 RSS、sitemap）
- `API_URL` — 前端 SSR 时调用后端的地址

## 数据模型

主要实体：

- **Admin** — 后台账号（用户名 + 密码，bcrypt 哈希）
- **Article** — 文章（草稿 / 已发布；归属分类、关联多个标签）
- **Category** / **Tag** — 文章分类与标签
- **Comment** — 评论（待审 / 通过 / 拒绝；支持回复树）
- **GalleryCategory** / **GalleryImage** — 相册分类与图片

## License

Apache License 2.0 © 2026 优川七夜 — 详见 [LICENSE](./LICENSE)
