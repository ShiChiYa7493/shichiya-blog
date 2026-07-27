# 物品图片缓存与展示 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 `wmi` 查价卡片与 `遗物` 卡片显示物品图像，图片按需下载并落盘缓存，渲染时零网络等待。

**Architecture:** 缓存层放在 `src/warframe/infrastructure/`，输入图片 URL、输出本地文件路径，下载走既有的 `fetchAsyncImage`。服务层负责把路径写进领域数据，组件只渲染 `<img src>` —— 这是 AGENTS.md 的硬性分层要求（组件不得 import infrastructure）。

**Tech Stack:** TypeScript · node:fs/promises · puppeteer（经 koishi-plugin-puppeteer）· vitest + chai

## Global Constraints

工作目录 `packages/wf-bot/external/warframe`，分支 `fix/workspace-test-resolution`。

- Node 22（`nvm use 22`）；`npx vitest run` 测试，`npm run build` 构建，`npx tsc --noEmit -p tsconfig.json` 类型检查。
- **分层铁律**：`src/warframe/` 内不得 import Koishi / @satorijs/element / puppeteer，不得用 `console.*`；组件只能从域门面取数据。
- **HTTP 只走 `src/warframe/utils/http.ts`**，已有 `fetchAsyncImage(url): Promise<Blob | undefined>`。
- 基线 **484 passed**，不得下降。
- 改动尽量小，避免与上游冲突。

## 已实测的前提（勿再假设）

| 事实 | 证据 |
|---|---|
| `file://` 子资源可加载，无需 base64 内联 | 插件先 `page.goto(本地 index.html)` 再 `setContent`，文档源为 `file://`；实测 `naturalWidth=307` |
| 用 `thumb` 而非 `icon` | icon 209,006 字节 / thumb 18,838 字节（128×128），小 11 倍 |
| 图标 URL 已在数据中 | `wfm-api-client` 的 `ItemI18N` 含 `icon` / `thumb` |
| 遗物奖励已解析为 wm Item | `applyRelicData` 用 `globalItemGameRefDict[element.name]` 拿到完整 `Item`，平台价与金币值即来源于此 |
| 完整 URL 拼法 | `https://warframe.market/static/assets/` + `thumb` 路径 |

---

### Task 1: 图片缓存模块

**Files:**
- Create: `src/warframe/infrastructure/image-cache.ts`
- Test: `tests/infrastructure/imageCache.infra.spec.ts`

**Interfaces:**
- Consumes: `fetchAsyncImage` from `../utils/http`
- Produces:
  - `interface ImageCacheOptions { dir?: string, maxBytes?: number, download?: (url: string) => Promise<Blob | undefined> }`
  - `createImageCache(options?: ImageCacheOptions): { get(url: string): Promise<string | undefined>, dir: string }`
  - `get()` 返回本地绝对路径；下载失败返回 `undefined`（由调用方决定降级）

- [ ] **Step 1: 写失败的测试**

创建 `tests/infrastructure/imageCache.infra.spec.ts`。用注入的假 downloader，测试不打真实网络：

