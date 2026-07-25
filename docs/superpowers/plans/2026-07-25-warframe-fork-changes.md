# Warframe 插件 fork 改动 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `koishi-plugin-warframe` 的 fork 上完成三项改动：移除国内不可用的周紫卡命令、把 `environment` 从纯文本改为出图、新增 1999 日历命令。

**Architecture:** 严格遵循上游的单向分层——`commands → warframe/index.ts(门面) → services → data → infrastructure`。服务层返回 `WarframeResult<T>` 结构化结果且不得依赖 Koishi/Satori/Puppeteer；中文文案由 `src/i18n.ts`（错误）与组件（正文）负责；组件只接收领域数据并产出 `Element`。

**Tech Stack:** TypeScript · Koishi v4 · @satorijs/element JSX · Puppeteer 渲染 · vitest + chai

## Global Constraints

工作目录一律为 `packages/wf-bot/external/warframe`，当前分支 `fix/workspace-test-resolution`。

- Node 22（`nvm use 22`）。
- **命令**：`npx vitest run`（测试）、`npm run build`（yakumo 构建）。注意 AGENTS.md 写的 `yarn mocha` 已过时，实际测试栈是 vitest。
- **分层铁律**：`src/warframe/` 内不得 import Koishi、@satorijs/element、puppeteer，也不得使用 `console.*`。
- **HTTP** 一律经 `src/warframe/utils/http.ts`，不得直接 `fetch`/`ofetch`。
- **服务层错误**：返回 `WarframeResult<T>`；新增错误码必须同时加进 `src/warframe/types/warframe-result.ts` 的 `warframeErrorCodes` 数组与 `src/i18n.ts` 的 `messages`。
- **测试**：文件放 `tests/`，命名 `*.spec.ts`，用 chai 的 `expect()`；`before`/`after` 必须写在 `describe()` 内部；优先用 fixture，不打真实网络。
- 每个任务结束后跑**全量** `npx vitest run`，基线是 **474 passed**，不得下降。
- 改动尽量小，不做顺手重构——fork 与上游的差异面越小，日后同步越省事。

---

### Task 1: 移除周紫卡命令

其数据源为 `docs.google.com` 上的表格，部署服务器（腾讯云，国内）实测连接超时，该命令必然失败。

**Files:**
- Modify: `src/commands/index.ts`

**Interfaces:**
- Consumes: 无
- Produces: 无（仅移除命令注册）

- [ ] **Step 1: 确认基线**

```bash
cd packages/wf-bot/external/warframe
nvm use 22
npx vitest run
```

预期：`474 passed`。若不是，先停下排查，不要在红的基线上改动。

- [ ] **Step 2: 移除命令注册**

在 `src/commands/index.ts` 中删除这一段：

```typescript
  ctx
    .command('riven-weekly [minPrice:number]', '每周高价值紫卡参考 (未洗中位价)')
    .alias('weeklyriven')
    .alias('周紫卡')
    .alias('周卡')
    .action(wf.weeklyRivenCommand)
```

**只删除注册，不要删除 `wf.weeklyRivenCommand` 的实现与其测试。** 理由：实现留在原处，与上游的差异仅一处删除，日后同步冲突最小；若将来自建 CSV 镜像，恢复只需重新注册。

- [ ] **Step 3: 验证命令消失且其余不受影响**

```bash
npx vitest run
```

预期：仍为 `474 passed`（该命令注册没有对应测试）。

```bash
npm run build
```

预期：构建成功。

- [ ] **Step 4: 手工验证**

在仓库根重启 Koishi：

```bash
cd packages/wf-bot && npx koishi start
```

沙盒（http://127.0.0.1:5140/sandbox）发送 `周紫卡`，预期**无响应**（命令已不存在）；发送 `裂缝`，预期正常出图（回归检查）。

- [ ] **Step 5: 提交**

```bash
cd packages/wf-bot/external/warframe
git add src/commands/index.ts
git commit -m "feat: drop riven-weekly command

Its data source is a Google Sheets CSV, which is unreachable from the
deployment host (mainland China). The command would always fail there.

The service implementation and its tests are intentionally kept so the
diff against upstream stays minimal and re-registering is trivial if a
self-hosted CSV mirror is added later."
```

---

### Task 2: environment 改为出图

