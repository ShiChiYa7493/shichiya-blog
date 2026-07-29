import { describe, expect, it } from 'vitest'
import { ADVENTURES, getAdventure, pickDailyAdventure, renderAdventure } from '../src/adventures'

describe('adventure pool', () => {
  it('contains a large unique and implementable pool', () => {
    expect(ADVENTURES.length).toBeGreaterThanOrEqual(40)
    expect(new Set(ADVENTURES.map(({ id }) => id)).size).toBe(ADVENTURES.length)
    expect(ADVENTURES.every(({ effects, weight }) => effects.length > 0 && weight > 0)).toBe(true)
  })

  it('draws the same adventure for a user on the same day', () => {
    const first = pickDailyAdventure('user-1', '2026-07-29')
    expect(pickDailyAdventure('user-1', '2026-07-29')).toBe(first)
    expect(getAdventure(first.id)).toBe(first)
  })

  it('produces variety across users and dates', () => {
    const results = new Set<string>()
    for (let user = 0; user < 20; user++) {
      for (let day = 1; day <= 5; day++) {
        results.add(pickDailyAdventure(`user-${user}`, `2026-08-0${day}`).id)
      }
    }
    expect(results.size).toBeGreaterThan(20)
  })

  it('describes deferred shop adventures accurately', () => {
    expect(renderAdventure(getAdventure('lucky-coordinate')!)).toContain('首次购买时生效')
  })
})