```typescript
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect } from 'chai'

import { createImageCache } from '../../src/warframe/infrastructure/image-cache'

function tempDir(): string {
  return mkdtempSync(join(tmpdir(), 'wf-image-cache-'))
}

describe('image cache', () => {
  it('downloads once and returns a local path', async () => {
    let calls = 0
    const cache = createImageCache({
      dir: tempDir(),
      download: async () => {
        calls += 1
        return new Blob([new Uint8Array([1, 2, 3])])
      },
    })

    const first = await cache.get('https://example.test/a.png')
    expect(first).to.be.a('string')
    expect(readFileSync(first!)).to.have.length(3)

    const second = await cache.get('https://example.test/a.png')
    expect(second).to.equal(first)
    expect(calls).to.equal(1)
  })

  it('reuses an existing file without downloading', async () => {
    const dir = tempDir()
    let calls = 0
    const cache = createImageCache({
      dir,
      download: async () => {
        calls += 1
        return new Blob([new Uint8Array([9])])
      },
    })

    const path = await cache.get('https://example.test/b.png')
    // 新建一个实例模拟进程重启，命中的应是磁盘上已有的文件
    const restarted = createImageCache({
      dir,
      download: async () => {
        calls += 1
        return new Blob([new Uint8Array([9])])
      },
    })
    expect(await restarted.get('https://example.test/b.png')).to.equal(path)
    expect(calls).to.equal(1)
  })

  it('returns undefined when the download fails, without throwing', async () => {
    const cache = createImageCache({
      dir: tempDir(),
      download: async () => undefined,
    })
    expect(await cache.get('https://example.test/missing.png')).to.equal(undefined)
  })

  it('derives distinct filenames for distinct urls', async () => {
    const cache = createImageCache({
      dir: tempDir(),
      download: async () => new Blob([new Uint8Array([1])]),
    })
    const a = await cache.get('https://example.test/a.png')
    const b = await cache.get('https://example.test/b.png')
    expect(a).to.not.equal(b)
  })

  it('evicts the oldest files once the size cap is exceeded', async () => {
    const dir = tempDir()
    const cache = createImageCache({
      dir,
      maxBytes: 10,
      download: async () => new Blob([new Uint8Array(6)]),
    })

    const first = await cache.get('https://example.test/1.png')
    await cache.get('https://example.test/2.png')
    // 两个 6 字节文件超过 10 字节上限，最旧的应被清掉
    expect(() => readFileSync(first!)).to.throw()
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npx vitest run tests/infrastructure/imageCache.infra.spec.ts
```

预期：FAIL，模块不存在。

- [ ] **Step 3: 实现**

创建 `src/warframe/infrastructure/image-cache.ts`：

```typescript
import { createHash } from 'node:crypto'
import { mkdirSync, readdirSync, statSync, unlinkSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { extname, join } from 'node:path'

import { fetchAsyncImage } from '../utils/http'

export interface ImageCacheOptions {
  /** 缓存目录，默认在系统临时目录下 */
  dir?: string
  /** 容量上限，超出后按最旧优先淘汰。默认 128MB */
  maxBytes?: number
  /** 下载实现，便于测试注入 */
  download?: (url: string) => Promise<Blob | undefined>
}

const DEFAULT_MAX_BYTES = 128 * 1024 * 1024

/**
 * 按需下载并落盘缓存图片，返回本地绝对路径。
 *
 * 渲染侧用 `file://` 引用该路径，puppeteer 不再触网 —— 否则每张外链图
 * 都要等网络往返，一次遗物查询（多张图）会把出图时间拖到十几秒。
 */
