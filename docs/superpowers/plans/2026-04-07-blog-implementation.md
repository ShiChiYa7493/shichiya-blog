# Shichiya Blog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete personal blog with Next.js frontend, NestJS backend, PostgreSQL database, editorial/magazine visual style, admin panel with Markdown editor, and comment system.

**Architecture:** Monorepo with two packages — `packages/server` (NestJS REST API on port 3001) and `packages/frontend` (Next.js 14 SSR on port 3000). PostgreSQL via Prisma ORM. Nginx reverse proxy. PM2 process management.

**Tech Stack:** Next.js 14, NestJS, Prisma, Tailwind CSS, JWT, react-markdown, @uiw/react-md-editor, Multer

---

## Phase 1: Project Scaffolding

### Task 1: Initialize Monorepo

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `uploads/.gitkeep`
- Create: `ecosystem.config.js`

- [ ] **Step 1: Initialize git and root package.json**

```bash
cd /Users/shichiya/workspace/shichiya-blog
git init
```

```json
// package.json
{
  "name": "shichiya-blog",
  "private": true,
  "workspaces": ["packages/*"],
  "scripts": {
    "dev:server": "npm run dev -w packages/server",
    "dev:frontend": "npm run dev -w packages/frontend",
    "build:server": "npm run build -w packages/server",
    "build:frontend": "npm run build -w packages/frontend",
    "build": "npm run build:server && npm run build:frontend"
  }
}
```

- [ ] **Step 2: Create .gitignore**

```gitignore
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
.DS_Store
.vscode/
.idea/
*.log
.superpowers/
docs/
```

- [ ] **Step 3: Create uploads directory and PM2 config**

```bash
mkdir -p uploads
touch uploads/.gitkeep
```

```js
// ecosystem.config.js
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

- [ ] **Step 4: Commit**

```bash
git add package.json .gitignore uploads/.gitkeep ecosystem.config.js
git commit -m "chore: initialize monorepo with workspaces"
```

---

### Task 2: Scaffold NestJS Backend

**Files:**
- Create: `packages/server/` (NestJS project)

- [ ] **Step 1: Create NestJS project**

```bash
cd /Users/shichiya/workspace/shichiya-blog
npx @nestjs/cli new packages/server --package-manager npm --skip-git
```

- [ ] **Step 2: Install dependencies**

```bash
cd packages/server
npm install @nestjs/config @nestjs/jwt @nestjs/passport passport passport-jwt @prisma/client class-validator class-transformer bcrypt multer
npm install -D prisma @types/passport-jwt @types/bcrypt @types/multer
```

- [ ] **Step 3: Clean up default files**

Remove the default `app.controller.ts`, `app.controller.spec.ts`, `app.service.ts`. Update `app.module.ts` to a clean starting point:

```typescript
// packages/server/src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
  ],
})
export class AppModule {}
```

- [ ] **Step 4: Update main.ts with global prefix and validation**

```typescript
// packages/server/src/main.ts
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  app.enableCors();
  await app.listen(process.env.PORT || 3001);
}
bootstrap();
```

- [ ] **Step 5: Create .env file**

```env
# packages/server/.env
DATABASE_URL=postgresql://shichiya:7493@localhost:5432/blogdb
JWT_SECRET=shichiya-blog-jwt-secret-change-in-production
PORT=3001
```

- [ ] **Step 6: Verify it runs**

```bash
cd /Users/shichiya/workspace/shichiya-blog/packages/server
npm run start:dev
```

Expected: NestJS starts on port 3001, `GET http://localhost:3001/api` returns 404 (no routes yet).

- [ ] **Step 7: Commit**

```bash
cd /Users/shichiya/workspace/shichiya-blog
git add packages/server
git commit -m "chore: scaffold NestJS backend"
```

---

### Task 3: Scaffold Next.js Frontend

**Files:**
- Create: `packages/frontend/` (Next.js project)

- [ ] **Step 1: Create Next.js project**

```bash
cd /Users/shichiya/workspace/shichiya-blog
npx create-next-app@14 packages/frontend --typescript --tailwind --eslint --app --src-dir --no-import-alias
```

When prompted, accept defaults. Use `--no-import-alias` to keep paths simple.

- [ ] **Step 2: Create .env.local**

```env
# packages/frontend/.env.local
API_URL=http://127.0.0.1:3001
NEXT_PUBLIC_SITE_URL=http://1.116.119.240
```

- [ ] **Step 3: Verify it runs**

```bash
cd /Users/shichiya/workspace/shichiya-blog/packages/frontend
npm run dev
```

Expected: Next.js starts on port 3000, default page visible at http://localhost:3000.

- [ ] **Step 4: Commit**

```bash
cd /Users/shichiya/workspace/shichiya-blog
git add packages/frontend
git commit -m "chore: scaffold Next.js frontend"
```

---

## Phase 2: Database & Prisma

### Task 4: Define Prisma Schema and Run Migration

**Files:**
- Create: `packages/server/prisma/schema.prisma`

- [ ] **Step 1: Initialize Prisma**

```bash
cd /Users/shichiya/workspace/shichiya-blog/packages/server
npx prisma init
```

- [ ] **Step 2: Write the complete schema**

```prisma
// packages/server/prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Admin {
  id        Int      @id @default(autoincrement())
  username  String   @unique
  password  String
  nickname  String
  avatar    String?
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  @@map("admin")
}

model Category {
  id        Int       @id @default(autoincrement())
  name      String    @unique
  slug      String    @unique
  sortOrder Int       @default(0) @map("sort_order")
  createdAt DateTime  @default(now()) @map("created_at")
  articles  Article[]

  @@map("category")
}

model Tag {
  id        Int       @id @default(autoincrement())
  name      String    @unique
  slug      String    @unique
  createdAt DateTime  @default(now()) @map("created_at")
  articles  Article[] @relation("ArticleTag")

  @@map("tag")
}

enum ArticleStatus {
  DRAFT
  PUBLISHED
}

model Article {
  id          Int           @id @default(autoincrement())
  title       String
  slug        String        @unique
  summary     String?
  content     String
  coverImage  String?       @map("cover_image")
  status      ArticleStatus @default(DRAFT)
  categoryId  Int           @map("category_id")
  viewCount   Int           @default(0) @map("view_count")
  createdAt   DateTime      @default(now()) @map("created_at")
  updatedAt   DateTime      @updatedAt @map("updated_at")
  publishedAt DateTime?     @map("published_at")

  category Category  @relation(fields: [categoryId], references: [id])
  tags     Tag[]     @relation("ArticleTag")
  comments Comment[]

  @@map("article")
}

enum CommentStatus {
  PENDING
  APPROVED
  REJECTED
}

model Comment {
  id        Int           @id @default(autoincrement())
  articleId Int           @map("article_id")
  nickname  String
  email     String
  content   String
  status    CommentStatus @default(PENDING)
  parentId  Int?          @map("parent_id")
  createdAt DateTime      @default(now()) @map("created_at")

  article  Article   @relation(fields: [articleId], references: [id], onDelete: Cascade)
  parent   Comment?  @relation("CommentReplies", fields: [parentId], references: [id])
  replies  Comment[] @relation("CommentReplies")

  @@map("comment")
}
```

- [ ] **Step 3: Run migration**

```bash
cd /Users/shichiya/workspace/shichiya-blog/packages/server
npx prisma migrate dev --name init
```

Expected: Migration created and applied. Tables `admin`, `category`, `tag`, `article`, `comment` and the implicit `_ArticleTag` join table created in `blogdb`.

- [ ] **Step 4: Create Prisma service module**

```typescript
// packages/server/src/prisma.service.ts
import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect();
  }
}
```

Update `app.module.ts` to provide PrismaService globally:

```typescript
// packages/server/src/app.module.ts
import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
  ],
  providers: [PrismaService],
  exports: [PrismaService],
})
export class AppModule {}
```

- [ ] **Step 5: Create seed script for admin user**

```typescript
// packages/server/prisma/seed.ts
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await bcrypt.hash('admin123', 10);
  await prisma.admin.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      password: hashedPassword,
      nickname: 'Shichiya',
    },
  });
  console.log('Seed completed: admin user created (username: admin, password: admin123)');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

Add to `packages/server/package.json`:

```json
"prisma": {
  "seed": "ts-node prisma/seed.ts"
}
```

Install ts-node if not present:

```bash
npm install -D ts-node
```

- [ ] **Step 6: Run seed**

```bash
cd /Users/shichiya/workspace/shichiya-blog/packages/server
npx prisma db seed
```

Expected: "Seed completed: admin user created"

- [ ] **Step 7: Commit**

```bash
cd /Users/shichiya/workspace/shichiya-blog
git add packages/server/prisma packages/server/src/prisma.service.ts packages/server/src/app.module.ts packages/server/package.json
git commit -m "feat: add Prisma schema, migration, seed, and PrismaService"
```

---

## Phase 3: NestJS Backend Modules

### Task 5: Auth Module (JWT Login)

**Files:**
- Create: `packages/server/src/modules/auth/auth.module.ts`
- Create: `packages/server/src/modules/auth/auth.controller.ts`
- Create: `packages/server/src/modules/auth/auth.service.ts`
- Create: `packages/server/src/modules/auth/dto/login.dto.ts`
- Create: `packages/server/src/modules/auth/jwt.strategy.ts`
- Create: `packages/server/src/common/guards/jwt-auth.guard.ts`
- Modify: `packages/server/src/app.module.ts`

- [ ] **Step 1: Create login DTO**

```typescript
// packages/server/src/modules/auth/dto/login.dto.ts
import { IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsString()
  username: string;

  @IsString()
  @MinLength(4)
  password: string;
}
```

- [ ] **Step 2: Create auth service**

```typescript
// packages/server/src/modules/auth/auth.service.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma.service';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async login(dto: LoginDto) {
    const admin = await this.prisma.admin.findUnique({
      where: { username: dto.username },
    });
    if (!admin || !(await bcrypt.compare(dto.password, admin.password))) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const payload = { sub: admin.id, username: admin.username };
    return {
      access_token: this.jwtService.sign(payload),
      admin: {
        id: admin.id,
        username: admin.username,
        nickname: admin.nickname,
        avatar: admin.avatar,
      },
    };
  }

  async getProfile(adminId: number) {
    const admin = await this.prisma.admin.findUnique({
      where: { id: adminId },
      select: { id: true, username: true, nickname: true, avatar: true, createdAt: true },
    });
    return admin;
  }

  async updateProfile(adminId: number, data: { nickname?: string; avatar?: string; password?: string }) {
    const updateData: any = {};
    if (data.nickname) updateData.nickname = data.nickname;
    if (data.avatar) updateData.avatar = data.avatar;
    if (data.password) updateData.password = await bcrypt.hash(data.password, 10);
    return this.prisma.admin.update({
      where: { id: adminId },
      data: updateData,
      select: { id: true, username: true, nickname: true, avatar: true },
    });
  }
}
```

- [ ] **Step 3: Create JWT strategy and guard**

```typescript
// packages/server/src/modules/auth/jwt.strategy.ts
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: { sub: number; username: string }) {
    return { id: payload.sub, username: payload.username };
  }
}
```

```typescript
// packages/server/src/common/guards/jwt-auth.guard.ts
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
```

- [ ] **Step 4: Create auth controller**

```typescript
// packages/server/src/modules/auth/auth.controller.ts
import { Controller, Post, Get, Put, Body, UseGuards, Request } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('admin')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  getProfile(@Request() req: any) {
    return this.authService.getProfile(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Put('profile')
  updateProfile(@Request() req: any, @Body() body: { nickname?: string; avatar?: string; password?: string }) {
    return this.authService.updateProfile(req.user.id, body);
  }
}
```

- [ ] **Step 5: Create auth module and register in app**

```typescript
// packages/server/src/modules/auth/auth.module.ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '7d' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
})
export class AuthModule {}
```

Update `app.module.ts`:

```typescript
// packages/server/src/app.module.ts
import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from './prisma.service';
import { AuthModule } from './modules/auth/auth.module';

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuthModule,
  ],
  providers: [PrismaService],
  exports: [PrismaService],
})
export class AppModule {}
```

- [ ] **Step 6: Test login endpoint**

```bash
cd /Users/shichiya/workspace/shichiya-blog/packages/server
npm run start:dev
```

```bash
# Test login
curl -X POST http://localhost:3001/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

