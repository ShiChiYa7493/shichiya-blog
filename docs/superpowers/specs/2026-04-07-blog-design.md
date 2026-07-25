# Shichiya Blog - Design Spec

## Overview

A personal blog website for mixed content (tech + life), featuring an editorial/magazine visual style, admin panel with Markdown editor, and comment system.

**Server environment**: Ubuntu, Node.js 20, Nginx, PostgreSQL, PM2 (already configured at 1.116.119.240).

## System Architecture

```
Browser
  |
  v
Nginx (80/443)
  |-- /api/*     -> NestJS API (port 3001)
  |-- /uploads/* -> Static files (direct serve)
  |-- /*         -> Next.js SSR (port 3000)

NestJS API ---- PostgreSQL (blogdb, user: shichiya)
                     ^
Next.js SSR ---------| (via NestJS API calls)
```

- **Frontend**: Next.js 14, App Router, SSR
- **Backend**: NestJS, REST API, JWT auth
- **Database**: PostgreSQL + Prisma ORM
- **Deployment**: PM2 process management, Nginx reverse proxy
- **Monorepo**: npm workspaces

## Project Structure

```
shichiya-blog/
├── packages/
│   ├── frontend/              # Next.js 14 (App Router)
│   │   ├── src/
│   │   │   ├── app/           # Page routes
│   │   │   ├── components/    # React components
│   │   │   ├── lib/           # API calls, utilities
│   │   │   └── styles/        # Global styles
│   │   └── package.json
│   │
│   └── server/                # NestJS API
│       ├── src/
│       │   ├── modules/
│       │   │   ├── auth/      # JWT authentication
│       │   │   ├── article/   # Article CRUD
│       │   │   ├── category/  # Category management
│       │   │   ├── tag/       # Tag management
│       │   │   ├── comment/   # Comment system
│       │   │   ├── upload/    # Image upload
│       │   │   └── stats/     # Statistics
│       │   ├── prisma/        # Prisma schema & migrations
│       │   └── common/        # Guards, interceptors, filters
│       └── package.json
│
├── uploads/                   # Uploaded images (Nginx serves directly)
├── package.json               # Workspace root
├── ecosystem.config.js        # PM2 config
└── .gitignore
```

## Database Schema

### admin

| Column     | Type         | Notes            |
|------------|--------------|------------------|
| id         | Int (PK)     | Auto increment   |
| username   | String       | Unique           |
| password   | String       | Bcrypt hashed    |
| nickname   | String       |                  |
| avatar     | String?      | Avatar URL       |
| created_at | DateTime     | Default now()    |
| updated_at | DateTime     | Auto update      |

### category

| Column     | Type         | Notes            |
|------------|--------------|------------------|
| id         | Int (PK)     | Auto increment   |
| name       | String       | Unique           |
| slug       | String       | Unique, URL-safe |
| sort_order | Int          | Default 0        |
| created_at | DateTime     | Default now()    |

### tag

| Column     | Type         | Notes            |
|------------|--------------|------------------|
| id         | Int (PK)     | Auto increment   |
| name       | String       | Unique           |
| slug       | String       | Unique, URL-safe |
| created_at | DateTime     | Default now()    |

### article

| Column       | Type         | Notes                          |
|--------------|--------------|--------------------------------|
| id           | Int (PK)     | Auto increment                 |
| title        | String       |                                |
| slug         | String       | Unique, for SEO-friendly URLs  |
| summary      | String?      | Article excerpt                |
| content      | Text         | Markdown content               |
| cover_image  | String?      | Cover image URL                |
| status       | Enum         | DRAFT / PUBLISHED              |
| category_id  | Int (FK)     | References category            |
| view_count   | Int          | Default 0                      |
| created_at   | DateTime     | Default now()                  |
| updated_at   | DateTime     | Auto update                    |
| published_at | DateTime?    | Set when status -> PUBLISHED   |

### article_tag (M:N join table)

| Column     | Type     | Notes              |
|------------|----------|--------------------|
| article_id | Int (FK) | References article  |
| tag_id     | Int (FK) | References tag      |

Composite primary key: (article_id, tag_id)

### comment

| Column     | Type         | Notes                         |
|------------|--------------|-------------------------------|
| id         | Int (PK)     | Auto increment                |
| article_id | Int (FK)     | References article            |
| nickname   | String       | Guest commenter name          |
| email      | String       | Guest commenter email         |
| content    | Text         | Comment body                  |
| status     | Enum         | PENDING / APPROVED / REJECTED |
| parent_id  | Int? (FK)    | Self-reference, nested replies|
| created_at | DateTime     | Default now()                 |

## API Design

### Public Endpoints (no auth)

| Method | Path                          | Description                              |
|--------|-------------------------------|------------------------------------------|
| GET    | /api/articles                 | Article list (paginated, filter by category/tag) |
| GET    | /api/articles/:slug           | Article detail (increments view_count)   |
| GET    | /api/categories               | Category list                            |
| GET    | /api/tags                     | Tag list                                 |
| GET    | /api/articles/:slug/comments  | Comments for article (approved only)     |
| POST   | /api/articles/:slug/comments  | Submit comment (guest)                   |
| GET    | /api/search?q=keyword         | Full-text search                         |
| GET    | /api/rss                      | RSS feed                                 |