`environmentCommand` 目前是唯一返回纯文本的命令。当前实现把格式化写在服务层并直接返回 `Promise<string>`，违反项目自身的分层约定；同时它使用上游预渲染的 `timeLeft` 字符串，缓存后会产生时间偏差。本任务一并修正。

**Files:**
- Modify: `src/warframe/services/wf-service.ts`
- Create: `src/warframe/types/wf/environment.ts`
- Modify: `src/warframe/types/wf/index.ts`（若存在聚合导出）
- Modify: `src/components/wf.tsx`
- Modify: `src/commands/wf.ts`
- Test: `tests/services/environment.service.spec.ts`

**Interfaces:**
- Consumes: `globalWorldState.get()`（现有）
- Produces:
  - `interface EnvironmentCycle { location: string, state: string, expiry: number }`
  - `interface EnvironmentBoard { cycles: EnvironmentCycle[] }`
  - `getEnvironment(): Promise<WarframeResult<EnvironmentBoard>>`（**签名变更**，由 `Promise<string>` 改为结构化结果）
  - `EnvironmentComponent(board: EnvironmentBoard): Element`

- [ ] **Step 1: 写失败的测试**

创建 `tests/services/environment.service.spec.ts`：

```typescript
import { expect } from 'chai'

import { buildEnvironmentBoard } from '../../src/warframe/services/wf-service'

describe('environment board', () => {
  const worldState = {
    cetusCycle: { isDay: true, expiry: 1_700_000_000_000 },
    vallisCycle: { isWarm: false, expiry: 1_700_000_100_000 },
    cambionCycle: { state: 'fass', expiry: 1_700_000_200_000 },
    duviriCycle: { state: 'fear', expiry: 1_700_000_300_000 },
    zarimanCycle: { state: 'corpus', expiry: 1_700_000_400_000 },
  } as any

  it('产出结构化数据而非格式化字符串', () => {
    const board = buildEnvironmentBoard(worldState)
    expect(board.cycles).to.have.length(5)
    expect(board.cycles[0]).to.deep.equal({
      location: '地球/夜灵平野',
      state: '白天',
      expiry: 1_700_000_000_000,
    })
  })

  it('保留 expiry 时间戳而不是预渲染的倒计时文本', () => {
    // 上游 worldstate 的 timeLeft 是预渲染字符串，缓存后会失准；
    // 倒计时必须由渲染时刻依据 expiry 现算。
    const board = buildEnvironmentBoard(worldState)
    for (const cycle of board.cycles) {
      expect(cycle).to.not.have.property('timeLeft')
      expect(cycle.expiry).to.be.a('number')
    }
  })

  it('翻译双衍王境的情绪状态', () => {
    const board = buildEnvironmentBoard(worldState)
    const duviri = board.cycles.find(c => c.location === '双衍王境')
    expect(duviri?.state).to.equal('恐惧')
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npx vitest run tests/services/environment.service.spec.ts
```

预期：FAIL，`buildEnvironmentBoard` 未导出。

- [ ] **Step 3: 定义领域类型**

创建 `src/warframe/types/wf/environment.ts`：

```typescript
export interface EnvironmentCycle {
  /** 地点中文名，如「地球/夜灵平野」 */
  location: string
  /** 当前状态中文名，如「白天」「恐惧」 */
  state: string
  /** 本轮结束的时间戳（毫秒）。不存预渲染倒计时——那会随缓存失准 */
  expiry: number
}

export interface EnvironmentBoard {
  cycles: EnvironmentCycle[]
}
```

若 `src/warframe/types/wf/index.ts` 存在聚合导出，追加一行 `export * from './environment'`；若不存在，确认 `src/warframe/types/index.ts` 能导出到门面。

- [ ] **Step 4: 重写服务**

在 `src/warframe/services/wf-service.ts` 中，把原 `getEnvironment` 整体替换为一个纯函数加一个编排函数：

