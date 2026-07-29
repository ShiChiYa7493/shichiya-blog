import { describe, expect, it } from 'vitest'
import { pickRandom, WARFRAMES, WEAPONS } from '../src/items'

describe('recommendation pools', () => {
  it('contains non-empty, unique entries', () => {
    expect(WARFRAMES.length).toBeGreaterThan(0)
    expect(WEAPONS.length).toBeGreaterThan(0)
    expect(new Set(WARFRAMES).size).toBe(WARFRAMES.length)
    expect(new Set(WEAPONS).size).toBe(WEAPONS.length)
  })

  it('supports deterministic selection in tests', () => {
    expect(pickRandom(['a', 'b', 'c'], () => 0)).toBe('a')
    expect(pickRandom(['a', 'b', 'c'], () => 0.99)).toBe('c')
  })
})