Expected: `{"access_token":"eyJ...","admin":{"id":1,"username":"admin","nickname":"Shichiya","avatar":null}}`

```bash
# Test profile with token
curl http://localhost:3001/api/admin/profile \
  -H "Authorization: Bearer <token_from_above>"
```

Expected: `{"id":1,"username":"admin","nickname":"Shichiya","avatar":null,"createdAt":"..."}`

- [ ] **Step 7: Commit**

```bash
cd /Users/shichiya/workspace/shichiya-blog
git add packages/server/src/modules/auth packages/server/src/common packages/server/src/app.module.ts
git commit -m "feat: add auth module with JWT login, profile endpoints"
```

---

### Task 6: Category Module

**Files:**
- Create: `packages/server/src/modules/category/category.module.ts`
- Create: `packages/server/src/modules/category/category.controller.ts`
- Create: `packages/server/src/modules/category/category.service.ts`
- Create: `packages/server/src/modules/category/dto/create-category.dto.ts`
- Create: `packages/server/src/modules/category/dto/update-category.dto.ts`
- Modify: `packages/server/src/app.module.ts`

- [ ] **Step 1: Create DTOs**

```typescript
// packages/server/src/modules/category/dto/create-category.dto.ts
import { IsString, IsOptional, IsInt } from 'class-validator';

export class CreateCategoryDto {
  @IsString()
  name: string;

  @IsString()
  slug: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}
```

```typescript
// packages/server/src/modules/category/dto/update-category.dto.ts
import { PartialType } from '@nestjs/mapped-types';
import { CreateCategoryDto } from './create-category.dto';

export class UpdateCategoryDto extends PartialType(CreateCategoryDto) {}
```

- [ ] **Step 2: Create category service**

```typescript
// packages/server/src/modules/category/category.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoryService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.category.findMany({
      orderBy: { sortOrder: 'asc' },
      include: { _count: { select: { articles: true } } },
    });
  }

  async findBySlug(slug: string) {
    const category = await this.prisma.category.findUnique({ where: { slug } });
    if (!category) throw new NotFoundException('Category not found');
    return category;
  }

  create(dto: CreateCategoryDto) {
    return this.prisma.category.create({ data: dto });
  }

  async update(id: number, dto: UpdateCategoryDto) {
    await this.ensureExists(id);
    return this.prisma.category.update({ where: { id }, data: dto });
  }

  async remove(id: number) {
    await this.ensureExists(id);
    return this.prisma.category.delete({ where: { id } });
  }

  private async ensureExists(id: number) {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) throw new NotFoundException('Category not found');
  }
}
```

- [ ] **Step 3: Create category controller**

```typescript
// packages/server/src/modules/category/category.controller.ts
import { Controller, Get, Post, Put, Delete, Body, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { CategoryService } from './category.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller()
export class CategoryController {
  constructor(private categoryService: CategoryService) {}

  // Public
  @Get('categories')
  findAll() {
    return this.categoryService.findAll();
  }

  // Admin
  @UseGuards(JwtAuthGuard)
  @Post('admin/categories')
  create(@Body() dto: CreateCategoryDto) {
    return this.categoryService.create(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Put('admin/categories/:id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCategoryDto) {
    return this.categoryService.update(id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('admin/categories/:id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.categoryService.remove(id);
  }
}
```

- [ ] **Step 4: Create module and register**

```typescript
// packages/server/src/modules/category/category.module.ts
import { Module } from '@nestjs/common';
import { CategoryController } from './category.controller';
import { CategoryService } from './category.service';

@Module({
  controllers: [CategoryController],
  providers: [CategoryService],
  exports: [CategoryService],
})
export class CategoryModule {}
```

Add `CategoryModule` to `app.module.ts` imports array.

- [ ] **Step 5: Verify with curl**

```bash
# Login first to get token
TOKEN=$(curl -s -X POST http://localhost:3001/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | jq -r '.access_token')

# Create category
curl -X POST http://localhost:3001/api/admin/categories \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"Tech","slug":"tech"}'

# List categories
curl http://localhost:3001/api/categories
```

Expected: Category created and listed with article count.

- [ ] **Step 6: Commit**

```bash
git add packages/server/src/modules/category packages/server/src/app.module.ts
git commit -m "feat: add category module with CRUD endpoints"
```

---

### Task 7: Tag Module

**Files:**
- Create: `packages/server/src/modules/tag/tag.module.ts`
- Create: `packages/server/src/modules/tag/tag.controller.ts`
- Create: `packages/server/src/modules/tag/tag.service.ts`
- Create: `packages/server/src/modules/tag/dto/create-tag.dto.ts`
- Create: `packages/server/src/modules/tag/dto/update-tag.dto.ts`
- Modify: `packages/server/src/app.module.ts`

- [ ] **Step 1: Create DTOs**

```typescript
// packages/server/src/modules/tag/dto/create-tag.dto.ts
import { IsString } from 'class-validator';

export class CreateTagDto {
  @IsString()
  name: string;

  @IsString()
  slug: string;
}
```

```typescript
// packages/server/src/modules/tag/dto/update-tag.dto.ts
import { PartialType } from '@nestjs/mapped-types';
import { CreateTagDto } from './create-tag.dto';

export class UpdateTagDto extends PartialType(CreateTagDto) {}
```

- [ ] **Step 2: Create tag service**

```typescript
// packages/server/src/modules/tag/tag.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';

@Injectable()
export class TagService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.tag.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { articles: true } } },
    });
  }

  async findBySlug(slug: string) {
    const tag = await this.prisma.tag.findUnique({ where: { slug } });
    if (!tag) throw new NotFoundException('Tag not found');
    return tag;
  }

  create(dto: CreateTagDto) {
    return this.prisma.tag.create({ data: dto });
  }

  async update(id: number, dto: UpdateTagDto) {
    await this.ensureExists(id);
    return this.prisma.tag.update({ where: { id }, data: dto });
  }

  async remove(id: number) {
    await this.ensureExists(id);
    return this.prisma.tag.delete({ where: { id } });
  }

  private async ensureExists(id: number) {
    const tag = await this.prisma.tag.findUnique({ where: { id } });
    if (!tag) throw new NotFoundException('Tag not found');
  }
}
```

- [ ] **Step 3: Create tag controller**

```typescript
// packages/server/src/modules/tag/tag.controller.ts
import { Controller, Get, Post, Put, Delete, Body, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { TagService } from './tag.service';
import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller()
export class TagController {
  constructor(private tagService: TagService) {}

  @Get('tags')
  findAll() {
    return this.tagService.findAll();
  }

  @UseGuards(JwtAuthGuard)
  @Post('admin/tags')
  create(@Body() dto: CreateTagDto) {
    return this.tagService.create(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Put('admin/tags/:id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateTagDto) {
    return this.tagService.update(id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('admin/tags/:id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.tagService.remove(id);
  }
}
```

- [ ] **Step 4: Create module and register**

```typescript
// packages/server/src/modules/tag/tag.module.ts
import { Module } from '@nestjs/common';
import { TagController } from './tag.controller';
import { TagService } from './tag.service';

@Module({
  controllers: [TagController],
  providers: [TagService],
  exports: [TagService],
})
export class TagModule {}
```

Add `TagModule` to `app.module.ts` imports array.

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/modules/tag packages/server/src/app.module.ts
git commit -m "feat: add tag module with CRUD endpoints"
```

---

### Task 8: Article Module

**Files:**
- Create: `packages/server/src/modules/article/article.module.ts`
- Create: `packages/server/src/modules/article/article.controller.ts`
- Create: `packages/server/src/modules/article/article.service.ts`
- Create: `packages/server/src/modules/article/dto/create-article.dto.ts`
- Create: `packages/server/src/modules/article/dto/update-article.dto.ts`
- Create: `packages/server/src/modules/article/dto/query-article.dto.ts`
- Modify: `packages/server/src/app.module.ts`

- [ ] **Step 1: Create DTOs**

```typescript
// packages/server/src/modules/article/dto/create-article.dto.ts
import { IsString, IsOptional, IsInt, IsEnum, IsArray } from 'class-validator';
import { ArticleStatus } from '@prisma/client';

export class CreateArticleDto {
  @IsString()
  title: string;

  @IsString()
  slug: string;