```typescript
const duviriStateNames: Record<string, string> = {
  sorrow: '悲伤',
  fear: '恐惧',
  joy: '喜悦',
  anger: '愤怒',
  envy: '嫉妒',
}

/** 纯函数，便于脱离网络单测 */
export function buildEnvironmentBoard(worldState: any): EnvironmentBoard {
  const capitalize = (s: string): string =>
    s ? s.charAt(0).toUpperCase() + s.slice(1) : '未知'

  return {
    cycles: [
      {
        location: '地球/夜灵平野',
        state: worldState.cetusCycle.isDay ? '白天' : '黑夜',
        expiry: new Date(worldState.cetusCycle.expiry).getTime(),
      },
      {
        location: '奥布山谷',
        state: worldState.vallisCycle.isWarm ? '温暖' : '寒冷',
        expiry: new Date(worldState.vallisCycle.expiry).getTime(),
      },
      {
        location: '魔胎之境',
        state: capitalize(worldState.cambionCycle.state),
        expiry: new Date(worldState.cambionCycle.expiry).getTime(),
      },
      {
        location: '双衍王境',
        state: duviriStateNames[worldState.duviriCycle.state] ?? '未知',
        expiry: new Date(worldState.duviriCycle.expiry).getTime(),
      },
      {
        location: '扎里曼号',
        state: capitalize(worldState.zarimanCycle.state),
        expiry: new Date(worldState.zarimanCycle.expiry).getTime(),
      },
    ],
  }
}

export async function getEnvironment(): Promise<WarframeResult<EnvironmentBoard>> {
  const { raw: worldState } = await globalWorldState.get()
  if (!worldState) {
    return failure('common.fetchFailed', true)
  }
  return { ok: true, data: buildEnvironmentBoard(worldState) }
}
```

注意：`failure` 的调用形式请对照本文件中已有服务的写法保持一致（该辅助函数由 `src/warframe/types/warframe-result.ts` 导出）。`common.fetchFailed` 错误码已存在，无需新增。

- [ ] **Step 5: 运行测试确认通过**

```bash
npx vitest run tests/services/environment.service.spec.ts
```

预期：3 个测试全部 PASS。

- [ ] **Step 6: 新增渲染组件**

在 `src/components/wf.tsx` 末尾追加。样式沿用文件中既有组件的 CSS 变量与 600px 卡片宽度：

```tsx
export function EnvironmentComponent(board: EnvironmentBoard): Element {
  const now = Date.now()

  const remaining = (expiry: number): string => {
    const ms = expiry - now
    if (ms <= 0) {
      return '即将切换'
    }
    const totalMinutes = Math.floor(ms / 60000)
    const hours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60
    return hours > 0 ? `${hours}小时${minutes}分` : `${minutes}分`
  }

  return (
    <div style="width:600px;background-color:var(--wf-bg-card);border-radius:var(--wf-radius);padding:16px;box-shadow:var(--wf-shadow-card);border:1px solid var(--wf-border);font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;color:var(--wf-text-body);">
      <h1 style="font-size:22px;font-weight:bold;color:var(--wf-text-primary);margin:0 0 16px 0;padding-bottom:12px;border-bottom:1px solid var(--wf-divider);text-align:center;">
        各区域当前状态
      </h1>
      <div style="display:flex;flex-direction:column;gap:10px;">
        {board.cycles.map(cycle => (
          <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border-radius:6px;background-color:var(--wf-bg-row);">
            <span style="font-weight:bold;color:var(--wf-text-primary);">{cycle.location}</span>
            <span style="color:var(--wf-text-secondary);">{cycle.state}</span>
            <span style="color:var(--wf-text-body);">{remaining(cycle.expiry)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
```

若 `--wf-bg-row` 在 `src/assets/render.css` 中不存在，改用该文件里实际存在的行背景变量（参考 `ArbitrationComponent` 的用法）。

- [ ] **Step 7: 改造命令**

在 `src/commands/wf.ts` 中：

把类型声明 `environmentCommand: () => Promise<string>` 保持不变（仍返回字符串，因为 `render()` 返回图片消息的字符串）。

把实现替换为：

```typescript
    environmentCommand: async () => {
      const result = await getEnvironment()
      if (!result.ok) {
        return t(result)
      }
      return render(EnvironmentComponent(result.data))
    },
```

并在文件顶部补上 `EnvironmentComponent` 的 import（与其他组件同一处导入）。

- [ ] **Step 8: 全量测试与构建**

```bash
npx vitest run
npm run build
```

预期：测试 `477 passed`（474 基线 + 本任务 3 个），构建成功。

- [ ] **Step 9: 手工验证出图**

