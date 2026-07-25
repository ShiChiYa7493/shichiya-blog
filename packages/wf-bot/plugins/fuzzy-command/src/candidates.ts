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
