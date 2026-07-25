# 模糊命令触发中间件 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让群友把命令打错字或漏字（`钢铁裂逢`、`钢铁裂`、`遗物后纪a2`）时，bot 仍能正确识别并响应。

**Architecture:** 一个 Koishi 前置中间件，挂在命令解析之前。它把消息归一化后与所有已注册命令名/别名比对：精确命中原样放行，模糊命中则改写 `session.content` 再放行，多个候选时回一句让用户选，完全不像命令则静默放行。核心匹配逻辑是纯函数，与 Koishi 解耦，可脱离框架单测。

**Tech Stack:** TypeScript · Koishi 4.18 · pinyin-pro（拼音）· opencc-js（繁简）· vitest（测试）

## Global Constraints

- Node 22+（`warframe-worldstate-parser` 要求 `^22.18 || >=24.11`）。开发前执行 `nvm use`，目录内 `.nvmrc` 已固定为 22。
- 所有 npm 操作必须走官方源。`packages/wf-bot/.npmrc` 已覆盖 registry，勿删。
- 不得引入 `@koishijs/cli` 依赖（其 npm latest 为陈旧的 4.10.10，会拉入 cordis 2.x 与 koishi 的 3.18.1 冲突，导致启动时报一连串 cordis/minato TypeError）。`koishi` 包自带 bin。
- 不得引入任何 `warframestat.us` 依赖（部署机被 Cloudflare 按 IP 封禁，403）。
- `packages/wf-bot` 不参与根 workspaces，自管依赖。
- **未命中必须静默放行。** 群里的正常聊天绝不能被 bot 插嘴——这是本中间件最重要的安全约束。

---

### Task 1: 插件骨架，验证 Koishi 能加载

**Files:**
- Modify: `packages/wf-bot/package.json`
- Create: `packages/wf-bot/plugins/fuzzy-command/package.json`
- Create: `packages/wf-bot/plugins/fuzzy-command/tsconfig.json`
- Create: `packages/wf-bot/plugins/fuzzy-command/src/index.ts`
- Modify: `packages/wf-bot/koishi.yml`

**Interfaces:**
- Consumes: 无
- Produces: 一个名为 `fuzzy-command` 的 Koishi 插件，导出 `name: string`、`apply(ctx: Context, config: Config): void`、`Config: Schema<Config>`

- [ ] **Step 1: 把 wf-bot 变成 workspace 根，让本地插件能被解析成模块**

Koishi 的 loader 最终执行 `require(scope.resolve(name))`，因此本地插件必须是可解析的模块。官方 boilerplate 用的就是 workspace 方案。

修改 `packages/wf-bot/package.json`，在 `"private": true` 之后加入：

```json
  "workspaces": [
    "plugins/*"
  ],
```

- [ ] **Step 2: 创建插件包描述**

创建 `packages/wf-bot/plugins/fuzzy-command/package.json`：

```json
{
  "name": "koishi-plugin-fuzzy-command",
  "private": true,
  "version": "0.1.0",
  "main": "lib/index.js",
  "typings": "lib/index.d.ts",
  "files": ["lib"],
  "scripts": {
    "build": "tsc -b",
    "test": "vitest run"
  },
  "peerDependencies": {
    "koishi": "^4.18.11"
  },
  "dependencies": {
    "opencc-js": "^1.4.1",
    "pinyin-pro": "^3.28.2"
  },
  "devDependencies": {
    "@types/node": "^22.10.0",
    "typescript": "^5.8.2",
    "vitest": "^4.1.10"
  }
}
```

- [ ] **Step 3: 创建 tsconfig**

创建 `packages/wf-bot/plugins/fuzzy-command/tsconfig.json`：

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "moduleResolution": "node",
    "outDir": "lib",
    "rootDir": "src",
    "strict": true,
    "declaration": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

- [ ] **Step 4: 写最小插件入口**

创建 `packages/wf-bot/plugins/fuzzy-command/src/index.ts`：

```typescript
import { Context, Schema } from 'koishi'

export const name = 'fuzzy-command'

export interface Config {
  maxInputLength: number
  minFuzzyLength: number
}

export const Config: Schema<Config> = Schema.object({
  maxInputLength: Schema.number().default(12)
    .description('超过该字数的消息不做模糊匹配（显然是聊天不是命令）'),
  minFuzzyLength: Schema.number().default(2)
    .description('参与模糊匹配的最短命令名长度，过短会误伤正常聊天'),
})

export function apply(ctx: Context, config: Config) {
  ctx.logger('fuzzy-command').info('已加载，maxInputLength=%d', config.maxInputLength)
}
```

