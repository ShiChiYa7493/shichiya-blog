import { describe, expect, it } from 'vitest'
import { dateKey, getDailyFortune, hashSeed } from '../src/fortune'

describe('daily fortune', () => {
  const noon = new Date('2026-07-29T04:00:00.000Z')

  it('is stable for the same user and local date', () => {
    const first = getDailyFortune('u-1', noon)
    expect(first).toEqual(getDailyFortune('u-1', new Date('2026-07-29T14:00:00.000Z')))
    expect(first.axes).toHaveLength(6)
    expect(first.axes.map((axis) => axis.label)).toEqual(['紫卡', '交易', '掉落', '核桃', '赏金', '生息'])
    expect(first.axes.every((axis) => axis.value >= 0 && axis.value <= 100)).toBe(true)
  })

  it('changes with user or date', () => {
    const first = getDailyFortune('u-1', noon)
    expect(hashSeed('u-1:2026-07-29')).toBeTypeOf('number')
    expect(getDailyFortune('u-3', noon)).not.toEqual(first)
    expect(getDailyFortune('u-1', new Date('2026-07-30T04:00:00.000Z'))).not.toEqual(first)
  })

  it('uses the configured timezone when deriving a date key', () => {
    const instant = new Date('2026-07-29T16:30:00.000Z')
    expect(dateKey(instant, 'Asia/Shanghai')).toBe('2026-07-30')
    expect(dateKey(instant, 'UTC')).toBe('2026-07-29')
  })
})
