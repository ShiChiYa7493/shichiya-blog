# shichiya-blog ⚓

> 今乗り越え 未来へと **Weigh Anchor!** — 跨越现今，前往未来，起锚吧！

[![站点](https://img.shields.io/badge/site-shichiya.cn-2563eb?logo=vercel&logoColor=white)](https://shichiya.cn)
[![License](https://img.shields.io/badge/license-Apache_2.0-blue)](./LICENSE)
[![备案](https://img.shields.io/badge/ICP-蜀ICP备2026017856号-lightgrey)](https://beian.miit.gov.cn/)

优川七夜的个人博客 —— 一个 monorepo 全栈应用，前后端分离，自带后台管理与图床。

---

## ✨ 功能

- **博客前台**：首页、文章详情、分类 / 标签筛选、归档、全文搜索、相册、关于、RSS
- **后台管理**：文章 Markdown 编辑、分类 / 标签管理、评论审核、相册及分类管理、站点设置
- **文章特性**：Markdown + 代码高亮、自动目录、阅读量统计（按日去重）
- **评论系统**：树形回复、可选审核、邮箱标记
- **相册**：分类归档、图片直传

## 🛠️ 技术栈

| 层 | 技术 |
| --- | --- |
| 前端 | Next.js 14 (App Router) · React · Tailwind CSS · shadcn/ui · framer-motion |
| 后端 | NestJS 10 · Prisma 6 · PostgreSQL · JWT (passport) |
| 部署 | PM2 · Nginx · Let's Encrypt (certbot) |
| 工程 | npm workspaces · TypeScript |

## 📁 目录结构

```
shichiya-blog/
├── packages/
│   ├── frontend/                    Next.js 应用（端口 3000）
│   │   └── src/app/
│   │       ├── blog/                博客前台
│   │       └── admin/               后台管理
│   └── server/                      NestJS 应用（端口 3001）
│       ├── src/modules/             业务模块
│       │     article / auth / category / tag / comment /
│       │     gallery / gallery-category / stats / upload
│       └── prisma/                  schema、迁移、seed
├── uploads/                         上传文件（Nginx 直接 alias）
├── ecosystem.config.js              PM2 配置
└── nginx.conf.example               Nginx 反代示例
```

## 🚀 快速开始

### 环境要求

- Node.js ≥ 18
- PostgreSQL ≥ 14

### 首次安装

```bash
# 1. 拉取代码 & 装依赖
git clone https://github.com/ShiChiYa7493/shichiya-blog.git
cd shichiya-blog
npm install

# 2. 配置环境变量
cp packages/server/.env.example   packages/server/.env
cp packages/frontend/.env.example packages/frontend/.env
# 编辑两个 .env，至少填好 DATABASE_URL 与 JWT_SECRET

# 3. 初始化数据库（建表 + 建管理员）
npm run db:migrate
npx -w packages/server prisma db seed
```

> ⚠️ Seed 默认创建账号 `admin` / `admin123`，**首次登录后请立刻在后台修改密码**。

### 本地开发

```bash
npm run dev:server     # 后端 → http://localhost:3001
npm run dev:frontend   # 前端 → http://localhost:3000
```

前后端均支持热重载。访问 `http://localhost:3000/admin/login` 进入后台。

## 📦 部署

### 一键部署

服务器上拉好仓库并跑通过一次完整安装后，后续每次发布只需：

```bash
cd ~/shichiya-blog && npm run deploy
```

`npm run deploy` 等价于：`git pull → npm install → npm run db:migrate → npm run build → pm2 reload --update-env`。

### npm 脚本一览

| 命令 | 何时使用 |
| --- | --- |
| `npm run deploy` | 完整发布（代码 + DB + 重启） |
| `npm run db:migrate` | 仅应用 Prisma 迁移并重新生成 client |
| `npm run build` | 仅构建 server + frontend |
| `npm run dev:server` / `dev:frontend` | 开发模式 |

### 运行时拓扑

```
Internet ──► Nginx (80/443, TLS) ──┬─► 127.0.0.1:3000   blog-web (Next.js)
                                    └─► 127.0.0.1:3001   blog-api (NestJS)
                                  alias /uploads/  ──►  /home/.../uploads/
```

| PM2 进程 | 端口 | 监听地址 | 说明 |
| --- | --- | --- | --- |
| `blog-web` | 3000 | 127.0.0.1 | Next.js `next start` |
| `blog-api` | 3001 | 127.0.0.1 | NestJS 编译后产物 |

> 🔒 两个服务**仅监听回环**，公网入口由 Nginx 收拢，端口 3000/3001 不对外暴露。

### Nginx & HTTPS

参考 `nginx.conf.example` 编写实际配置。HTTPS 由 certbot 自动签发与续期：

```bash
sudo certbot --nginx -d shichiya.cn -d www.shichiya.cn -d blog.shichiya.cn
```

## 🔧 常用运维

```bash
pm2 status                          # 查看进程状态
pm2 logs blog-api --lines 100       # 查看 API 日志
pm2 logs blog-web --lines 100       # 查看前端日志
sudo systemctl reload nginx         # 重载 Nginx
sudo certbot certificates           # 查看证书到期时间
ss -tlnp | grep -E ':(3000|3001)'   # 确认服务只监听 127.0.0.1
```

## ⚙️ 环境变量

详见 `packages/{server,frontend}/.env.example`。关键项：

| 变量 | 用途 | 示例 |
| --- | --- | --- |
| `DATABASE_URL` | PostgreSQL 连接串 | `postgresql://user:pass@localhost:5432/db` |
| `JWT_SECRET` | JWT 签名密钥（自行生成长随机串） | `openssl rand -base64 48` |
| `SITE_URL` | 站点对外 URL（用于 RSS / sitemap） | `https://shichiya.cn` |
| `HOST` / `PORT` | 后端监听地址与端口 | `127.0.0.1` / `3001` |
| `API_URL` | 前端 SSR 调用后端的地址 | `http://127.0.0.1:3001` |

## 🗃️ 数据模型

```
Admin                                 # 后台账号（bcrypt 密码）
Category   ──► Article ◄── Tag        # 文章及其分类、标签（多对多）
                  └─── Comment        # 评论（树形 parent / replies）
GalleryCategory ──► GalleryImage      # 相册分类与图片
```

主要约束：

- `Article.status`：`DRAFT` / `PUBLISHED`
- `Comment.status`：`PENDING` / `APPROVED` / `REJECTED`，支持 `parentId` 自关联做回复
- `GalleryImage.categoryId` 可空，分类删除时置空（`SetNull`）

## 📜 License

[Apache License 2.0](./LICENSE) © 2026 优川七夜