- [ ] **Step 5: 在 koishi.yml 启用插件**

修改 `packages/wf-bot/koishi.yml`，在 `warframe:` 之前加入（必须在 warframe 之前加载，中间件顺序无关但语义上更清晰）：

```yaml
  fuzzy-command:
```

- [ ] **Step 6: 安装依赖并构建**

```bash
cd packages/wf-bot
nvm use
npm install
npm run build -w plugins/fuzzy-command
```

预期：`lib/index.js` 与 `lib/index.d.ts` 生成成功，无 TS 报错。

- [ ] **Step 7: 启动 Koishi 验证插件被加载**

```bash
cd packages/wf-bot
npx koishi start 2>&1 | head -20
```

预期输出中包含：

```
[I] loader apply plugin fuzzy-command:xxxxxx
[I] fuzzy-command 已加载，maxInputLength=12
```

若报 `cannot resolve fuzzy-command`，说明 workspace 未生效——回到 Step 1 确认 `workspaces` 字段并重跑 `npm install`。

- [ ] **Step 8: 提交**

```bash
git add packages/wf-bot/package.json packages/wf-bot/koishi.yml packages/wf-bot/plugins/fuzzy-command
git commit -m "feat(bot): scaffold fuzzy-command plugin"
```

---

### Task 2: 输入归一化

**Files:**
- Create: `packages/wf-bot/plugins/fuzzy-command/src/normalize.ts`
- Test: `packages/wf-bot/plugins/fuzzy-command/tests/normalize.test.ts`

**Interfaces:**
- Consumes: 无
- Produces: `normalize(input: string): string`

- [ ] **Step 1: 写失败的测试**

创建 `packages/wf-bot/plugins/fuzzy-command/tests/normalize.test.ts`：

```typescript
import { describe, expect, it } from 'vitest'
import { normalize } from '../src/normalize'

describe('normalize', () => {
  it('全角转半角并转小写', () => {
    expect(normalize('ＷＭ　猴ｐ')).toBe('wm 猴p')
  })

  it('繁体转简体', () => {
    expect(normalize('鋼鐵裂縫')).toBe('钢铁裂缝')
  })

  it('去掉首尾空白但保留中间空白（参数切分依赖它）', () => {
    expect(normalize('  遗物 后纪A2  ')).toBe('遗物 后纪a2')
  })

  it('空串安全', () => {
    expect(normalize('')).toBe('')
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd packages/wf-bot/plugins/fuzzy-command
npx vitest run tests/normalize.test.ts
```

预期：FAIL，报错 `Failed to resolve import "../src/normalize"`。

- [ ] **Step 3: 实现**

创建 `packages/wf-bot/plugins/fuzzy-command/src/normalize.ts`：

```typescript
import * as OpenCC from 'opencc-js'

const toSimplified = OpenCC.Converter({ from: 'tw', to: 'cn' })

/** 全角字符转半角，全角空格转普通空格 */
function toHalfWidth(input: string): string {
  return input
    .replace(/[！-～]/g, (ch) =>
      String.fromCharCode(ch.charCodeAt(0) - 0xFEE0))
    .replace(/　/g, ' ')
}

/**
 * 归一化：全角→半角、繁→简、去首尾空白、转小写。
 *
 * 注意不去除中间空白 —— `遗物 后纪a2` 的参数切分依赖它。
 */
export function normalize(input: string): string {
  return toSimplified(toHalfWidth(input)).trim().toLowerCase()
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
npx vitest run tests/normalize.test.ts
```

预期：4 个测试全部 PASS。

- [ ] **Step 5: 提交**

```bash
git add packages/wf-bot/plugins/fuzzy-command/src/normalize.ts packages/wf-bot/plugins/fuzzy-command/tests/normalize.test.ts
git commit -m "feat(bot): add input normalization for fuzzy matching"
```

---

### Task 3: 收集已注册命令名与别名

**Files:**
- Create: `packages/wf-bot/plugins/fuzzy-command/src/candidates.ts`
- Test: `packages/wf-bot/plugins/fuzzy-command/tests/candidates.test.ts`