重启 Koishi，沙盒发送 `平原`。预期：**返回图片**（此前是纯文本），内容包含 5 个地点与各自剩余时间。

- [ ] **Step 10: 提交**

```bash
git add src/warframe/types/wf/environment.ts src/warframe/services/wf-service.ts src/components/wf.tsx src/commands/wf.ts tests/services/environment.service.spec.ts
git commit -m "feat: render environment cycles as an image

environment was the only command returning plain text, and it formatted
strings inside the service layer, which contradicts the project's own
layering rules.

The service now returns a structured WarframeResult<EnvironmentBoard>
and a component renders it. The board keeps raw expiry timestamps rather
than the upstream pre-rendered timeLeft string, so the countdown is
computed at render time and cannot drift with the world-state cache."
```

---

### Task 3: 新增 1999 日历命令

1999 日历在现有代码中零实现，需从头新增。

**数据来源（2026-07-25 实测确认）：**

不要去解析 DE 原始 JSON 的 `KnownCalendarSeasons`——`warframe-worldstate-parser` **已经解析好了**，且就挂在现成的缓存对象上：

```
globalWorldState.get() → { raw, ... }        // raw 是 WFCD 解析后的 WorldState（命名有误导性）
raw.calendar = {
  season: 'Fall', yearIteration: 20, activation, expiry,
  days: [ { day, events: [...] } ]           // 本季 19 天
}
```

事件已被解析成可直接使用的结构，**无需任何路径查表**：

```js
{ type: 'To Do',      challenge: { title: 'Even the odds',  description: 'Kill 250 Enemies' } }
{ type: 'Override',   upgrade:   { title: 'Espresso Shots', description: 'Increase energy restoration by 2/s.' } }
{ type: 'Big Prize!', reward:    'Arcane Enhancements: Double Pack' }
```

⚠️ **但全部是英文**。已实测 `locale` 传 `zh` / `zh-hans` / `tc` 均无效，解析器不含日历的中文数据。因此中文需自建映射，键为英文标题。

**Files:**
- Create: `src/warframe/types/wf/calendar.ts`
- Create: `src/warframe/services/calendar-service.ts`
- Create: `src/warframe/assets/calendar-zh.json`
- Modify: `src/warframe/services/index.ts`
- Modify: `src/components/wf.tsx`
- Modify: `src/commands/wf.ts`、`src/commands/index.ts`
- Test: `tests/services/calendar.service.spec.ts`

**Interfaces:**
- Consumes: `globalWorldState.get()`（其 `raw.calendar` 即已解析的日历）
- Produces:
  - `interface CalendarEvent { kind: 'challenge' | 'upgrade' | 'reward', title: string, description: string }`
  - `interface CalendarDay { day: number, events: CalendarEvent[] }`
  - `interface CalendarBoard { season: string, days: CalendarDay[] }`
  - `getCalendar(): Promise<WarframeResult<CalendarBoard>>`
  - `CalendarComponent(board: CalendarBoard): Element`

- [ ] **Step 1: 写失败的测试**

创建 `tests/services/calendar.service.spec.ts`。fixture 直接照抄解析器的真实输出形态：

```typescript
import { expect } from 'chai'

import { buildCalendarBoard } from '../../src/warframe/services/calendar-service'

describe('1999 calendar board', () => {
  const calendar = {
    season: 'Fall',
    yearIteration: 20,
    days: [
      {
        day: 283,
        events: [{
          type: 'To Do',
          challenge: { title: 'Even the odds', description: 'Kill 250 Enemies' },
        }],
      },
      {
        day: 284,
        events: [
          { type: 'Override', upgrade: { title: 'Espresso Shots', description: 'Increase energy restoration by 2/s.' } },
          { type: 'Big Prize!', reward: 'Arcane Enhancements: Double Pack' },
        ],
      },
    ],
  } as any

  it('保留季节与逐日结构', () => {
    const board = buildCalendarBoard(calendar)
    expect(board.season).to.equal('Fall')
    expect(board.days).to.have.length(2)
  })

  it('三类事件都被归一化为同一形状', () => {
    const board = buildCalendarBoard(calendar)
    expect(board.days[0].events[0].kind).to.equal('challenge')
    expect(board.days[1].events[0].kind).to.equal('upgrade')
    expect(board.days[1].events[1].kind).to.equal('reward')
  })

  it('已收录的英文标题被译为中文', () => {
    const board = buildCalendarBoard(calendar)
    expect(board.days[0].events[0].title).to.equal('势均力敌')
  })

  it('未收录的标题保留英文原文而不是抛错或留空', () => {
    const unknown = {
      season: 'Fall',
      days: [{ day: 1, events: [{ type: 'Big Prize!', reward: 'Totally New Thing' }] }],
    } as any
    expect(buildCalendarBoard(unknown).days[0].events[0].title).to.equal('Totally New Thing')
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npx vitest run tests/services/calendar.service.spec.ts
```

