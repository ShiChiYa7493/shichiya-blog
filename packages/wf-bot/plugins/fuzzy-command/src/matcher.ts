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