**Interfaces:**
- Consumes: `normalize(input: string): string`
- Produces:
  - `interface Candidate { canonical: string; normalized: string; command: string }`
  - `collectCandidates(ctx: Context): Candidate[]`

- [ ] **Step 1: 写失败的测试**

创建 `packages/wf-bot/plugins/fuzzy-command/tests/candidates.test.ts`：

```typescript
import { describe, expect, it } from 'vitest'
import { collectCandidates } from '../src/candidates'

/** 只用到 $commander._commandList，用假对象即可，无需启动 Koishi */
function fakeCtx() {
  return {
    $commander: {
      _commandList: [
        { name: 'fissure', _aliases: { 'fissure': {}, '裂缝': {}, '裂隙': {} } },
        { name: 'fissure-sp', _aliases: { 'fissure-sp': {}, '钢铁裂缝': {} } },
      ],
    },
  } as any
}

describe('collectCandidates', () => {
  it('收集所有命令名与别名', () => {
    const names = collectCandidates(fakeCtx()).map((c) => c.canonical).sort()
    expect(names).toEqual(['fissure', 'fissure-sp', '裂隙', '裂缝', '钢铁裂缝'].sort())
  })

  it('记录每个候选归属的命令，用于消歧去重', () => {
    const found = collectCandidates(fakeCtx()).find((c) => c.canonical === '裂隙')
    expect(found?.command).toBe('fissure')
  })

  it('归一化文本随候选一起产出', () => {
    const found = collectCandidates(fakeCtx()).find((c) => c.canonical === 'fissure-sp')
    expect(found?.normalized).toBe('fissure-sp')
  })

  it('重复别名只保留一个', () => {
    const ctx = {
      $commander: {
        _commandList: [
          { name: 'a', _aliases: { 'a': {}, '裂缝': {} } },
          { name: 'b', _aliases: { 'b': {}, '裂缝': {} } },
        ],
      },
    } as any
    expect(collectCandidates(ctx).filter((c) => c.normalized === '裂缝')).toHaveLength(1)
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npx vitest run tests/candidates.test.ts
```

预期：FAIL，无法解析 `../src/candidates`。

- [ ] **Step 3: 实现**

创建 `packages/wf-bot/plugins/fuzzy-command/src/candidates.ts`：

```typescript
import type { Context } from 'koishi'
import { normalize } from './normalize'

export interface Candidate {
  /** 写回 session.content 用的原始命令名/别名 */
  canonical: string
  /** 匹配用的归一化文本 */
  normalized: string
  /** 该候选归属的命令主名，用于消歧时去重 */
  command: string
}

/**
 * 遍历 Koishi 的命令表，取出所有命令名与别名。
 *
 * `ctx.$commander._commandList` 是已注册命令数组，
 * `cmd._aliases` 的键即别名（中文别名也在其中）。
 */
export function collectCandidates(ctx: Context): Candidate[] {
  const seen = new Set<string>()
  const out: Candidate[] = []

  for (const cmd of ctx.$commander._commandList) {
    const names = new Set<string>([cmd.name, ...Object.keys(cmd._aliases ?? {})])
    for (const canonical of names) {
      const normalized = normalize(canonical)
      if (!normalized || seen.has(normalized)) continue
      seen.add(normalized)
      out.push({ canonical, normalized, command: cmd.name })
    }
  }

  return out
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
npx vitest run tests/candidates.test.ts
```

预期：4 个测试全部 PASS。

- [ ] **Step 5: 提交**

```bash
git add packages/wf-bot/plugins/fuzzy-command/src/candidates.ts packages/wf-bot/plugins/fuzzy-command/tests/candidates.test.ts
git commit -m "feat(bot): collect registered command names and aliases"
```

---

### Task 4: 精确匹配与参数粘连切分

**Files:**
- Create: `packages/wf-bot/plugins/fuzzy-command/src/matcher.ts`
- Test: `packages/wf-bot/plugins/fuzzy-command/tests/matcher.test.ts`

**Interfaces:**
- Consumes: `interface Candidate { canonical: string; normalized: string; command: string }`
- Produces:
  - `type MatchResult = { type: 'none' } | { type: 'exact'; canonical: string; rest: string } | { type: 'fuzzy'; canonical: string; rest: string } | { type: 'ambiguous'; canonical: string[] }`
  - `interface MatchOptions { maxInputLength?: number; minFuzzyLength?: number }`
  - `match(input: string, candidates: Candidate[], options?: MatchOptions): MatchResult`