### Admin Endpoints (JWT required)

| Method | Path                       | Description              |
|--------|----------------------------|--------------------------|
| POST   | /api/admin/login           | Login, returns JWT       |
| GET    | /api/admin/profile         | Get admin profile        |
| PUT    | /api/admin/profile         | Update admin profile     |
| POST   | /api/admin/articles        | Create article           |
| PUT    | /api/admin/articles/:id    | Update article           |
| DELETE | /api/admin/articles/:id    | Delete article           |
| POST   | /api/admin/upload          | Upload image             |
| GET    | /api/admin/categories      | List categories          |
| POST   | /api/admin/categories      | Create category          |
| PUT    | /api/admin/categories/:id  | Update category          |
| DELETE | /api/admin/categories/:id  | Delete category          |
| GET    | /api/admin/tags            | List tags                |
| POST   | /api/admin/tags            | Create tag               |
| PUT    | /api/admin/tags/:id        | Update tag               |
| DELETE | /api/admin/tags/:id        | Delete tag               |
| GET    | /api/admin/comments        | List all comments        |
| PUT    | /api/admin/comments/:id    | Approve/reject comment   |
| DELETE | /api/admin/comments/:id    | Delete comment           |
| GET    | /api/admin/stats           | Dashboard stats          |

## Frontend Pages

### Public Pages

| Page         | Route               | Description                                    |
|--------------|---------------------|------------------------------------------------|
| Home         | /                   | Magazine-style grid, featured article + cards  |
| Article      | /posts/[slug]       | Markdown render, TOC sidebar, comment section  |
| Category     | /categories/[slug]  | Articles filtered by category                  |
| Tag          | /tags/[slug]        | Articles filtered by tag                       |
| Archives     | /archives           | Timeline view of all articles                  |
| Search       | /search             | Search results page                            |
| About        | /about              | Personal introduction                          |

### Admin Pages

| Page              | Route                      | Description                  |
|-------------------|----------------------------|------------------------------|
| Login             | /admin/login               | JWT login form               |
| Dashboard         | /admin                     | Stats overview               |
| Article List      | /admin/articles            | List, filter, delete         |
| New Article       | /admin/articles/new        | Markdown editor + preview    |
| Edit Article      | /admin/articles/[id]/edit  | Edit existing article        |
| Categories        | /admin/categories          | CRUD categories              |
| Tags              | /admin/tags                | CRUD tags                    |
| Comments          | /admin/comments            | Review/delete comments       |
| Settings          | /admin/settings            | Profile, avatar, password    |

## Visual Design: Editorial / Magazine Style

- **Layout**: Magazine-style grid on homepage — hero article with large image + card grid below
- **Typography hierarchy**: Clear size/weight distinction between headings and body
- **Chinese fonts**: Noto Serif SC / Noto Sans SC, body 16-18px, line-height 1.8
- **Color palette**: Black/white primary, category-specific color accents
- **Code blocks**: Dark theme, contrasting with body text
- **Navigation**: Top bar with logo + category links
- **Responsive**: Mobile-first, adapts to all screen sizes

## Technology Stack

| Module            | Technology                        |
|-------------------|-----------------------------------|
| Frontend Framework| Next.js 14 (App Router)           |
| Backend Framework | NestJS                            |
| ORM               | Prisma                            |
| CSS               | Tailwind CSS                      |
| Markdown Render   | react-markdown + remark/rehype    |
| Markdown Editor   | @uiw/react-md-editor             |
| Code Highlighting | rehype-highlight                  |
| Image Upload      | Multer                            |
| Auth              | @nestjs/jwt + @nestjs/passport    |
| Validation        | class-validator + class-transformer|
| Search            | PostgreSQL full-text (pg_trgm)    |

## Deployment

### Nginx Config

```nginx
server {
    listen 80;
    server_name 1.116.119.240;

    location /uploads/ {
        alias /home/shichiya/shichiya-blog/uploads/;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### PM2 Config (ecosystem.config.js)

```js
module.exports = {
  apps: [
    {
      name: 'blog-api',
      cwd: './packages/server',
      script: 'dist/main.js',
      env: { PORT: 3001, NODE_ENV: 'production' }
    },
    {
      name: 'blog-web',
      cwd: './packages/frontend',
      script: 'node_modules/.bin/next',
      args: 'start',
      env: { PORT: 3000, NODE_ENV: 'production' }
    }
  ]
};
```

### Deploy Flow

```
Local dev -> git push -> Server: git pull -> npm install -> build -> pm2 restart
```

### .gitignore

```
node_modules/
packages/frontend/.next/
packages/server/dist/
.env
.env.local
.env.production
packages/frontend/.env*
packages/server/.env*
uploads/*
!uploads/.gitkeep
packages/server/src/prisma/generated/
.DS_Store
.vscode/
.idea/
*.log
.superpowers/
```

## Environment Variables

### packages/server/.env

```
DATABASE_URL=postgresql://shichiya:7493@localhost:5432/blogdb
JWT_SECRET=<random-secret>
PORT=3001
```

### packages/frontend/.env.local

```
API_URL=http://127.0.0.1:3001
NEXT_PUBLIC_SITE_URL=http://1.116.119.240
```