export function createImageCache(options: ImageCacheOptions = {}) {
  const dir = options.dir ?? join(tmpdir(), 'koishi-warframe-images')
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES
  const download = options.download ?? fetchAsyncImage

  mkdirSync(dir, { recursive: true })

  /** 同一 URL 的并发请求共用一次下载 */
  const inflight = new Map<string, Promise<string | undefined>>()

  function pathFor(url: string): string {
    const hash = createHash('sha1').update(url).digest('hex')
    const ext = extname(new URL(url).pathname) || '.png'
    return join(dir, hash + ext)
  }

  function exists(path: string): boolean {
    try {
      return statSync(path).size > 0
    }
    catch {
      return false
    }
  }

  function evictIfNeeded(): void {
    let entries: { path: string, size: number, mtime: number }[]
    try {
      entries = readdirSync(dir).map((name) => {
        const path = join(dir, name)
        const stat = statSync(path)
        return { path, size: stat.size, mtime: stat.mtimeMs }
      })
    }
    catch {
      return
    }

    let total = entries.reduce((sum, entry) => sum + entry.size, 0)
    if (total <= maxBytes) {
      return
    }

    entries.sort((a, b) => a.mtime - b.mtime)
    for (const entry of entries) {
      if (total <= maxBytes) {
        break
      }
      try {
        unlinkSync(entry.path)
        total -= entry.size
      }
      catch {
        // 删不掉就跳过，缓存容量不是正确性问题
      }
    }
  }

  async function fetchToDisk(url: string, path: string): Promise<string | undefined> {
    const blob = await download(url)
    if (!blob) {
      return undefined
    }

    const buffer = Buffer.from(await blob.arrayBuffer())
    if (buffer.length === 0) {
      return undefined
    }

    await writeFile(path, buffer)
    evictIfNeeded()
    return exists(path) ? path : undefined
  }

  return {
    dir,
    async get(url: string): Promise<string | undefined> {
      if (!url) {
        return undefined
      }

      const path = pathFor(url)
      if (exists(path)) {
        return path
      }

      const pending = inflight.get(url)
      if (pending) {
        return pending
      }

      const task = fetchToDisk(url, path).finally(() => inflight.delete(url))
      inflight.set(url, task)
      return task
    },
  }
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
npx vitest run tests/infrastructure/imageCache.infra.spec.ts
npx tsc --noEmit -p tsconfig.json
```

预期：5 个测试全部 PASS，类型检查无输出。

- [ ] **Step 5: 提交**

```bash
git add src/warframe/infrastructure/image-cache.ts tests/infrastructure/imageCache.infra.spec.ts
git commit -m "feat: add on-disk image cache

Downloads item images on demand and returns a local path so the renderer
can reference them via file:// and never touch the network. Puppeteer
waits for every external image before screenshotting, which would push a
multi-image card to well over ten seconds on a cold cache.

Concurrent requests for the same url share one download, and the cache
evicts oldest-first once it exceeds its size cap."
```

---

### Task 2: wm 查价卡片显示物品图

**Files:**
- Modify: `src/warframe/services/wfm-service/index.ts`
- Modify: `src/warframe/types/wfm.ts`
- Modify: `src/components/wfm.tsx`
- Test: `tests/services/wfm/itemImage.wfm.spec.ts`

**Interfaces:**
- Consumes: `createImageCache` from Task 1
- Produces: 查价结果新增 `thumbPath?: string` 字段（本地路径，取不到时为 `undefined`）

- [ ] **Step 1: 摸清现状**

先读以下内容，不要凭猜测改：

```bash
grep -n "i18n" src/warframe/services/wfm-service/index.ts | head
grep -n "export function.*Component" src/components/wfm.tsx
```

确认 wm 查价链路上持有 `Item` 对象的位置，以及查价组件的函数签名与它接收的数据类型。**图片路径必须在服务层解析好再传给组件**，组件不得自己取。

- [ ] **Step 2: 写失败的测试**

新建 `tests/services/wfm/itemImage.wfm.spec.ts`，测试「给定一个带 `i18n['zh-hans'].thumb` 的 Item 与一个假缓存，服务产出 `thumbPath`；thumb 缺失或缓存返回 undefined 时，`thumbPath` 为 undefined 且不抛错」。

具体断言依 Step 1 读到的实际函数签名书写——本步骤必须先读代码再落笔。

- [ ] **Step 3: 运行确认失败**

```bash
npx vitest run tests/services/wfm/itemImage.wfm.spec.ts
```

- [ ] **Step 4: 服务层解析图片路径**

在查价服务中，用 `thumb` 而非 `icon`（小 11 倍），拼出完整 URL 后经缓存取本地路径：

```typescript
const WFM_ASSET_BASE = 'https://warframe.market/static/assets/'

const thumb = item.i18n?.['zh-hans']?.thumb ?? item.i18n?.en?.thumb
const thumbPath = thumb
  ? await imageCache.get(WFM_ASSET_BASE + thumb)
  : undefined
```

缓存实例用模块级单例（`const imageCache = createImageCache()`），与该目录下其他数据单例的写法保持一致。

- [ ] **Step 5: 组件渲染图片**

在查价组件的标题处加入图片，取不到路径时**不渲染 `<img>`**，卡片照常显示：

```tsx
{data.thumbPath
  ? <img src={`file://${data.thumbPath}`} style="width:48px;height:48px;object-fit:contain;margin-right:10px;" />
  : ''}
```

- [ ] **Step 6: 测试、类型检查、构建**

```bash
npx vitest run
npx tsc --noEmit -p tsconfig.json
npm run build
```

预期：测试数不下降，类型检查与构建均通过。

- [ ] **Step 7: 手工验证**

重启 Koishi，沙盒发送 `wmi 猴p`。预期卡片左上出现物品图。**再发一次同样的命令**，第二次应明显更快（缓存命中）。

- [ ] **Step 8: 提交**

```bash
git add -A
git commit -m "feat: show the item image on market price cards

Uses the thumb variant (18KB) rather than icon (209KB); at 128x128 it is
more than enough for a card thumbnail. The path is resolved in the
service layer and passed down as data, since components are not allowed
to reach into infrastructure. A missing image degrades to no <img> rather
than failing the card."
```

---

### Task 3: 遗物卡片显示部件图

`applyRelicData` 已经把每个奖励项解析成完整的 wm `Item`（平台价与金币值即来源于此），因此图片路径可顺带取出，无需新增映射层。

**Files:**
- Modify: `src/warframe/services/wfm-service/index.ts`（`applyRelicData`）
- Modify: `src/warframe/types/wf/relic.ts`（`OutputRelicReward` 增加 `thumbPath?`）
- Modify: `src/components/wf.tsx`（`RelicComponent`）
- Test: `tests/services/wf/relicImage.wf.spec.ts`

**Interfaces:**
- Consumes: Task 1 的缓存、`applyRelicData` 现有的 `globalItemGameRefDict`
- Produces: `OutputRelicReward` 新增 `thumbPath?: string`

- [ ] **Step 1: 写失败的测试**

新建 `tests/services/wf/relicImage.wf.spec.ts`，覆盖三种情形：

1. 奖励项能在 `globalItemGameRefDict` 中命中且有 thumb → `thumbPath` 为本地路径
2. 奖励项**未命中**字典（走 `pascalToSpaced` 那条降级分支）→ `thumbPath` 为 undefined，且名称降级逻辑不受影响
3. 命中但缓存取图失败 → `thumbPath` 为 undefined，其余字段（名称/金币/平台价）不受影响

第 2 种情形尤其重要：`applyRelicData` 现有的未命中分支返回的是拼接名称，不能因为新增图片逻辑而破坏它。

- [ ] **Step 2: 运行确认失败**

```bash
npx vitest run tests/services/wf/relicImage.wf.spec.ts
```

- [ ] **Step 3: 扩展类型**

在 `src/warframe/types/wf/relic.ts` 中：

```typescript
export interface OutputRelicReward extends RelicReward {
  ducats?: number
  platinum?: number
  /** 部件缩略图的本地路径，取不到时为 undefined */
  thumbPath?: string
}
```

- [ ] **Step 4: 在 applyRelicData 中解析路径**

`applyRelicData` 现在用的是同步 `.map()`，加入下载后需要改成并发解析：

```typescript
const loadedItems = await Promise.all(
  relic.items.map(async (element): Promise<OutputRelicReward> => {
    // …未命中分支保持原样，仅额外返回 thumbPath: undefined
    // …命中分支追加：
    const thumb = item.i18n?.['zh-hans']?.thumb ?? item.i18n?.en?.thumb
    const thumbPath = thumb ? await imageCache.get(WFM_ASSET_BASE + thumb) : undefined
  }),
)
```

用 `Promise.all` 而非串行 `for` 循环：一个遗物有 6 个奖励项，串行下载在冷缓存时会把出图时间拉长数倍。缓存层已对同 URL 的并发做了去重。

- [ ] **Step 5: 组件渲染部件图**

在 `RelicComponent` 的每个奖励行首加入 24×24 小图，取不到则不渲染，保持行高一致。

- [ ] **Step 6: 测试、类型检查、构建**

```bash
npx vitest run
npx tsc --noEmit -p tsconfig.json
npm run build
```

- [ ] **Step 7: 手工验证**

重启 Koishi，沙盒发送 `遗物 后纪a2`。预期每个部件行前出现小图；**部分部件（如 Forma 蓝图）可能在 wm 字典中未命中，那些行没有图属于预期行为**，不是缺陷。

- [ ] **Step 8: 提交**

```bash
git add -A
git commit -m "feat: show part images on relic cards

applyRelicData already resolves each reward to a full market Item — that
is where the ducat and platinum values come from — so the thumbnail path
comes along for free, with no name-to-slug mapping layer needed.

Rewards are now resolved concurrently: a relic has six of them, and a
cold cache would otherwise serialise six downloads into the render path.
Rewards missing from the market dictionary simply render without an
image, exactly as they already render without a price."
```

---

## 后续（不在本计划内）

- **换皮**：阻塞于视觉稿。配色集中在 `src/assets/render.css` 的 CSS 自定义属性。
- **启动预热**：把常用物品的图提前拉好，消除首次查询的冷缓存延迟。国内服务器尤其需要。本计划先不做，等实际观察冷命中延迟再定。
- **服务器基线部署**：阻塞于 QQ 小号。注意部署机需能访问 `warframe.market`（已实测可通）。
- **群务子系统**：单独 spec。