- [ ] **Step 1: 写失败的测试**

创建 `packages/wf-bot/plugins/fuzzy-command/tests/matcher.test.ts`：

```typescript
import { describe, expect, it } from 'vitest'
import { match } from '../src/matcher'
import type { Candidate } from '../src/candidates'

const CANDIDATES: Candidate[] = [
  { canonical: '裂缝', normalized: '裂缝', command: 'fissure' },
  { canonical: '钢铁裂缝', normalized: '钢铁裂缝', command: 'fissure-sp' },
  { canonical: '遗物', normalized: '遗物', command: 'relic' },
  { canonical: 'wmi', normalized: 'wmi', command: 'wmi' },
]

describe('match — 精确与切分', () => {
  it('完全相同视为精确命中，交给 Koishi 原生解析', () => {
    expect(match('钢铁裂缝', CANDIDATES)).toEqual({
      type: 'exact', canonical: '钢铁裂缝', rest: '',
    })
  })

  it('带空格参数：切出命令与参数', () => {
    expect(match('遗物 后纪a2', CANDIDATES)).toEqual({
      type: 'exact', canonical: '遗物', rest: '后纪a2',
    })
  })

  it('参数粘连无空格：仍能切出命令与参数', () => {
    expect(match('遗物后纪a2', CANDIDATES)).toEqual({
      type: 'exact', canonical: '遗物', rest: '后纪a2',
    })
  })

  it('前缀切分取最长候选，避免 裂缝 抢走 钢铁裂缝', () => {
    expect(match('钢铁裂缝', CANDIDATES)).toEqual({
      type: 'exact', canonical: '钢铁裂缝', rest: '',
    })
  })

  it('超长消息直接放弃，正常聊天不被打扰', () => {
    expect(match('今天钢铁裂缝刷了半天什么都没出气死我了真的', CANDIDATES))
      .toEqual({ type: 'none' })
  })

  it('完全无关的消息返回 none', () => {
    expect(match('晚上吃什么', CANDIDATES)).toEqual({ type: 'none' })
  })

  it('以命令名开头的正常聊天不被误判为命令', () => {
    // `遗物是什么` 以候选 `遗物` 开头，但后面不是参数而是聊天内容。
    // 真实参数形态必含字母数字（后纪a2 / 前纪b3），聊天不会。
    expect(match('遗物是什么', CANDIDATES)).toEqual({ type: 'none' })
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npx vitest run tests/matcher.test.ts
```

预期：FAIL，无法解析 `../src/matcher`。

- [ ] **Step 3: 实现精确匹配与切分**

创建 `packages/wf-bot/plugins/fuzzy-command/src/matcher.ts`：

```typescript
import type { Candidate } from './candidates'

export type MatchResult =
  | { type: 'none' }
  | { type: 'exact', canonical: string, rest: string }
  | { type: 'fuzzy', canonical: string, rest: string }
  | { type: 'ambiguous', canonical: string[] }

export interface MatchOptions {
  /** 超过该字数的输入不做匹配，默认 12 */
  maxInputLength?: number
  /** 参与模糊匹配的最短候选长度，默认 2 */
  minFuzzyLength?: number
}

const DEFAULT_MAX_INPUT_LENGTH = 12
const DEFAULT_MIN_FUZZY_LENGTH = 2

/**
 * 按最长候选前缀切分输入。
 * 同时覆盖 `遗物 后纪a2`（带空格）与 `遗物后纪a2`（粘连）两种写法。
 */
function splitByPrefix(input: string, candidates: Candidate[]) {
  let best: { candidate: Candidate, rest: string } | null = null

  for (const candidate of candidates) {
    if (!input.startsWith(candidate.normalized)) continue

    const remainder = input.slice(candidate.normalized.length)
    const rest = remainder.trim()

    // 有空格分隔（或没有剩余）说明是明确的命令写法。
    // 无空格粘连时，剩余部分必须含字母或数字（如 后纪a2）才认——
    // 否则 `遗物是什么` 这类以命令名开头的正常聊天会被误判成命令。
    const separated = rest === '' || remainder !== rest
    if (!separated && !/[a-z0-9]/.test(rest)) continue

    if (best && candidate.normalized.length <= best.candidate.normalized.length) continue
    best = { candidate, rest }
  }

  return best
}

export function match(
  input: string,
  candidates: Candidate[],
  options: MatchOptions = {},
): MatchResult {
  const maxInputLength = options.maxInputLength ?? DEFAULT_MAX_INPUT_LENGTH

  if (!input || input.length > maxInputLength) return { type: 'none' }

  const prefix = splitByPrefix(input, candidates)
  if (prefix) {
    return { type: 'exact', canonical: prefix.candidate.canonical, rest: prefix.rest }
  }

  return { type: 'none' }
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
npx vitest run tests/matcher.test.ts
```