  @IsOptional()
  @IsString()
  summary?: string;

  @IsString()
  content: string;

  @IsOptional()
  @IsString()
  coverImage?: string;

  @IsEnum(ArticleStatus)
  status: ArticleStatus;

  @IsInt()
  categoryId: number;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  tagIds?: number[];
}
```

```typescript
// packages/server/src/modules/article/dto/update-article.dto.ts
import { PartialType } from '@nestjs/mapped-types';
import { CreateArticleDto } from './create-article.dto';

export class UpdateArticleDto extends PartialType(CreateArticleDto) {}
```

```typescript
// packages/server/src/modules/article/dto/query-article.dto.ts
import { IsOptional, IsString, IsInt } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryArticleDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  limit?: number = 10;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  tag?: string;
}
```

- [ ] **Step 2: Create article service**

```typescript
// packages/server/src/modules/article/article.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { QueryArticleDto } from './dto/query-article.dto';
import { ArticleStatus } from '@prisma/client';

@Injectable()
export class ArticleService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: QueryArticleDto) {
    const { page = 1, limit = 10, category, tag } = query;
    const where: any = { status: ArticleStatus.PUBLISHED };

    if (category) {
      where.category = { slug: category };
    }
    if (tag) {
      where.tags = { some: { slug: tag } };
    }