预期：FAIL，模块不存在。

- [ ] **Step 3: 建立中文译名表**

新建 `src/warframe/assets/calendar-zh.json`，以**英文标题为键**。先收录本季已出现的条目，未收录者回落英文原文：

```json
{
  "Even the odds": "势均力敌",
  "Espresso Shots": "浓缩咖啡",
  "Arcane Enhancements: Double Pack": "赋能助力：双重组合",
  "Arcane Enhancements": "赋能助力"
}
```

> 译名非官方，凭语义拟定；与游戏内官中不符时直接改本文件即可，属纯数据修正。
> 每季日历轮换会带来新标题，未收录的自动回落英文，不会报错——
> 这是有意的降级设计，避免因缺译名而整条命令失败。

该文件的加载必须走项目统一的资源入口（参考 `zh.json` 现有的加载方式），
否则 `tests/meta/assetsBoundary.spec.ts` 会失败。

- [ ] **Step 4: 实现服务**

创建 `src/warframe/services/calendar-service.ts`。**注意分层**：本文件位于 `src/warframe/`，不得 import Koishi、组件或 puppeteer。

```typescript
import type { CalendarBoard, CalendarEvent } from '../types/wf/calendar'
import type { WarframeResult } from '../types/warframe-result'

import { calendarZh } from '../assets'
import { globalWorldState } from '../data/wf/globalWorldState'
import { failure } from '../types/warframe-result'

function translate(text: string): string {
  return calendarZh[text] ?? text
}

function toEvent(raw: any): CalendarEvent {
  if (raw.challenge) {
    return {
      kind: 'challenge',
      title: translate(raw.challenge.title ?? ''),
      description: translate(raw.challenge.description ?? ''),
    }
  }
  if (raw.upgrade) {
    return {
      kind: 'upgrade',
      title: translate(raw.upgrade.title ?? ''),
      description: translate(raw.upgrade.description ?? ''),
    }
  }
  return {
    kind: 'reward',
    title: translate(raw.reward ?? ''),
    description: '',
  }
}

/** 纯函数，便于脱离网络单测 */
export function buildCalendarBoard(calendar: any): CalendarBoard {
  return {
    season: calendar?.season ?? '',
    days: (calendar?.days ?? []).map((day: any) => ({
      day: day.day,
      events: (day.events ?? []).map(toEvent),
    })),
  }
}

export async function getCalendar(): Promise<WarframeResult<CalendarBoard>> {
  const { raw: worldState } = await globalWorldState.get()
  const calendar = (worldState as any)?.calendar
  if (!calendar) {
    return failure('common.fetchFailed', true)
  }
  return { ok: true, data: buildCalendarBoard(calendar) }
}
```

`calendarZh` 的导出请加在 `src/warframe/assets/` 的统一入口里，与 `zh.json` 现有的导出方式保持一致。`failure()` 的调用形式对照本目录中其他服务。

- [ ] **Step 5: 运行测试确认通过**

```bash
npx vitest run tests/services/calendar.service.spec.ts
```

预期：4 个测试全部 PASS。

- [ ] **Step 6: 新增渲染组件**

在 `src/components/wf.tsx` 末尾追加：