预期：7 个测试全部 PASS。

- [ ] **Step 5: 提交**

```bash
git add packages/wf-bot/plugins/fuzzy-command/src/matcher.ts packages/wf-bot/plugins/fuzzy-command/tests/matcher.test.ts
git commit -m "feat(bot): exact command match with argument splitting"
```

---

### Task 5: 拼音模糊匹配

同音错字（`缝`/`逢` 拼音同为 `feng`）是最常见的打错方式，拼音层是模糊匹配的主力。

**Files:**
- Modify: `packages/wf-bot/plugins/fuzzy-command/src/matcher.ts`
- Test: `packages/wf-bot/plugins/fuzzy-command/tests/matcher.test.ts`

**Interfaces:**
- Consumes: 同 Task 4
- Produces: `match()` 新增返回 `{ type: 'fuzzy', canonical, rest }` 的能力

- [ ] **Step 1: 追加失败的测试**

在 `tests/matcher.test.ts` 顶部的 import 中补上 `normalize`：

```typescript
import { normalize } from '../src/normalize'
```

然后在文件末尾追加：

```typescript
describe('match — 拼音模糊', () => {
  it('同音错字：钢铁裂逢 → 钢铁裂缝', () => {
    expect(match('钢铁裂逢', CANDIDATES)).toEqual({
      type: 'fuzzy', canonical: '钢铁裂缝', rest: '',
    })
  })

  it('繁体输入经归一化后同样命中', () => {
    // match 本身不做归一化，那是中间件的职责，所以测试里显式调用
    expect(match(normalize('遺物 後紀a2'), CANDIDATES)).toEqual({
      type: 'exact', canonical: '遗物', rest: '后纪a2',
    })
  })

  it('过短的候选不参与模糊，避免误伤聊天', () => {
    const short: Candidate[] = [{ canonical: '打', normalized: '打', command: 'x' }]
    expect(match('大', short)).toEqual({ type: 'none' })
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npx vitest run tests/matcher.test.ts
```

预期：`同音错字：钢铁裂逢 → 钢铁裂缝` FAIL，实际返回 `{ type: 'none' }`。

- [ ] **Step 3: 实现拼音层**

修改 `src/matcher.ts`，在文件顶部加入 import：

```typescript
import { pinyin } from 'pinyin-pro'
```

在 `splitByPrefix` 之后加入：

```typescript
const pinyinCache = new Map<string, string>()

/** 取无声调全拼并拼接，如 钢铁裂缝 → gangtieliefeng */
function toPinyin(text: string): string {
  let cached = pinyinCache.get(text)
  if (cached === undefined) {
    cached = pinyin(text, { toneType: 'none', type: 'array' }).join('')
    pinyinCache.set(text, cached)
  }
  return cached
}
```

把 `match` 的结尾（`return { type: 'none' }`）替换为：

```typescript
  const minFuzzyLength = options.minFuzzyLength ?? DEFAULT_MIN_FUZZY_LENGTH
  const inputPinyin = toPinyin(input)

  const hits = candidates.filter((candidate) =>
    candidate.normalized.length >= minFuzzyLength
    && toPinyin(candidate.normalized) === inputPinyin)

  const commands = new Set(hits.map((hit) => hit.command))
  if (commands.size === 1) {
    return { type: 'fuzzy', canonical: hits[0].canonical, rest: '' }
  }

  return { type: 'none' }
```

- [ ] **Step 4: 运行测试确认通过**

```bash
npx vitest run tests/matcher.test.ts
```

预期：全部 PASS（Task 4 的 6 个 + 本任务的 3 个）。

- [ ] **Step 5: 提交**