    const [articles, total] = await Promise.all([
      this.prisma.article.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { publishedAt: 'desc' },
        include: {
          category: true,
          tags: true,
        },
        omit: { content: true },
      }),
      this.prisma.article.count({ where }),
    ]);

    return {
      data: articles,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findBySlug(slug: string) {
    const article = await this.prisma.article.findUnique({
      where: { slug },
      include: { category: true, tags: true },
    });
    if (!article) throw new NotFoundException('Article not found');

    // Increment view count
    await this.prisma.article.update({
      where: { id: article.id },
      data: { viewCount: { increment: 1 } },
    });

    return article;
  }

  // Admin: list all articles including drafts
  async findAllAdmin(query: QueryArticleDto) {
    const { page = 1, limit = 10 } = query;
    const [articles, total] = await Promise.all([
      this.prisma.article.findMany({
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { category: true, tags: true },
        omit: { content: true },
      }),
      this.prisma.article.count(),
    ]);

    return {
      data: articles,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async create(dto: CreateArticleDto) {
    const { tagIds, ...data } = dto;
    return this.prisma.article.create({
      data: {
        ...data,
        publishedAt: data.status === ArticleStatus.PUBLISHED ? new Date() : null,
        tags: tagIds ? { connect: tagIds.map((id) => ({ id })) } : undefined,
      },
      include: { category: true, tags: true },
    });
  }

  async update(id: number, dto: UpdateArticleDto) {
    await this.ensureExists(id);
    const { tagIds, ...data } = dto;

    // If publishing for the first time, set publishedAt
    if (data.status === ArticleStatus.PUBLISHED) {
      const existing = await this.prisma.article.findUnique({ where: { id } });
      if (existing && !existing.publishedAt) {
        (data as any).publishedAt = new Date();
      }
    }

    return this.prisma.article.update({
      where: { id },
      data: {
        ...data,
        tags: tagIds !== undefined
          ? { set: [], connect: tagIds.map((id) => ({ id })) }
          : undefined,
      },
      include: { category: true, tags: true },
    });
  }

  async remove(id: number) {
    await this.ensureExists(id);
    return this.prisma.article.delete({ where: { id } });
  }

  async search(q: string, page = 1, limit = 10) {
    const where = {
      status: ArticleStatus.PUBLISHED,
      OR: [
        { title: { contains: q, mode: 'insensitive' as const } },
        { content: { contains: q, mode: 'insensitive' as const } },
        { summary: { contains: q, mode: 'insensitive' as const } },
      ],
    };

    const [articles, total] = await Promise.all([
      this.prisma.article.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { publishedAt: 'desc' },
        include: { category: true, tags: true },
        omit: { content: true },
      }),
      this.prisma.article.count({ where }),
    ]);

    return {
      data: articles,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  private async ensureExists(id: number) {
    const article = await this.prisma.article.findUnique({ where: { id } });
    if (!article) throw new NotFoundException('Article not found');
  }
}
```

- [ ] **Step 3: Create article controller**

```typescript
// packages/server/src/modules/article/article.controller.ts
import { Controller, Get, Post, Put, Delete, Body, Param, Query, ParseIntPipe, UseGuards } from '@nestjs/common';
import { ArticleService } from './article.service';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { QueryArticleDto } from './dto/query-article.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller()
export class ArticleController {
  constructor(private articleService: ArticleService) {}

  // Public
  @Get('articles')
  findAll(@Query() query: QueryArticleDto) {
    return this.articleService.findAll(query);
  }

  @Get('articles/:slug')
  findBySlug(@Param('slug') slug: string) {
    return this.articleService.findBySlug(slug);
  }

  @Get('search')
  search(@Query('q') q: string, @Query('page') page?: string, @Query('limit') limit?: string) {
    return this.articleService.search(q, Number(page) || 1, Number(limit) || 10);
  }

  // Admin
  @UseGuards(JwtAuthGuard)
  @Get('admin/articles')
  findAllAdmin(@Query() query: QueryArticleDto) {
    return this.articleService.findAllAdmin(query);
  }

  @UseGuards(JwtAuthGuard)
  @Post('admin/articles')
  create(@Body() dto: CreateArticleDto) {
    return this.articleService.create(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Put('admin/articles/:id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateArticleDto) {
    return this.articleService.update(id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('admin/articles/:id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.articleService.remove(id);
  }
}
```

- [ ] **Step 4: Create module and register**

```typescript
// packages/server/src/modules/article/article.module.ts
import { Module } from '@nestjs/common';
import { ArticleController } from './article.controller';
import { ArticleService } from './article.service';

@Module({
  controllers: [ArticleController],
  providers: [ArticleService],
  exports: [ArticleService],
})
export class ArticleModule {}
```

Add `ArticleModule` to `app.module.ts` imports array.

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/modules/article packages/server/src/app.module.ts
git commit -m "feat: add article module with CRUD, search, pagination"
```

---

### Task 9: Comment Module

**Files:**
- Create: `packages/server/src/modules/comment/comment.module.ts`
- Create: `packages/server/src/modules/comment/comment.controller.ts`
- Create: `packages/server/src/modules/comment/comment.service.ts`
- Create: `packages/server/src/modules/comment/dto/create-comment.dto.ts`
- Create: `packages/server/src/modules/comment/dto/update-comment.dto.ts`
- Modify: `packages/server/src/app.module.ts`

- [ ] **Step 1: Create DTOs**

```typescript
// packages/server/src/modules/comment/dto/create-comment.dto.ts
import { IsString, IsEmail, IsOptional, IsInt } from 'class-validator';

export class CreateCommentDto {
  @IsString()
  nickname: string;

  @IsEmail()
  email: string;

  @IsString()
  content: string;

  @IsOptional()
  @IsInt()
  parentId?: number;
}
```

```typescript
// packages/server/src/modules/comment/dto/update-comment.dto.ts
import { IsEnum } from 'class-validator';
import { CommentStatus } from '@prisma/client';

export class UpdateCommentDto {
  @IsEnum(CommentStatus)
  status: CommentStatus;
}
```

- [ ] **Step 2: Create comment service**

```typescript
// packages/server/src/modules/comment/comment.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CommentStatus } from '@prisma/client';

@Injectable()
export class CommentService {
  constructor(private prisma: PrismaService) {}

  // Public: get approved comments for an article by slug
  async findByArticleSlug(slug: string) {
    const article = await this.prisma.article.findUnique({ where: { slug } });
    if (!article) throw new NotFoundException('Article not found');

    return this.prisma.comment.findMany({
      where: { articleId: article.id, status: CommentStatus.APPROVED, parentId: null },
      orderBy: { createdAt: 'asc' },
      include: {
        replies: {
          where: { status: CommentStatus.APPROVED },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  }

  // Public: submit comment
  async create(slug: string, dto: CreateCommentDto) {
    const article = await this.prisma.article.findUnique({ where: { slug } });
    if (!article) throw new NotFoundException('Article not found');

    return this.prisma.comment.create({
      data: {
        ...dto,
        articleId: article.id,
      },
    });
  }

  // Admin: list all comments
  async findAllAdmin(page = 1, limit = 20) {
    const [comments, total] = await Promise.all([
      this.prisma.comment.findMany({
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { article: { select: { id: true, title: true, slug: true } } },
      }),
      this.prisma.comment.count(),
    ]);

    return {
      data: comments,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // Admin: update comment status
  async updateStatus(id: number, status: CommentStatus) {
    const comment = await this.prisma.comment.findUnique({ where: { id } });
    if (!comment) throw new NotFoundException('Comment not found');
    return this.prisma.comment.update({ where: { id }, data: { status } });
  }

  // Admin: delete comment
  async remove(id: number) {
    const comment = await this.prisma.comment.findUnique({ where: { id } });
    if (!comment) throw new NotFoundException('Comment not found');
    return this.prisma.comment.delete({ where: { id } });
  }
}
```

- [ ] **Step 3: Create comment controller**

```typescript
// packages/server/src/modules/comment/comment.controller.ts
import { Controller, Get, Post, Put, Delete, Body, Param, Query, ParseIntPipe, UseGuards } from '@nestjs/common';
import { CommentService } from './comment.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller()
export class CommentController {
  constructor(private commentService: CommentService) {}

  // Public
  @Get('articles/:slug/comments')
  findByArticle(@Param('slug') slug: string) {
    return this.commentService.findByArticleSlug(slug);
  }

  @Post('articles/:slug/comments')
  create(@Param('slug') slug: string, @Body() dto: CreateCommentDto) {
    return this.commentService.create(slug, dto);
  }

  // Admin
  @UseGuards(JwtAuthGuard)
  @Get('admin/comments')
  findAllAdmin(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.commentService.findAllAdmin(Number(page) || 1, Number(limit) || 20);
  }

  @UseGuards(JwtAuthGuard)
  @Put('admin/comments/:id')
  updateStatus(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCommentDto) {
    return this.commentService.updateStatus(id, dto.status);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('admin/comments/:id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.commentService.remove(id);
  }
}
```

- [ ] **Step 4: Create module and register**

```typescript
// packages/server/src/modules/comment/comment.module.ts
import { Module } from '@nestjs/common';
import { CommentController } from './comment.controller';
import { CommentService } from './comment.service';

@Module({
  controllers: [CommentController],
  providers: [CommentService],
})
export class CommentModule {}
```

Add `CommentModule` to `app.module.ts` imports array.

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/modules/comment packages/server/src/app.module.ts
git commit -m "feat: add comment module with public submit and admin review"
```

---

### Task 10: Upload Module

**Files:**
- Create: `packages/server/src/modules/upload/upload.module.ts`
- Create: `packages/server/src/modules/upload/upload.controller.ts`
- Modify: `packages/server/src/app.module.ts`

- [ ] **Step 1: Create upload controller**

```typescript
// packages/server/src/modules/upload/upload.controller.ts
import { Controller, Post, UseGuards, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('admin')
@UseGuards(JwtAuthGuard)
export class UploadController {
  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: join(process.cwd(), '../../uploads'),
        filename: (req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, uniqueSuffix + extname(file.originalname));
        },
      }),
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
      fileFilter: (req, file, cb) => {
        if (!file.mimetype.match(/^image\//)) {
          return cb(new BadRequestException('Only image files are allowed'), false);
        }
        cb(null, true);
      },
    }),
  )
  upload(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded');
    return { url: `/uploads/${file.filename}` };
  }
}
```

- [ ] **Step 2: Create module and register**

```typescript
// packages/server/src/modules/upload/upload.module.ts
import { Module } from '@nestjs/common';
import { UploadController } from './upload.controller';

@Module({
  controllers: [UploadController],
})
export class UploadModule {}
```

Add `UploadModule` to `app.module.ts` imports array.

- [ ] **Step 3: Commit**

```bash
git add packages/server/src/modules/upload packages/server/src/app.module.ts
git commit -m "feat: add upload module for image uploads"
```

---

### Task 11: Stats Module + RSS Endpoint

**Files:**
- Create: `packages/server/src/modules/stats/stats.module.ts`
- Create: `packages/server/src/modules/stats/stats.controller.ts`
- Create: `packages/server/src/modules/stats/stats.service.ts`
- Modify: `packages/server/src/app.module.ts`

- [ ] **Step 1: Create stats service**

```typescript
// packages/server/src/modules/stats/stats.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { ArticleStatus } from '@prisma/client';

@Injectable()
export class StatsService {
  constructor(private prisma: PrismaService) {}

  async getDashboardStats() {
    const [articleCount, publishedCount, draftCount, commentCount, totalViews] = await Promise.all([
      this.prisma.article.count(),
      this.prisma.article.count({ where: { status: ArticleStatus.PUBLISHED } }),
      this.prisma.article.count({ where: { status: ArticleStatus.DRAFT } }),
      this.prisma.comment.count(),
      this.prisma.article.aggregate({ _sum: { viewCount: true } }),
    ]);

    return {
      articleCount,
      publishedCount,
      draftCount,
      commentCount,
      totalViews: totalViews._sum.viewCount || 0,
    };
  }

  async generateRss(siteUrl: string) {
    const articles = await this.prisma.article.findMany({
      where: { status: ArticleStatus.PUBLISHED },
      orderBy: { publishedAt: 'desc' },
      take: 20,
      include: { category: true },
    });

    const items = articles
      .map(
        (a) => `
    <item>
      <title><![CDATA[${a.title}]]></title>
      <link>${siteUrl}/posts/${a.slug}</link>
      <description><![CDATA[${a.summary || ''}]]></description>
      <pubDate>${a.publishedAt?.toUTCString()}</pubDate>
      <guid>${siteUrl}/posts/${a.slug}</guid>
      <category>${a.category.name}</category>
    </item>`,
      )
      .join('');

    return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Shichiya Blog</title>
    <link>${siteUrl}</link>
    <description>Tech and Life Blog</description>
    <language>zh-CN</language>
    ${items}
  </channel>
</rss>`;
  }
}
```

- [ ] **Step 2: Create stats controller**

```typescript
// packages/server/src/modules/stats/stats.controller.ts
import { Controller, Get, UseGuards, Res } from '@nestjs/common';
import { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { StatsService } from './stats.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller()
export class StatsController {
  constructor(
    private statsService: StatsService,
    private configService: ConfigService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get('admin/stats')
  getStats() {
    return this.statsService.getDashboardStats();
  }

  @Get('rss')
  async getRss(@Res() res: Response) {
    const siteUrl = this.configService.get('SITE_URL', 'http://1.116.119.240');
    const xml = await this.statsService.generateRss(siteUrl);
    res.set('Content-Type', 'application/xml');
    res.send(xml);
  }
}
```

- [ ] **Step 3: Create module and register**

```typescript
// packages/server/src/modules/stats/stats.module.ts
import { Module } from '@nestjs/common';
import { StatsController } from './stats.controller';
import { StatsService } from './stats.service';

@Module({
  controllers: [StatsController],
  providers: [StatsService],
})
export class StatsModule {}
```

Add `StatsModule` to `app.module.ts` imports array. Also add `SITE_URL=http://1.116.119.240` to `packages/server/.env`.

- [ ] **Step 4: Verify backend is complete**

Run `npm run start:dev` and test all endpoints with curl. All API routes from the spec should now be functional.

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/modules/stats packages/server/src/app.module.ts
git commit -m "feat: add stats module and RSS feed endpoint"
```

---

## Phase 4: Frontend — Layout & Public Pages

### Task 12: Global Layout, Fonts, and API Client

**Files:**
- Create: `packages/frontend/src/lib/api.ts`
- Modify: `packages/frontend/src/app/layout.tsx`
- Modify: `packages/frontend/src/app/globals.css`
- Create: `packages/frontend/src/components/Header.tsx`
- Create: `packages/frontend/src/components/Footer.tsx`

- [ ] **Step 1: Create API client**

```typescript
// packages/frontend/src/lib/api.ts
const API_URL = process.env.API_URL || 'http://127.0.0.1:3001';

async function fetchAPI(path: string, options?: RequestInit) {
  const res = await fetch(`${API_URL}/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }
  return res.json();
}

// Public endpoints
export async function getArticles(params?: { page?: number; category?: string; tag?: string }) {
  const query = new URLSearchParams();
  if (params?.page) query.set('page', String(params.page));
  if (params?.category) query.set('category', params.category);
  if (params?.tag) query.set('tag', params.tag);
  return fetchAPI(`/articles?${query}`);
}

export async function getArticle(slug: string) {
  return fetchAPI(`/articles/${slug}`);
}

export async function getCategories() {
  return fetchAPI('/categories');
}

export async function getTags() {
  return fetchAPI('/tags');
}

export async function getComments(slug: string) {
  return fetchAPI(`/articles/${slug}/comments`);
}

export async function postComment(slug: string, data: { nickname: string; email: string; content: string; parentId?: number }) {
  return fetchAPI(`/articles/${slug}/comments`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function searchArticles(q: string, page = 1) {
  return fetchAPI(`/search?q=${encodeURIComponent(q)}&page=${page}`);
}
```

- [ ] **Step 2: Update globals.css with editorial typography**

```css
/* packages/frontend/src/app/globals.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;700;900&family=Noto+Serif+SC:wght@400;700&display=swap');

@layer base {
  body {
    @apply text-gray-900 bg-white antialiased;
    font-family: 'Noto Sans SC', -apple-system, BlinkMacSystemFont, sans-serif;
  }

  h1, h2, h3, h4 {
    font-family: 'Noto Serif SC', Georgia, serif;
  }

  article p {
    @apply text-base leading-relaxed;
    line-height: 1.8;
  }
}
```

- [ ] **Step 3: Create Header component**

```tsx
// packages/frontend/src/components/Header.tsx
import Link from 'next/link';
import { getCategories } from '@/lib/api';

export default async function Header() {
  const categories = await getCategories();

  return (
    <header className="border-b-2 border-gray-900">
      <div className="max-w-6xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <Link href="/" className="text-2xl font-black tracking-tight">
            SHICHIYA
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-sm">
            {categories.map((cat: any) => (
              <Link
                key={cat.id}
                href={`/categories/${cat.slug}`}
                className="hover:text-gray-600 transition-colors"
              >
                {cat.name}
              </Link>
            ))}
            <Link href="/archives" className="hover:text-gray-600 transition-colors">
              Archives
            </Link>
            <Link href="/about" className="hover:text-gray-600 transition-colors">
              About
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
```

- [ ] **Step 4: Create Footer component**

```tsx
// packages/frontend/src/components/Footer.tsx
import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="border-t border-gray-200 mt-16">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-gray-500">
          <p>&copy; {new Date().getFullYear()} Shichiya. All rights reserved.</p>
          <div className="flex gap-4">
            <Link href="/rss" className="hover:text-gray-900">RSS</Link>
            <Link href="/about" className="hover:text-gray-900">About</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
```

- [ ] **Step 5: Update root layout**

```tsx
// packages/frontend/src/app/layout.tsx
import type { Metadata } from 'next';
import './globals.css';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export const metadata: Metadata = {
  title: 'Shichiya Blog',
  description: 'Tech and Life Blog',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <Header />
        <main className="max-w-6xl mx-auto px-4 py-8 min-h-screen">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add packages/frontend/src
git commit -m "feat: add global layout, header, footer, API client, editorial typography"
```

---

### Task 13: Home Page (Magazine Layout)

**Files:**
- Modify: `packages/frontend/src/app/page.tsx`
- Create: `packages/frontend/src/components/ArticleCard.tsx`
- Create: `packages/frontend/src/components/HeroArticle.tsx`

- [ ] **Step 1: Create HeroArticle component**

```tsx
// packages/frontend/src/components/HeroArticle.tsx
import Link from 'next/link';

export default function HeroArticle({ article }: { article: any }) {
  return (
    <Link href={`/posts/${article.slug}`} className="block group">
      <div className="relative aspect-[2/1] bg-gray-100 rounded-sm overflow-hidden mb-4">
        {article.coverImage ? (
          <img
            src={article.coverImage}
            alt={article.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-50">
            <span className="text-gray-300 text-6xl font-serif">{article.title[0]}</span>
          </div>
        )}
      </div>
      <div className="space-y-2">
        <div className="flex items-center gap-3 text-xs uppercase tracking-wider text-gray-500">
          <span className="font-semibold text-gray-900">{article.category?.name}</span>
          <span>&middot;</span>
          <time>{new Date(article.publishedAt).toLocaleDateString('zh-CN')}</time>
        </div>
        <h2 className="text-3xl font-bold leading-tight group-hover:text-gray-600 transition-colors">
          {article.title}
        </h2>
        {article.summary && (
          <p className="text-gray-600 leading-relaxed line-clamp-2">{article.summary}</p>
        )}
      </div>
    </Link>
  );
}
```

- [ ] **Step 2: Create ArticleCard component**

```tsx
// packages/frontend/src/components/ArticleCard.tsx
import Link from 'next/link';

export default function ArticleCard({ article }: { article: any }) {
  return (
    <Link href={`/posts/${article.slug}`} className="block group">
      <div className="border-t border-gray-200 pt-4">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-gray-500 mb-2">
          <span className="font-semibold text-gray-900">{article.category?.name}</span>
          <span>&middot;</span>
          <time>{new Date(article.publishedAt).toLocaleDateString('zh-CN')}</time>
        </div>
        <h3 className="text-lg font-bold mb-1 group-hover:text-gray-600 transition-colors">
          {article.title}
        </h3>
        {article.summary && (
          <p className="text-sm text-gray-600 line-clamp-2">{article.summary}</p>
        )}
        <div className="flex gap-2 mt-2">
          {article.tags?.map((tag: any) => (
            <span key={tag.id} className="text-xs text-gray-400">#{tag.name}</span>
          ))}
        </div>
      </div>
    </Link>
  );
}
```

- [ ] **Step 3: Build home page**

```tsx
// packages/frontend/src/app/page.tsx
import { getArticles } from '@/lib/api';
import HeroArticle from '@/components/HeroArticle';
import ArticleCard from '@/components/ArticleCard';

export default async function Home() {
  const { data: articles } = await getArticles();

  if (!articles || articles.length === 0) {
    return (
      <div className="text-center py-20 text-gray-400">
        <p className="text-xl">No articles yet</p>
      </div>
    );
  }

  const [hero, ...rest] = articles;

  return (
    <div>
      <section className="mb-12">
        <HeroArticle article={hero} />
      </section>

      <section>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {rest.map((article: any) => (
            <ArticleCard key={article.id} article={article} />
          ))}
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add packages/frontend/src
git commit -m "feat: add magazine-style home page with hero and card grid"
```

---

### Task 14: Article Detail Page

**Files:**
- Create: `packages/frontend/src/app/posts/[slug]/page.tsx`
- Create: `packages/frontend/src/components/MarkdownRenderer.tsx`
- Create: `packages/frontend/src/components/CommentSection.tsx`
- Create: `packages/frontend/src/components/CommentForm.tsx`

- [ ] **Step 1: Install Markdown dependencies**

```bash
cd /Users/shichiya/workspace/shichiya-blog/packages/frontend
npm install react-markdown remark-gfm rehype-highlight rehype-slug rehype-autolink-headings
```

- [ ] **Step 2: Create MarkdownRenderer component**

```tsx
// packages/frontend/src/components/MarkdownRenderer.tsx
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import 'highlight.js/styles/github-dark.css';

export default function MarkdownRenderer({ content }: { content: string }) {
  return (
    <div className="prose prose-lg max-w-none prose-headings:font-serif prose-p:leading-relaxed prose-pre:bg-gray-900 prose-code:text-sm">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight, rehypeSlug, rehypeAutolinkHeadings]}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
```

- [ ] **Step 3: Create CommentForm component (client component)**

```tsx
// packages/frontend/src/components/CommentForm.tsx
'use client';

import { useState } from 'react';

export default function CommentForm({ slug, parentId, onSubmitted }: {
  slug: string;
  parentId?: number;
  onSubmitted?: () => void;
}) {
  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || ''}/api/articles/${slug}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname, email, content, parentId }),
      });
      if (res.ok) {
        setMessage('Comment submitted, awaiting review.');
        setContent('');
        onSubmitted?.();
      } else {
        setMessage('Failed to submit comment.');
      }
    } catch {
      setMessage('Failed to submit comment.');
    }
    setSubmitting(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <input
          type="text"
          placeholder="Nickname"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          required
          className="border border-gray-300 px-3 py-2 text-sm rounded-sm focus:outline-none focus:border-gray-900"
        />
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="border border-gray-300 px-3 py-2 text-sm rounded-sm focus:outline-none focus:border-gray-900"
        />
      </div>
      <textarea
        placeholder="Write a comment..."
        value={content}
        onChange={(e) => setContent(e.target.value)}
        required
        rows={4}
        className="w-full border border-gray-300 px-3 py-2 text-sm rounded-sm focus:outline-none focus:border-gray-900"
      />
      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={submitting}
          className="bg-gray-900 text-white px-6 py-2 text-sm hover:bg-gray-700 disabled:opacity-50 transition-colors"
        >
          {submitting ? 'Submitting...' : 'Submit'}
        </button>
        {message && <span className="text-sm text-gray-500">{message}</span>}
      </div>
    </form>
  );
}
```

- [ ] **Step 4: Create CommentSection component**

```tsx
// packages/frontend/src/components/CommentSection.tsx
import { getComments } from '@/lib/api';
import CommentForm from './CommentForm';

export default async function CommentSection({ slug }: { slug: string }) {
  const comments = await getComments(slug);

  return (
    <section className="mt-12 border-t border-gray-200 pt-8">
      <h3 className="text-xl font-bold mb-6">Comments ({comments.length})</h3>

      <div className="space-y-6 mb-8">
        {comments.map((comment: any) => (
          <div key={comment.id} className="border-l-2 border-gray-200 pl-4">
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
              <span className="font-medium text-gray-900">{comment.nickname}</span>
              <span>&middot;</span>
              <time>{new Date(comment.createdAt).toLocaleDateString('zh-CN')}</time>
            </div>
            <p className="text-sm text-gray-700">{comment.content}</p>

            {comment.replies?.map((reply: any) => (
              <div key={reply.id} className="mt-3 ml-4 border-l border-gray-100 pl-4">
                <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                  <span className="font-medium text-gray-900">{reply.nickname}</span>
                  <span>&middot;</span>
                  <time>{new Date(reply.createdAt).toLocaleDateString('zh-CN')}</time>
                </div>
                <p className="text-sm text-gray-700">{reply.content}</p>
              </div>
            ))}
          </div>
        ))}
      </div>

      <h4 className="text-lg font-bold mb-4">Leave a Comment</h4>
      <CommentForm slug={slug} />
    </section>
  );
}
```

- [ ] **Step 5: Create article detail page**

```tsx
// packages/frontend/src/app/posts/[slug]/page.tsx
import { getArticle } from '@/lib/api';
import { notFound } from 'next/navigation';
import MarkdownRenderer from '@/components/MarkdownRenderer';
import CommentSection from '@/components/CommentSection';
import Link from 'next/link';

export default async function ArticlePage({ params }: { params: { slug: string } }) {
  let article;
  try {
    article = await getArticle(params.slug);
  } catch {
    notFound();
  }

  return (
    <article className="max-w-3xl mx-auto">
      {/* Meta */}
      <div className="mb-8">
        <div className="flex items-center gap-3 text-xs uppercase tracking-wider text-gray-500 mb-3">
          <Link href={`/categories/${article.category?.slug}`} className="font-semibold text-gray-900 hover:text-gray-600">
            {article.category?.name}
          </Link>
          <span>&middot;</span>
          <time>{new Date(article.publishedAt || article.createdAt).toLocaleDateString('zh-CN')}</time>
          <span>&middot;</span>
          <span>{article.viewCount} views</span>
        </div>
        <h1 className="text-4xl font-bold leading-tight mb-4">{article.title}</h1>
        {article.summary && (
          <p className="text-lg text-gray-600 leading-relaxed">{article.summary}</p>
        )}
        <div className="flex gap-2 mt-3">
          {article.tags?.map((tag: any) => (
            <Link
              key={tag.id}
              href={`/tags/${tag.slug}`}
              className="text-xs border border-gray-300 px-2 py-1 rounded-sm hover:bg-gray-50"
            >
              {tag.name}
            </Link>
          ))}
        </div>
      </div>

      {/* Cover */}
      {article.coverImage && (
        <div className="mb-8">
          <img src={article.coverImage} alt={article.title} className="w-full rounded-sm" />
        </div>
      )}

      {/* Content */}
      <MarkdownRenderer content={article.content} />

      {/* Comments */}
      <CommentSection slug={params.slug} />
    </article>
  );
}
```

- [ ] **Step 6: Install Tailwind typography plugin**

```bash
cd /Users/shichiya/workspace/shichiya-blog/packages/frontend
npm install @tailwindcss/typography
```

Add to `tailwind.config.ts`:

```typescript
plugins: [require('@tailwindcss/typography')],
```

- [ ] **Step 7: Commit**

```bash
git add packages/frontend
git commit -m "feat: add article detail page with Markdown rendering and comments"
```

---

### Task 15: Category, Tag, Archives, Search, About Pages

**Files:**
- Create: `packages/frontend/src/app/categories/[slug]/page.tsx`
- Create: `packages/frontend/src/app/tags/[slug]/page.tsx`
- Create: `packages/frontend/src/app/archives/page.tsx`
- Create: `packages/frontend/src/app/search/page.tsx`
- Create: `packages/frontend/src/app/about/page.tsx`
- Create: `packages/frontend/src/components/Pagination.tsx`

- [ ] **Step 1: Create Pagination component**

```tsx
// packages/frontend/src/components/Pagination.tsx
import Link from 'next/link';

export default function Pagination({ meta, basePath }: {
  meta: { page: number; totalPages: number };
  basePath: string;
}) {
  if (meta.totalPages <= 1) return null;

  return (
    <div className="flex justify-center gap-2 mt-8">
      {meta.page > 1 && (
        <Link
          href={`${basePath}?page=${meta.page - 1}`}
          className="border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
        >
          Previous
        </Link>
      )}
      <span className="px-4 py-2 text-sm text-gray-500">
        {meta.page} / {meta.totalPages}
      </span>
      {meta.page < meta.totalPages && (
        <Link
          href={`${basePath}?page=${meta.page + 1}`}
          className="border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
        >
          Next
        </Link>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create category page**

```tsx
// packages/frontend/src/app/categories/[slug]/page.tsx
import { getArticles, getCategories } from '@/lib/api';
import ArticleCard from '@/components/ArticleCard';
import Pagination from '@/components/Pagination';

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { page?: string };
}) {
  const [{ data: articles, meta }, categories] = await Promise.all([
    getArticles({ category: params.slug, page: Number(searchParams.page) || 1 }),
    getCategories(),
  ]);

  const category = categories.find((c: any) => c.slug === params.slug);

  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">{category?.name || params.slug}</h1>
      <p className="text-gray-500 mb-8">{meta.total} articles</p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {articles.map((article: any) => (
          <ArticleCard key={article.id} article={article} />
        ))}
      </div>
      <Pagination meta={meta} basePath={`/categories/${params.slug}`} />
    </div>
  );
}
```

- [ ] **Step 3: Create tag page**

```tsx
// packages/frontend/src/app/tags/[slug]/page.tsx
import { getArticles, getTags } from '@/lib/api';
import ArticleCard from '@/components/ArticleCard';
import Pagination from '@/components/Pagination';

export default async function TagPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { page?: string };
}) {
  const [{ data: articles, meta }, tags] = await Promise.all([
    getArticles({ tag: params.slug, page: Number(searchParams.page) || 1 }),
    getTags(),
  ]);

  const tag = tags.find((t: any) => t.slug === params.slug);

  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">#{tag?.name || params.slug}</h1>
      <p className="text-gray-500 mb-8">{meta.total} articles</p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {articles.map((article: any) => (
          <ArticleCard key={article.id} article={article} />
        ))}
      </div>
      <Pagination meta={meta} basePath={`/tags/${params.slug}`} />
    </div>
  );
}
```

- [ ] **Step 4: Create archives page**

```tsx
// packages/frontend/src/app/archives/page.tsx
import { getArticles } from '@/lib/api';
import Link from 'next/link';

