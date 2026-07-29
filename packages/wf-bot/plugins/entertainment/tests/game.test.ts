import { describe, expect, it } from 'vitest'
import { getAdventure } from '../src/adventures'
import {
  addExperience,
  applyCheckin,
  applyCheckinAdventure,
  baseCombatPower,
  calculateBattlePower,
  defaultProfile,
  resolveBattle,
  updateMmr,
  winChance,
} from '../src/game'

describe('check-in game rules', () => {
  it('awards base, random and consecutive-day points', () => {
    const profile = defaultProfile('g1', 'u1')
    const first = applyCheckin(profile, '2026-07-29', 7, 'fire-calibration')
    expect(first).toMatchObject({ already: false, base: 10, random: 7, streakBonus: 1, total: 18 })
    expect(profile.credits).toBe(18)
    expect(profile.streak).toBe(1)

    const repeated = applyCheckin(profile, '2026-07-29', 10, 'void-charge')
    expect(repeated.already).toBe(true)
    expect(profile.credits).toBe(18)

    const second = applyCheckin(profile, '2026-07-30', 4, 'void-charge')
    expect(second.total).toBe(16)
    expect(profile.streak).toBe(2)
  })

  it('resets the streak after a missed day', () => {
    const profile = defaultProfile('g1', 'u1')
    applyCheckin(profile, '2026-07-29', 0, 'fire-calibration')
    applyCheckin(profile, '2026-07-31', 0, 'fire-calibration')
    expect(profile.streak).toBe(1)
  })

  it('applies immediate check-in adventures once', () => {
    const profile = defaultProfile('g1', 'u1')
    applyCheckin(profile, '2026-07-29', 0, 'supply-drop')
    const adventure = getAdventure('supply-drop')!
    const reward = applyCheckinAdventure(profile, adventure)
    expect(reward.credits).toBe(8)
    expect(profile.credits).toBe(19)
    expect(profile.dailyAdventureUsed).toBe(true)
  })

  it('keeps shop adventures available until the first purchase', () => {
    const profile = defaultProfile('g1', 'u1')
    applyCheckin(profile, '2026-07-29', 0, 'lucky-coordinate')
    const reward = applyCheckinAdventure(profile, getAdventure('lucky-coordinate')!)
    expect(reward).toEqual({ credits: 0, experience: 0, tickets: 0, levelUp: false })
    expect(profile.dailyAdventureUsed).toBe(false)
  })
})

describe('combat rules', () => {
  it('builds permanent and daily power without using total credits', () => {
    const profile = defaultProfile('g1', 'u1')
    profile.level = 3
    profile.streak = 5
    profile.dailyRandom = 8
    profile.winStreak = 2
    profile.credits = 99999
    expect(baseCombatPower(profile)).toBe(150)
  })

  it('applies both users adventures and caps their battle impact', () => {
    const own = defaultProfile('g1', 'u1')
    const opponent = defaultProfile('g1', 'u2')
    opponent.level = 5
    own.mmr = 900
    opponent.mmr = 1100
    const result = calculateBattlePower({
      own,
      opponent,
      ownAdventure: getAdventure('overload-protocol'),
      opponentAdventure: getAdventure('counter-algorithm'),
    })
    expect(result.ownAdventureBonus).toBe(8)
    expect(result.own).toBe(result.ownBase + 8)
    expect(result.opponent).toBe(result.opponentBase)
  })

  it('applies conditional adventures and consumable power only when eligible', () => {
    const own = defaultProfile('g1', 'u1')
    const opponent = defaultProfile('g1', 'u2')
    opponent.level = 3
    own.mmr = 1000
    opponent.mmr = 1050
    const result = calculateBattlePower({
      own,
      opponent,
      ownAdventure: getAdventure('steel-path'),
      opponentAdventure: getAdventure('revenge-mark'),
      opponentRevenge: true,
      ownItemPower: 6,
    })
    expect(result.ownAdventureBonus).toBe(8)
    expect(result.opponentAdventureBonus).toBe(8)
    expect(result.ownItemBonus).toBe(6)
    expect(result.own).toBe(result.ownBase + 14)
  })

  it('caps win probability between 15 and 85 percent', () => {
    expect(winChance(100, 100)).toBe(0.5)
    expect(winChance(1000, 1)).toBe(0.85)
    expect(winChance(1, 1000)).toBe(0.15)
  })

  it('resolves a battle deterministically and updates mmr symmetrically', () => {
    expect(resolveBattle('battle-1', 180, 160)).toEqual(resolveBattle('battle-1', 180, 160))
    const own = defaultProfile('g1', 'u1')
    const opponent = defaultProfile('g1', 'u2')
    updateMmr(own, opponent, 'own')
    expect(own.mmr).toBe(1012)
    expect(opponent.mmr).toBe(988)
  })

  it('levels up using accumulated experience', () => {
    const profile = defaultProfile('g1', 'u1')
    expect(addExperience(profile, 69)).toBe(false)
    expect(addExperience(profile, 1)).toBe(true)
    expect(profile.level).toBe(2)
  })
})