```bash
git add packages/wf-bot/plugins/fuzzy-command/src/matcher.ts packages/wf-bot/plugins/fuzzy-command/tests/matcher.test.ts
git commit -m "feat(bot): pinyin-based fuzzy command matching"
```

---

### Task 6: 编辑距离兜底与歧义候选

拼音层解决同音错字，编辑距离解决漏字（`钢铁裂`）与形近错字。

**Files:**
- Modify: `packages/wf-bot/plugins/fuzzy-command/src/matcher.ts`
- Test: `packages/wf-bot/plugins/fuzzy-command/tests/matcher.test.ts`

**Interfaces:**
- Consumes: 同 Task 4
- Produces: `match()` 新增返回 `{ type: 'ambiguous', canonical: string[] }` 的能力

- [ ] **Step 1: 追加失败的测试**

在 `tests/matcher.test.ts` 末尾追加：

```typescript
describe('match — 编辑距离与歧义', () => {
  it('漏字：钢铁裂 → 钢铁裂缝', () => {
    expect(match('钢铁裂', CANDIDATES)).toEqual({
      type: 'fuzzy', canonical: '钢铁裂缝', rest: '',
    })
  })

  it('多个候选同分时返回歧义列表让用户选', () => {
    const twins: Candidate[] = [
      { canonical: '裂缝甲', normalized: '裂缝甲', command: 'a' },
      { canonical: '裂缝乙', normalized: '裂缝乙', command: 'b' },
    ]
    const result = match('裂缝丙', twins)
    expect(result.type).toBe('ambiguous')
    expect((result as any).canonical.sort()).toEqual(['裂缝乙', '裂缝甲'])
  })

  it('同一命令的多个别名同分不算歧义', () => {
    // 用四字别名：两字候选的容错阈值是 0，构造不出「同分」场景
    const aliases: Candidate[] = [
      { canonical: '钢铁裂缝', normalized: '钢铁裂缝', command: 'fissure-sp' },
      { canonical: '钢铁裂隙', normalized: '钢铁裂隙', command: 'fissure-sp' },
    ]
    expect(match('钢铁裂缶', aliases).type).toBe('fuzzy')
  })

  it('差太远仍返回 none', () => {
    expect(match('晚饭', CANDIDATES)).toEqual({ type: 'none' })
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npx vitest run tests/matcher.test.ts
```

预期：`漏字` 与 `歧义` 两个测试 FAIL。

- [ ] **Step 3: 实现编辑距离与歧义判定**

在 `src/matcher.ts` 的 `toPinyin` 之后加入：

```typescript
/** 标准 Levenshtein 编辑距离，滚动数组实现 */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)

  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      )
    }
    prev = cur
  }

  return prev[b.length]
}

/**
 * 候选越长，容错越宽。
 * 两字及以下不容错 —— 短词容错会把正常聊天误判成命令。
 */
function maxDistanceFor(length: number): number {
  if (length <= 2) return 0
  if (length <= 5) return 1
  return 2
}
```

把 Task 5 加入的那段（从 `const hits = candidates.filter(...)` 起，到函数结尾的 `return { type: 'none' }` 为止）整段替换为：

```typescript
  const scored = candidates
    .filter((candidate) => candidate.normalized.length >= minFuzzyLength)
    .map((candidate) => ({
      candidate,
      distance: Math.min(
        levenshtein(input, candidate.normalized),
        levenshtein(inputPinyin, toPinyin(candidate.normalized)),
      ),
    }))
    .filter((entry) => entry.distance <= maxDistanceFor(entry.candidate.normalized.length))
    .sort((a, b) => a.distance - b.distance)

  if (!scored.length) return { type: 'none' }

  const best = scored[0].distance
  const winners = scored.filter((entry) => entry.distance === best)
  const commands = new Set(winners.map((entry) => entry.candidate.command))

  if (commands.size === 1) {
    return { type: 'fuzzy', canonical: winners[0].candidate.canonical, rest: '' }
  }

  return { type: 'ambiguous', canonical: winners.map((entry) => entry.candidate.canonical) }
```

拼音完全相等的情形已被 `levenshtein(inputPinyin, ...) === 0` 覆盖，因此 Task 5 的 `hits` 逻辑被本段取代，不再保留。`toPinyin` 与 `inputPinyin` 仍在使用，不要删。

- [ ] **Step 4: 运行测试确认通过**