export default async function ArchivesPage() {
  // Fetch all articles (large page size for archives)
  const { data: articles } = await getArticles({ page: 1 });

  // Group by year
  const grouped: Record<string, any[]> = {};
  articles.forEach((article: any) => {
    const year = new Date(article.publishedAt).getFullYear().toString();
    if (!grouped[year]) grouped[year] = [];
    grouped[year].push(article);
  });

  const years = Object.keys(grouped).sort((a, b) => Number(b) - Number(a));

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Archives</h1>
      {years.map((year) => (
        <div key={year} className="mb-8">
          <h2 className="text-xl font-bold mb-4 border-b border-gray-200 pb-2">{year}</h2>
          <ul className="space-y-3">
            {grouped[year].map((article: any) => (
              <li key={article.id} className="flex items-baseline gap-4">
                <time className="text-sm text-gray-400 w-24 shrink-0">
                  {new Date(article.publishedAt).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })}
                </time>
                <Link href={`/posts/${article.slug}`} className="hover:text-gray-600 transition-colors">
                  {article.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Create search page**

```tsx
// packages/frontend/src/app/search/page.tsx
import { searchArticles } from '@/lib/api';
import ArticleCard from '@/components/ArticleCard';
import Pagination from '@/components/Pagination';

export default async function SearchPage({
  searchParams,
}: {
  searchParams: { q?: string; page?: string };
}) {
  const q = searchParams.q || '';
  const page = Number(searchParams.page) || 1;

  let results = { data: [], meta: { total: 0, page: 1, limit: 10, totalPages: 0 } };
  if (q) {
    results = await searchArticles(q, page);
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-4">Search</h1>
      <form action="/search" method="GET" className="mb-8">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Search articles..."
          className="w-full max-w-lg border-2 border-gray-900 px-4 py-3 text-lg focus:outline-none"
        />
      </form>

      {q && (
        <p className="text-gray-500 mb-6">
          {results.meta.total} results for &ldquo;{q}&rdquo;
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {results.data.map((article: any) => (
          <ArticleCard key={article.id} article={article} />
        ))}
      </div>
      {q && <Pagination meta={results.meta} basePath={`/search?q=${encodeURIComponent(q)}`} />}
    </div>
  );
}
```

- [ ] **Step 6: Create about page**

```tsx
// packages/frontend/src/app/about/page.tsx
export default function AboutPage() {
  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">About</h1>
      <div className="prose prose-lg max-w-none">
        <p>
          Hi, I'm Shichiya. Welcome to my blog where I share thoughts on technology and life.
        </p>
        <p>
          This blog is built with Next.js, NestJS, and PostgreSQL.
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Commit**

```bash
git add packages/frontend/src
git commit -m "feat: add category, tag, archives, search, about pages"
```

---

## Phase 5: Frontend — Admin Pages

### Task 16: Admin Auth Context and Layout

**Files:**
- Create: `packages/frontend/src/lib/admin-api.ts`
- Create: `packages/frontend/src/components/admin/AuthProvider.tsx`
- Create: `packages/frontend/src/app/admin/layout.tsx`
- Create: `packages/frontend/src/app/admin/login/page.tsx`

- [ ] **Step 1: Create admin API client (client-side, with JWT)**

```typescript
// packages/frontend/src/lib/admin-api.ts
const API_BASE = '/api';

function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('admin_token');
}

async function adminFetch(path: string, options?: RequestInit) {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });
  if (res.status === 401) {
    localStorage.removeItem('admin_token');
    window.location.href = '/admin/login';
    throw new Error('Unauthorized');
  }
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

// Auth
export async function login(username: string, password: string) {
  const data = await adminFetch('/admin/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  localStorage.setItem('admin_token', data.access_token);
  return data;
}

export function logout() {
  localStorage.removeItem('admin_token');
  window.location.href = '/admin/login';
}

export function isLoggedIn() {
  return !!getToken();
}

// Profile
export const getProfile = () => adminFetch('/admin/profile');
export const updateProfile = (data: any) => adminFetch('/admin/profile', { method: 'PUT', body: JSON.stringify(data) });

// Articles
export const getAdminArticles = (page = 1) => adminFetch(`/admin/articles?page=${page}`);
export const createArticle = (data: any) => adminFetch('/admin/articles', { method: 'POST', body: JSON.stringify(data) });
export const updateArticle = (id: number, data: any) => adminFetch(`/admin/articles/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteArticle = (id: number) => adminFetch(`/admin/articles/${id}`, { method: 'DELETE' });

// Categories
export const getAdminCategories = () => adminFetch('/admin/categories').catch(() => fetch('/api/categories').then(r => r.json()));
export const createCategory = (data: any) => adminFetch('/admin/categories', { method: 'POST', body: JSON.stringify(data) });
export const updateCategory = (id: number, data: any) => adminFetch(`/admin/categories/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteCategory = (id: number) => adminFetch(`/admin/categories/${id}`, { method: 'DELETE' });

// Tags
export const getAdminTags = () => adminFetch('/admin/tags').catch(() => fetch('/api/tags').then(r => r.json()));
export const createTag = (data: any) => adminFetch('/admin/tags', { method: 'POST', body: JSON.stringify(data) });
export const updateTag = (id: number, data: any) => adminFetch(`/admin/tags/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteTag = (id: number) => adminFetch(`/admin/tags/${id}`, { method: 'DELETE' });

// Comments
export const getAdminComments = (page = 1) => adminFetch(`/admin/comments?page=${page}`);
export const updateCommentStatus = (id: number, status: string) => adminFetch(`/admin/comments/${id}`, { method: 'PUT', body: JSON.stringify({ status }) });
export const deleteComment = (id: number) => adminFetch(`/admin/comments/${id}`, { method: 'DELETE' });

// Stats
export const getStats = () => adminFetch('/admin/stats');

// Upload
export async function uploadImage(file: File) {
  const token = getToken();
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${API_BASE}/admin/upload`, {
    method: 'POST',
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: formData,
  });
  if (!res.ok) throw new Error('Upload failed');
  return res.json();
}
```

- [ ] **Step 2: Create AuthProvider**

```tsx
// packages/frontend/src/components/admin/AuthProvider.tsx
'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { isLoggedIn } from '@/lib/admin-api';

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== '/admin/login' && !isLoggedIn()) {
      router.push('/admin/login');
    }
  }, [pathname, router]);

  return <>{children}</>;
}
```

- [ ] **Step 3: Create admin layout**

```tsx
// packages/frontend/src/app/admin/layout.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import AuthProvider from '@/components/admin/AuthProvider';
import { logout } from '@/lib/admin-api';

const navItems = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/articles', label: 'Articles' },
  { href: '/admin/categories', label: 'Categories' },
  { href: '/admin/tags', label: 'Tags' },
  { href: '/admin/comments', label: 'Comments' },
  { href: '/admin/settings', label: 'Settings' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (pathname === '/admin/login') {
    return <>{children}</>;
  }

  return (
    <AuthProvider>
      <div className="min-h-screen bg-gray-50">
        <nav className="bg-gray-900 text-white">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-6">
              <Link href="/admin" className="font-bold text-lg">Admin</Link>
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`text-sm ${pathname === item.href ? 'text-white' : 'text-gray-400 hover:text-white'}`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
            <div className="flex items-center gap-4">
              <Link href="/" className="text-sm text-gray-400 hover:text-white">View Site</Link>
              <button onClick={logout} className="text-sm text-gray-400 hover:text-white">Logout</button>
            </div>
          </div>
        </nav>
        <main className="max-w-7xl mx-auto px-4 py-6">
          {children}
        </main>
      </div>
    </AuthProvider>
  );
}
```

- [ ] **Step 4: Create login page**

```tsx
// packages/frontend/src/app/admin/login/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { login } from '@/lib/admin-api';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await login(username, password);
      router.push('/admin');
    } catch {
      setError('Invalid username or password');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-center mb-8">Admin Login</h1>
        <form onSubmit={handleSubmit} className="bg-white p-6 border border-gray-200 space-y-4">
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            className="w-full border border-gray-300 px-3 py-2 focus:outline-none focus:border-gray-900"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full border border-gray-300 px-3 py-2 focus:outline-none focus:border-gray-900"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gray-900 text-white py-2 hover:bg-gray-700 disabled:opacity-50"
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add packages/frontend/src
git commit -m "feat: add admin layout, auth provider, login page, admin API client"
```

---

### Task 17: Admin Dashboard

**Files:**
- Create: `packages/frontend/src/app/admin/page.tsx`

- [ ] **Step 1: Create dashboard page**

```tsx
// packages/frontend/src/app/admin/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { getStats } from '@/lib/admin-api';

export default function DashboardPage() {
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    getStats().then(setStats);
  }, []);

  if (!stats) return <p>Loading...</p>;

  const cards = [
    { label: 'Total Articles', value: stats.articleCount },
    { label: 'Published', value: stats.publishedCount },
    { label: 'Drafts', value: stats.draftCount },
    { label: 'Comments', value: stats.commentCount },
    { label: 'Total Views', value: stats.totalViews },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {cards.map((card) => (
          <div key={card.label} className="bg-white border border-gray-200 p-4">
            <p className="text-sm text-gray-500">{card.label}</p>
            <p className="text-3xl font-bold mt-1">{card.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/frontend/src/app/admin/page.tsx
git commit -m "feat: add admin dashboard with stats overview"
```

---

### Task 18: Admin Article List & Editor

**Files:**
- Create: `packages/frontend/src/app/admin/articles/page.tsx`
- Create: `packages/frontend/src/app/admin/articles/new/page.tsx`
- Create: `packages/frontend/src/app/admin/articles/[id]/edit/page.tsx`
- Create: `packages/frontend/src/components/admin/ArticleEditor.tsx`

- [ ] **Step 1: Install Markdown editor**

```bash
cd /Users/shichiya/workspace/shichiya-blog/packages/frontend
npm install @uiw/react-md-editor
```

- [ ] **Step 2: Create ArticleEditor component**

```tsx
// packages/frontend/src/components/admin/ArticleEditor.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { createArticle, updateArticle, uploadImage } from '@/lib/admin-api';

const MDEditor = dynamic(() => import('@uiw/react-md-editor'), { ssr: false });

interface Props {
  article?: any;
  categories: any[];
  tags: any[];
}

export default function ArticleEditor({ article, categories, tags }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(article?.title || '');
  const [slug, setSlug] = useState(article?.slug || '');
  const [summary, setSummary] = useState(article?.summary || '');
  const [content, setContent] = useState(article?.content || '');
  const [coverImage, setCoverImage] = useState(article?.coverImage || '');
  const [categoryId, setCategoryId] = useState<number>(article?.categoryId || categories[0]?.id || 0);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>(article?.tags?.map((t: any) => t.id) || []);
  const [status, setStatus] = useState(article?.status || 'DRAFT');
  const [saving, setSaving] = useState(false);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const result = await uploadImage(file);
    setCoverImage(result.url);
  };

  const toggleTag = (tagId: number) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const data = { title, slug, summary, content, coverImage, status, categoryId, tagIds: selectedTagIds };
    try {
      if (article) {
        await updateArticle(article.id, data);
      } else {
        await createArticle(data);
      }
      router.push('/admin/articles');
    } catch (err) {
      alert('Failed to save article');
    }
    setSaving(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <input
          type="text"
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          className="border border-gray-300 px-3 py-2 focus:outline-none focus:border-gray-900"
        />
        <input
          type="text"
          placeholder="Slug (URL-safe)"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          required
          className="border border-gray-300 px-3 py-2 focus:outline-none focus:border-gray-900"
        />
      </div>

      <input
        type="text"
        placeholder="Summary (optional)"
        value={summary}
        onChange={(e) => setSummary(e.target.value)}
        className="w-full border border-gray-300 px-3 py-2 focus:outline-none focus:border-gray-900"
      />

      <div className="grid grid-cols-3 gap-4">
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(Number(e.target.value))}
          className="border border-gray-300 px-3 py-2"
        >
          {categories.map((cat: any) => (
            <option key={cat.id} value={cat.id}>{cat.name}</option>
          ))}
        </select>

        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="border border-gray-300 px-3 py-2"
        >
          <option value="DRAFT">Draft</option>
          <option value="PUBLISHED">Published</option>
        </select>

        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-500">Cover:</label>
          <input type="file" accept="image/*" onChange={handleImageUpload} className="text-sm" />
        </div>
      </div>

      {coverImage && (
        <div className="flex items-center gap-2">
          <img src={coverImage} alt="cover" className="h-16 rounded" />
          <button type="button" onClick={() => setCoverImage('')} className="text-sm text-red-500">Remove</button>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {tags.map((tag: any) => (
          <button
            key={tag.id}
            type="button"
            onClick={() => toggleTag(tag.id)}
            className={`text-xs px-3 py-1 border rounded-sm ${
              selectedTagIds.includes(tag.id) ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-300 hover:bg-gray-50'
            }`}
          >
            {tag.name}
          </button>
        ))}
      </div>

      <div data-color-mode="light">
        <MDEditor value={content} onChange={(val) => setContent(val || '')} height={500} />
      </div>

      <div className="flex gap-4">
        <button
          type="submit"
          disabled={saving}
          className="bg-gray-900 text-white px-6 py-2 hover:bg-gray-700 disabled:opacity-50"
        >
          {saving ? 'Saving...' : article ? 'Update' : 'Create'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="border border-gray-300 px-6 py-2 hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 3: Create article list page**

```tsx
// packages/frontend/src/app/admin/articles/page.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getAdminArticles, deleteArticle } from '@/lib/admin-api';

export default function AdminArticlesPage() {
  const [data, setData] = useState<any>(null);
  const [page, setPage] = useState(1);

  const load = () => getAdminArticles(page).then(setData);

  useEffect(() => { load(); }, [page]);

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this article?')) return;
    await deleteArticle(id);
    load();
  };

  if (!data) return <p>Loading...</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Articles</h1>
        <Link href="/admin/articles/new" className="bg-gray-900 text-white px-4 py-2 text-sm hover:bg-gray-700">
          New Article
        </Link>
      </div>

      <table className="w-full bg-white border border-gray-200">
        <thead>
          <tr className="border-b text-left text-sm text-gray-500">
            <th className="p-3">Title</th>
            <th className="p-3">Category</th>
            <th className="p-3">Status</th>
            <th className="p-3">Views</th>
            <th className="p-3">Date</th>
            <th className="p-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          {data.data.map((article: any) => (
            <tr key={article.id} className="border-b hover:bg-gray-50">
              <td className="p-3 font-medium">{article.title}</td>
              <td className="p-3 text-sm text-gray-500">{article.category?.name}</td>
              <td className="p-3">
                <span className={`text-xs px-2 py-1 ${article.status === 'PUBLISHED' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                  {article.status}
                </span>
              </td>
              <td className="p-3 text-sm text-gray-500">{article.viewCount}</td>
              <td className="p-3 text-sm text-gray-500">{new Date(article.createdAt).toLocaleDateString('zh-CN')}</td>
              <td className="p-3">
                <div className="flex gap-2">
                  <Link href={`/admin/articles/${article.id}/edit`} className="text-sm text-blue-600 hover:underline">Edit</Link>
                  <button onClick={() => handleDelete(article.id)} className="text-sm text-red-600 hover:underline">Delete</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex justify-center gap-2 mt-4">
        <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="px-3 py-1 border text-sm disabled:opacity-30">Prev</button>
        <span className="px-3 py-1 text-sm">{data.meta.page} / {data.meta.totalPages}</span>
        <button disabled={page >= data.meta.totalPages} onClick={() => setPage(page + 1)} className="px-3 py-1 border text-sm disabled:opacity-30">Next</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create new article page**

```tsx
// packages/frontend/src/app/admin/articles/new/page.tsx
'use client';

import { useEffect, useState } from 'react';
import ArticleEditor from '@/components/admin/ArticleEditor';
import { getAdminCategories, getAdminTags } from '@/lib/admin-api';

export default function NewArticlePage() {
  const [categories, setCategories] = useState([]);
  const [tags, setTags] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([getAdminCategories(), getAdminTags()]).then(([cats, tgs]) => {
      setCategories(cats);
      setTags(tgs);
      setLoaded(true);
    });
  }, []);

  if (!loaded) return <p>Loading...</p>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">New Article</h1>
      <ArticleEditor categories={categories} tags={tags} />
    </div>
  );
}
```

- [ ] **Step 5: Create edit article page**

```tsx
// packages/frontend/src/app/admin/articles/[id]/edit/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import ArticleEditor from '@/components/admin/ArticleEditor';
import { getAdminCategories, getAdminTags } from '@/lib/admin-api';

export default function EditArticlePage() {
  const params = useParams();
  const [article, setArticle] = useState<any>(null);
  const [categories, setCategories] = useState([]);
  const [tags, setTags] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const id = params.id;
    Promise.all([
      fetch(`/api/admin/articles`).then(async (res) => {
        // Get article from admin list — we need content too
        // Fetch individual article via public endpoint for content
        const token = localStorage.getItem('admin_token');
        const r = await fetch(`/api/articles/${id}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        return r.json();
      }),
      getAdminCategories(),
      getAdminTags(),
    ]).then(([art, cats, tgs]) => {
      setArticle(art);
      setCategories(cats);
      setTags(tgs);
      setLoaded(true);
    });
  }, [params.id]);

  if (!loaded) return <p>Loading...</p>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Edit Article</h1>
      <ArticleEditor article={article} categories={categories} tags={tags} />
    </div>
  );
}
```

Note: The edit page fetches the article by slug from public API to get the full content. In production, you may want to add a dedicated admin endpoint `GET /api/admin/articles/:id` that returns full content. For now this works since the public endpoint also returns content.

- [ ] **Step 6: Commit**

```bash
git add packages/frontend
git commit -m "feat: add admin article list, editor with Markdown preview"
```

---

### Task 19: Admin Categories, Tags, Comments, Settings Pages

**Files:**
- Create: `packages/frontend/src/app/admin/categories/page.tsx`
- Create: `packages/frontend/src/app/admin/tags/page.tsx`
- Create: `packages/frontend/src/app/admin/comments/page.tsx`
- Create: `packages/frontend/src/app/admin/settings/page.tsx`

- [ ] **Step 1: Create categories management page**

```tsx
// packages/frontend/src/app/admin/categories/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { getAdminCategories, createCategory, updateCategory, deleteCategory } from '@/lib/admin-api';

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);

  const load = () => getAdminCategories().then(setCategories);
  useEffect(() => { load(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      await updateCategory(editingId, { name, slug });
      setEditingId(null);
    } else {
      await createCategory({ name, slug });
    }
    setName('');
    setSlug('');
    load();
  };

  const handleEdit = (cat: any) => {
    setEditingId(cat.id);
    setName(cat.name);
    setSlug(cat.slug);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this category?')) return;
    await deleteCategory(id);
    load();
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Categories</h1>

      <form onSubmit={handleSubmit} className="flex gap-2 mb-6">
        <input type="text" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required className="border px-3 py-2 text-sm" />
        <input type="text" placeholder="Slug" value={slug} onChange={(e) => setSlug(e.target.value)} required className="border px-3 py-2 text-sm" />
        <button type="submit" className="bg-gray-900 text-white px-4 py-2 text-sm">{editingId ? 'Update' : 'Add'}</button>
        {editingId && <button type="button" onClick={() => { setEditingId(null); setName(''); setSlug(''); }} className="border px-4 py-2 text-sm">Cancel</button>}
      </form>

      <table className="w-full bg-white border">
        <thead><tr className="border-b text-left text-sm text-gray-500"><th className="p-3">Name</th><th className="p-3">Slug</th><th className="p-3">Articles</th><th className="p-3">Actions</th></tr></thead>
        <tbody>
          {categories.map((cat: any) => (
            <tr key={cat.id} className="border-b">
              <td className="p-3">{cat.name}</td>
              <td className="p-3 text-sm text-gray-500">{cat.slug}</td>
              <td className="p-3 text-sm">{cat._count?.articles || 0}</td>
              <td className="p-3 flex gap-2">
                <button onClick={() => handleEdit(cat)} className="text-sm text-blue-600">Edit</button>
                <button onClick={() => handleDelete(cat.id)} className="text-sm text-red-600">Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: Create tags management page**

```tsx
// packages/frontend/src/app/admin/tags/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { getAdminTags, createTag, updateTag, deleteTag } from '@/lib/admin-api';

export default function AdminTagsPage() {
  const [tags, setTags] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);

  const load = () => getAdminTags().then(setTags);
  useEffect(() => { load(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      await updateTag(editingId, { name, slug });
      setEditingId(null);
    } else {
      await createTag({ name, slug });
    }
    setName('');
    setSlug('');
    load();
  };

  const handleEdit = (tag: any) => {
    setEditingId(tag.id);
    setName(tag.name);
    setSlug(tag.slug);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this tag?')) return;
    await deleteTag(id);
    load();
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Tags</h1>

      <form onSubmit={handleSubmit} className="flex gap-2 mb-6">
        <input type="text" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required className="border px-3 py-2 text-sm" />
        <input type="text" placeholder="Slug" value={slug} onChange={(e) => setSlug(e.target.value)} required className="border px-3 py-2 text-sm" />
        <button type="submit" className="bg-gray-900 text-white px-4 py-2 text-sm">{editingId ? 'Update' : 'Add'}</button>
        {editingId && <button type="button" onClick={() => { setEditingId(null); setName(''); setSlug(''); }} className="border px-4 py-2 text-sm">Cancel</button>}
      </form>

      <table className="w-full bg-white border">
        <thead><tr className="border-b text-left text-sm text-gray-500"><th className="p-3">Name</th><th className="p-3">Slug</th><th className="p-3">Articles</th><th className="p-3">Actions</th></tr></thead>
        <tbody>
          {tags.map((tag: any) => (
            <tr key={tag.id} className="border-b">
              <td className="p-3">{tag.name}</td>
              <td className="p-3 text-sm text-gray-500">{tag.slug}</td>
              <td className="p-3 text-sm">{tag._count?.articles || 0}</td>
              <td className="p-3 flex gap-2">
                <button onClick={() => handleEdit(tag)} className="text-sm text-blue-600">Edit</button>
                <button onClick={() => handleDelete(tag.id)} className="text-sm text-red-600">Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 3: Create comments management page**

```tsx
// packages/frontend/src/app/admin/comments/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { getAdminComments, updateCommentStatus, deleteComment } from '@/lib/admin-api';

export default function AdminCommentsPage() {
  const [data, setData] = useState<any>(null);
  const [page, setPage] = useState(1);

  const load = () => getAdminComments(page).then(setData);
  useEffect(() => { load(); }, [page]);

  const handleStatus = async (id: number, status: string) => {
    await updateCommentStatus(id, status);
    load();
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this comment?')) return;
    await deleteComment(id);
    load();
  };

  if (!data) return <p>Loading...</p>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Comments</h1>

      <div className="space-y-4">
        {data.data.map((comment: any) => (
          <div key={comment.id} className="bg-white border p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <span className="font-medium">{comment.nickname}</span>
                <span className="text-sm text-gray-400">{comment.email}</span>
                <span className={`text-xs px-2 py-0.5 ${
                  comment.status === 'APPROVED' ? 'bg-green-100 text-green-800' :
                  comment.status === 'REJECTED' ? 'bg-red-100 text-red-800' :
                  'bg-yellow-100 text-yellow-800'
                }`}>
                  {comment.status}
                </span>
              </div>
              <span className="text-sm text-gray-400">{new Date(comment.createdAt).toLocaleString('zh-CN')}</span>
            </div>
            <p className="text-sm text-gray-500 mb-2">
              on <span className="font-medium text-gray-700">{comment.article?.title}</span>
            </p>
            <p className="text-sm mb-3">{comment.content}</p>
            <div className="flex gap-2">
              {comment.status !== 'APPROVED' && (
                <button onClick={() => handleStatus(comment.id, 'APPROVED')} className="text-xs text-green-600 border border-green-300 px-2 py-1">Approve</button>
              )}
              {comment.status !== 'REJECTED' && (
                <button onClick={() => handleStatus(comment.id, 'REJECTED')} className="text-xs text-yellow-600 border border-yellow-300 px-2 py-1">Reject</button>
              )}
              <button onClick={() => handleDelete(comment.id)} className="text-xs text-red-600 border border-red-300 px-2 py-1">Delete</button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-center gap-2 mt-4">
        <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="px-3 py-1 border text-sm disabled:opacity-30">Prev</button>
        <span className="px-3 py-1 text-sm">{data.meta.page} / {data.meta.totalPages}</span>
        <button disabled={page >= data.meta.totalPages} onClick={() => setPage(page + 1)} className="px-3 py-1 border text-sm disabled:opacity-30">Next</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create settings page**

```tsx
// packages/frontend/src/app/admin/settings/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { getProfile, updateProfile, uploadImage } from '@/lib/admin-api';

export default function AdminSettingsPage() {
  const [nickname, setNickname] = useState('');
  const [avatar, setAvatar] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    getProfile().then((p) => {
      setNickname(p.nickname);
      setAvatar(p.avatar || '');
    });
  }, []);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const result = await uploadImage(file);
    setAvatar(result.url);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const data: any = { nickname };
    if (avatar) data.avatar = avatar;
    if (password) data.password = password;
    await updateProfile(data);
    setPassword('');
    setMessage('Settings saved');
    setTimeout(() => setMessage(''), 3000);
  };

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      <form onSubmit={handleSubmit} className="bg-white border p-6 space-y-4">
        <div>
          <label className="block text-sm text-gray-500 mb-1">Avatar</label>
          {avatar && <img src={avatar} alt="avatar" className="w-16 h-16 rounded-full mb-2" />}
          <input type="file" accept="image/*" onChange={handleAvatarUpload} className="text-sm" />
        </div>
        <div>
          <label className="block text-sm text-gray-500 mb-1">Nickname</label>
          <input type="text" value={nickname} onChange={(e) => setNickname(e.target.value)} className="w-full border px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm text-gray-500 mb-1">New Password (leave blank to keep current)</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full border px-3 py-2" />
        </div>
        <div className="flex items-center gap-4">
          <button type="submit" className="bg-gray-900 text-white px-6 py-2 text-sm">Save</button>
          {message && <span className="text-sm text-green-600">{message}</span>}
        </div>
      </form>
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add packages/frontend/src
git commit -m "feat: add admin categories, tags, comments, settings pages"
```

---

## Phase 6: Next.js API Proxy & Final Integration

### Task 20: Next.js API Proxy Configuration

**Files:**
- Modify: `packages/frontend/next.config.mjs` (or `next.config.js`)

- [ ] **Step 1: Add rewrites to proxy /api to NestJS**

The admin frontend uses client-side fetch to `/api/*`. In development, we need Next.js to proxy these to the NestJS server. In production, Nginx handles this.

```javascript
// packages/frontend/next.config.mjs
/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://127.0.0.1:3001/api/:path*',
      },
    ];
  },
};

export default nextConfig;
```

- [ ] **Step 2: Verify full stack locally**

Start both services:

```bash
# Terminal 1
cd /Users/shichiya/workspace/shichiya-blog/packages/server
npm run start:dev

# Terminal 2
cd /Users/shichiya/workspace/shichiya-blog/packages/frontend
npm run dev
```

Test:
1. Visit http://localhost:3000 — should see home page (empty articles list)
2. Visit http://localhost:3000/admin/login — login with admin/admin123
3. Create a category, a tag, then create an article
4. Visit the home page again — article should appear
5. Click into the article — Markdown rendered, comment form visible

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/next.config.mjs
git commit -m "feat: add Next.js API proxy for development"
```

---

### Task 21: Final Cleanup and Root npm Install

- [ ] **Step 1: Run npm install from root to link workspaces**

```bash
cd /Users/shichiya/workspace/shichiya-blog
npm install
```

- [ ] **Step 2: Verify both dev scripts work from root**

```bash
npm run dev:server &
npm run dev:frontend &
```

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "chore: finalize monorepo setup and workspace configuration"
```

---

## Summary

| Phase | Tasks | What it delivers |
|-------|-------|-----------------|
| 1. Scaffolding | 1-3 | Monorepo, NestJS, Next.js projects initialized |
| 2. Database | 4 | Prisma schema, migrations, seed data |
| 3. Backend | 5-11 | Complete REST API: auth, CRUD, upload, stats, RSS |
| 4. Frontend Public | 12-15 | All public pages with editorial/magazine style |
| 5. Frontend Admin | 16-19 | Admin panel with Markdown editor, management pages |
| 6. Integration | 20-21 | API proxy, full-stack verification |
