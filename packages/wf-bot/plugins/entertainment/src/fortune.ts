export interface Fortune {
  level: string
  score: number
  text: string
  advice: string
}

export const FORTUNES: readonly Fortune[] = [
  { level: '大吉', score: 95, text: '今天状态拉满，适合挑战一直想做的事。', advice: '大胆出发，记得给自己留一点庆祝时间。' },
  { level: '吉', score: 82, text: '努力会得到回应，和别人合作尤其顺利。', advice: '主动开口，今天的好机会往往藏在交流里。' },
  { level: '小吉', score: 72, text: '平稳的一天，小小的坚持会带来小小的惊喜。', advice: '按计划完成一件小事，就已经很棒了。' },
  { level: '中平', score: 60, text: '没有特别的波澜，保持节奏就是今天的答案。', advice: '别急着和别人比较，照顾好自己的状态。' },
  { level: '小凶', score: 45, text: '今天容易遇到一点小插曲，放慢脚步就能化解。', advice: '重要决定多检查一次，给自己留出余地。' },
]

/** FNV-1a：轻量、可复现，足够用于娱乐内容而非安全场景。 */
export function hashSeed(input: string): number {
  let hash = 2166136261
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export function dateKey(date: Date, timeZone = 'Asia/Shanghai'): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]))
  return `${values.year}-${values.month}-${values.day}`
}

export function getDailyFortune(
  userId: string,
  date: Date,
  timeZone = 'Asia/Shanghai',
): Fortune {
  const seed = hashSeed(`${userId}:${dateKey(date, timeZone)}`)
  return FORTUNES[seed % FORTUNES.length]
}

export function renderFortune(fortune: Fortune, date: string): string {
  return `今日运势（${date}）：${fortune.level} · ${fortune.score}分\n${fortune.text}\n建议：${fortune.advice}`
}