```tsx
export function CalendarComponent(board: CalendarBoard): Element {
  const kindLabel: Record<string, string> = {
    challenge: '挑战',
    upgrade: '增益',
    reward: '奖励',
  }

  const kindColor: Record<string, string> = {
    challenge: 'var(--wf-warning)',
    upgrade: 'var(--wf-success)',
    reward: 'var(--wf-rarity-rare)',
  }

  return (
    <div style="width:600px;background-color:var(--wf-bg-card);border-radius:var(--wf-radius);padding:16px;box-shadow:var(--wf-shadow-card);border:1px solid var(--wf-border);font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;color:var(--wf-text-body);">
      <h1 style="font-size:22px;font-weight:bold;color:var(--wf-text-primary);margin:0 0 16px 0;padding-bottom:12px;border-bottom:1px solid var(--wf-divider);text-align:center;">
        {`1999 日历 · ${board.season}`}
      </h1>
      <div style="display:flex;flex-direction:column;gap:12px;">
        {board.days.map(day => (
          <div>
            <div style="font-size:13px;font-weight:bold;color:var(--wf-text-secondary);margin-bottom:6px;padding-bottom:4px;border-bottom:1px solid var(--wf-border);">
              {`第 ${day.day} 天`}
            </div>
            <div style="display:flex;flex-direction:column;gap:4px;">
              {day.events.map(event => (
                <div style="display:flex;align-items:baseline;gap:8px;">
                  <span style={`flex-shrink:0;font-size:12px;font-weight:bold;color:${kindColor[event.kind]};`}>
                    {kindLabel[event.kind]}
                  </span>
                  <span style="font-weight:bold;color:var(--wf-text-primary);">{event.title}</span>
                  {event.description
                    ? <span style="font-size:12px;color:var(--wf-text-secondary);">{event.description}</span>
                    : ''}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

若 `--wf-warning` / `--wf-success` / `--wf-rarity-rare` 在 `src/assets/render.css` 中不存在，改用该文件里实际定义的变量（`ArbitrationComponent` 用过这三个，正常应当存在）。

- [ ] **Step 7: 注册命令**

在 `src/commands/wf.ts` 的返回对象中加入：

```typescript
    calendarCommand: async () => {
      const result = await getCalendar()
      if (!result.ok) {
        return t(result)
      }
      return render(CalendarComponent(result.data))
    },
```

并在同文件的类型声明中加上 `calendarCommand: () => Promise<string>`。

在 `src/commands/index.ts` 中注册：

```typescript
  ctx
    .command('calendar', '1999 日历')
    .alias('日历')
    .alias('1999')
    .alias('1999日历')
    .action(wf.calendarCommand)
```

- [ ] **Step 8: 全量测试与构建**

```bash
npx vitest run
npm run build
```

预期：`481 passed`（474 + Task 2 的 3 个 + 本任务的 4 个），构建成功。

- [ ] **Step 9: 手工验证**

重启 Koishi，沙盒依次发送 `日历`、`1999`。预期均返回图片，内容为本季日历，事件名为中文。

同时发送 `1999赏金`，确认它仍然命中原有的 `bounty-hex` 命令而**没有被新的 `1999` 别名抢走**——两者都以「1999」开头，注册顺序与 Koishi 的最长匹配行为需要实测确认。若发生冲突，把 `1999` 这个别名去掉，只保留 `日历` 与 `1999日历`。

- [ ] **Step 10: 提交**

```bash
git add src/warframe/types/wf/calendar.ts src/warframe/services/calendar-service.ts src/warframe/services/index.ts src/warframe/infrastructure/wf/wf-export-adapter.ts src/warframe/assets/zh.json src/components/wf.tsx src/commands/wf.ts src/commands/index.ts tests/services/calendar.service.spec.ts
git commit -m "feat: add 1999 calendar command

warframe-worldstate-parser already resolves the 1999 calendar into
worldState.calendar, so the service reads that directly instead of
parsing the raw KnownCalendarSeasons payload.

The parser only emits English (locale zh/zh-hans/tc all fall back to it),
so titles are translated through a new calendar-zh.json keyed by the
English string. Unknown titles fall back to the English original rather
than failing — each season rotates in new entries, and a missing
translation must not take the whole command down."
```

---

## 后续（不在本计划内）

- **换皮**：阻塞于视觉稿。好消息是配色集中在 `src/assets/render.css` 的 CSS 自定义属性（`--wf-bg-card` / `--wf-text-primary` 等），改深色主题主要是重定义这批变量，比原估计便宜。
- **物品图片缓存层**：图源只能用 warframe.market（`cdn.warframestat.us` 在部署机 403）。
- **服务器基线部署**：阻塞于 QQ 小号。
- **群务子系统**：单独 spec。