```bash
npx vitest run tests/matcher.test.ts
```

预期：13 个测试全部 PASS。若 `晚饭` 被误判命中，说明阈值过宽，调低 `maxDistanceFor` 的返回值。

- [ ] **Step 5: 提交**

```bash
git add packages/wf-bot/plugins/fuzzy-command/src/matcher.ts packages/wf-bot/plugins/fuzzy-command/tests/matcher.test.ts
git commit -m "feat(bot): edit-distance fallback and ambiguity resolution"
```

---

### Task 7: 接入中间件并端到端验证

**Files:**
- Modify: `packages/wf-bot/plugins/fuzzy-command/src/index.ts`

**Interfaces:**
- Consumes: `normalize()`、`collectCandidates()`、`match()`
- Produces: 生效的 Koishi 前置中间件

- [ ] **Step 1: 实现中间件**

把 `src/index.ts` 的 `apply` 函数整体替换为：

```typescript
export function apply(ctx: Context, config: Config) {
  const logger = ctx.logger('fuzzy-command')

  // 命令表在启动期注册完毕，缓存避免每条消息重复遍历；
  // 数量变化时重建，兼容插件热重载。
  let cache: Candidate[] = []
  let cachedSize = -1

  function candidates() {
    const size = ctx.$commander._commandList.length
    if (size !== cachedSize) {
      cache = collectCandidates(ctx)
      cachedSize = size
    }
    return cache
  }

  // 第二个参数 true 表示前置中间件，必须早于 Koishi 的命令解析
  ctx.middleware(async (session, next) => {
    const raw = session.content?.trim()
    if (!raw) return next()

    const result = match(normalize(raw), candidates(), config)

    switch (result.type) {
      case 'fuzzy':
        session.content = result.rest
          ? `${result.canonical} ${result.rest}`
          : result.canonical
        logger.debug('改写 %s → %s', raw, session.content)
        return next()

      case 'ambiguous':
        return session.send(
          `没认出「${raw}」，你是指：`
          + result.canonical.map((name, i) => `${i + 1}. ${name}`).join('   '),
        )

      // exact 交给 Koishi 原生解析；none 静默放行，绝不打扰正常聊天
      default:
        return next()
    }
  }, true)

  logger.info('已加载，maxInputLength=%d', config.maxInputLength)
}
```

同时把文件顶部的 import 补全：

```typescript
import { Context, Schema } from 'koishi'
import { type Candidate, collectCandidates } from './candidates'
import { match } from './matcher'
import { normalize } from './normalize'
```

- [ ] **Step 2: 构建**

```bash
cd packages/wf-bot
npm run build -w plugins/fuzzy-command
```

预期：无 TS 报错。

- [ ] **Step 3: 启动并在沙盒验证**

```bash
cd packages/wf-bot
npx koishi start
```

打开 `http://127.0.0.1:5140/sandbox`，添加用户后依次发送：

| 输入 | 预期 |
|---|---|
| `钢铁裂缝` | 出图（精确命中，行为不变） |
| `钢铁裂逢` | **出图**（本插件的核心目标） |
| `钢铁裂` | 出图 |
| `遗物后纪a2` | 出图（粘连参数被切开） |
| `晚上吃什么` | **无任何响应**（静默放行） |
| `今天钢铁裂缝刷了半天都没出` | **无任何响应**（超长放弃） |

最后两条是安全底线，必须确认无响应——bot 插嘴正常聊天比认不出命令更糟。

- [ ] **Step 4: 跑一遍全部单测**

```bash
cd packages/wf-bot/plugins/fuzzy-command
npx vitest run
```

预期：三个测试文件全部 PASS。

- [ ] **Step 5: 提交**

```bash
git add packages/wf-bot/plugins/fuzzy-command/src/index.ts
git commit -m "feat(bot): wire fuzzy matching into koishi middleware"
```

---

## 后续计划（不在本计划内）

- **服务器基线部署**：装 Node 22 / Chromium / 中文字体，接 NapCat，`ecosystem.config.js` 加 `blog-bot`，扩展 `deploy.sh`。阻塞于 QQ 小号准备。
- **fork 插件换皮 + 补赏金/1999 日历 + environment 改出图 + 移除周紫卡命令**。
- **物品图片缓存层**。
- **群务子系统**：单独出 spec 与计划。
