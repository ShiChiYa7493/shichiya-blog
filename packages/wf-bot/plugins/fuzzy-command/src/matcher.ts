import { pinyin } from 'pinyin-pro'
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
 *
 * `separated` 表示原文本身就是可解析的命令写法（有空格分隔或无参数）。
 * 粘连写法必须改写后才能交给 Koishi 解析，否则它认不出命令。
 */
function splitByPrefix(input: string, candidates: Candidate[]) {
  let best: { candidate: Candidate, rest: string, separated: boolean } | null = null

  for (const candidate of candidates) {
    if (!input.startsWith(candidate.normalized)) continue

    const remainder = input.slice(candidate.normalized.length)
    const rest = remainder.trim()
    const separated = rest === '' || remainder !== rest

    // 无空格粘连时，剩余部分必须含字母或数字（如 后纪a2）才认——
    // 否则 `遗物是什么` 这类以命令名开头的正常聊天会被误判成命令。
    if (!separated && !/[a-z0-9]/.test(rest)) continue

    if (best && candidate.normalized.length <= best.candidate.normalized.length) continue
    best = { candidate, rest, separated }
  }

  return best
}

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

/**
 * 命令常以单字动作开头（如 蹲/查/删）。用户只发其余名词时通常是在聊天，
 * 不是漏掉命令的第一个字；否则会对多个动作命令产生无意义的同分提示。
 */
function isLeadingCharacterOnlyDifference(input: string, candidate: string): boolean {
  return candidate.length === input.length + 1 && candidate.slice(1) === input
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
    // 原文可解析就放行；粘连写法标记为 fuzzy，由中间件改写后再交给 Koishi
    return {
      type: prefix.separated ? 'exact' : 'fuzzy',
      canonical: prefix.candidate.canonical,
      rest: prefix.rest,
    }
  }

  const minFuzzyLength = options.minFuzzyLength ?? DEFAULT_MIN_FUZZY_LENGTH
  const inputPinyin = toPinyin(input)

  // 字符距离与拼音距离取小者：前者兜漏字与形近，后者兜同音错字
  const scored = candidates
    .filter((candidate) => candidate.normalized.length >= minFuzzyLength)
    .filter((candidate) => !isLeadingCharacterOnlyDifference(input, candidate.normalized))
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

  // 同一命令的多个别名同分不算歧义，随便挑一个都对
  if (commands.size === 1) {
    return { type: 'fuzzy', canonical: winners[0].candidate.canonical, rest: '' }
  }

  return { type: 'ambiguous', canonical: winners.map((entry) => entry.candidate.canonical) }
}
