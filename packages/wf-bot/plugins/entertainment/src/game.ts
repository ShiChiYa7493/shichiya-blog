import type { Adventure, AdventureEffect } from './adventures'
import { hashSeed } from './fortune'

export const MAX_STREAK = 30
export const MAX_TICKETS = 3
export const MAX_DAILY_BATTLES = 5
export const MIN_STAKE = 5
export const MAX_STAKE = 20

export interface ProfileState {
  guildId: string
  userId: string
  credits: number
  experience: number
  level: number
  streak: number
  lastCheckin: string
  dailyDate: string
  dailyRandom: number
  dailyAdventureId: string
  dailyAdventureUsed: boolean
  tickets: number
  battleDate: string
  battleCount: number
  mmr: number
  wins: number
  losses: number
  winStreak: number
}

export interface CheckinResult {
  already: boolean
  base: number
  random: number
  streakBonus: number
  total: number
  levelUp: boolean
}

export interface BattleContext {
  own: ProfileState
  opponent: ProfileState
  ownAdventure?: Adventure
  opponentAdventure?: Adventure
}

export interface BattlePowerResult {
  own: number
  opponent: number
  ownBase: number
  opponentBase: number
  ownAdventureBonus: number
  opponentAdventureBonus: number
  ownScans: boolean
  opponentScans: boolean
}

export interface BattleResolution {
  winner: 'own' | 'opponent'
  roll: number
  ownChance: number
}

export function defaultProfile(guildId: string, userId: string): ProfileState {
  return {
    guildId,
    userId,
    credits: 0,
    experience: 0,
    level: 1,
    streak: 0,
    lastCheckin: '',
    dailyDate: '',
    dailyRandom: 0,
    dailyAdventureId: '',
    dailyAdventureUsed: false,
    tickets: 0,
    battleDate: '',
    battleCount: 0,
    mmr: 1000,
    wins: 0,
    losses: 0,
    winStreak: 0,
  }
}

export function xpToNextLevel(level: number): number {
  return 50 + level * 20
}

export function levelFromExperience(experience: number): number {
  let level = 1
  let remaining = Math.max(0, experience)
  while (remaining >= xpToNextLevel(level)) {
    remaining -= xpToNextLevel(level)
    level += 1
  }
  return level
}

export function addExperience(profile: ProfileState, amount: number): boolean {
  const previous = profile.level
  profile.experience = Math.max(0, profile.experience + Math.max(0, amount))
  profile.level = levelFromExperience(profile.experience)
  return profile.level > previous
}

function previousDate(date: string): string {
  const parsed = new Date(`${date}T00:00:00Z`)
  parsed.setUTCDate(parsed.getUTCDate() - 1)
  return parsed.toISOString().slice(0, 10)
}

export function applyCheckin(
  profile: ProfileState,
  date: string,
  randomReward: number,
  adventureId: string,
  randomExperience = 10,
): CheckinResult {
  if (profile.lastCheckin === date) {
    return { already: true, base: 0, random: 0, streakBonus: 0, total: 0, levelUp: false }
  }

  profile.streak = profile.lastCheckin === previousDate(date)
    ? Math.min(MAX_STREAK, profile.streak + 1)
    : 1
  profile.lastCheckin = date
  profile.dailyDate = date
  profile.dailyRandom = Math.max(0, Math.min(10, Math.floor(randomReward)))
  profile.dailyAdventureId = adventureId
  profile.dailyAdventureUsed = false
  profile.tickets = Math.min(MAX_TICKETS, profile.tickets + 1)

  const base = 10
  const streakBonus = Math.min(MAX_STREAK, profile.streak)
  const total = base + profile.dailyRandom + streakBonus
  profile.credits += total
  const levelUp = addExperience(profile, randomExperience)
  return { already: false, base, random: profile.dailyRandom, streakBonus, total, levelUp }
}

export function resetDailyBattleCount(profile: ProfileState, date: string): void {
  if (profile.battleDate !== date) {
    profile.battleDate = date
    profile.battleCount = 0
  }
}

export function baseCombatPower(profile: ProfileState): number {
  return 100
    + profile.level * 6
    + Math.min(profile.streak, MAX_STREAK) * 2
    + profile.dailyRandom * 2
    + Math.min(profile.winStreak, 5) * 3
}

export function effectValue(effects: readonly AdventureEffect[], type: AdventureEffect['type']): number {
  return effects
    .filter((effect) => effect.type === type)
    .reduce((sum, effect) => sum + ('value' in effect ? effect.value : 0), 0)
}

export function hasEffect(effects: readonly AdventureEffect[], type: AdventureEffect['type']): boolean {
  return effects.some((effect) => effect.type === type)
}

export function applyCheckinAdventure(profile: ProfileState, adventure: Adventure): {
  credits: number
  experience: number
  tickets: number
  levelUp: boolean
} {
  if (adventure.trigger !== 'checkin') {
    return { credits: 0, experience: 0, tickets: 0, levelUp: false }
  }
  const credits = effectValue(adventure.effects, 'credits')
  const experience = effectValue(adventure.effects, 'experience')
  const tickets = effectValue(adventure.effects, 'ticket')
  profile.credits += credits
  const beforeTickets = profile.tickets
  profile.tickets = Math.min(MAX_TICKETS, profile.tickets + tickets)
  const levelUp = addExperience(profile, experience)
  profile.dailyAdventureUsed = true
  return { credits, experience, tickets: profile.tickets - beforeTickets, levelUp }
}

export function calculateBattlePower(context: BattleContext): BattlePowerResult {
  const ownBase = baseCombatPower(context.own)
  const opponentBase = baseCombatPower(context.opponent)
  const ownEffects = context.ownAdventure?.effects ?? []
  const opponentEffects = context.opponentAdventure?.effects ?? []
  let ownBonus = effectValue(ownEffects, 'power') + effectValue(ownEffects, 'initiative')
  let opponentBonus = effectValue(opponentEffects, 'power') + effectValue(opponentEffects, 'initiative')

  if (ownBase < opponentBase) ownBonus += effectValue(ownEffects, 'power-if-behind')
  if (opponentBase < ownBase) opponentBonus += effectValue(opponentEffects, 'power-if-behind')
  if (Math.abs(ownBase - opponentBase) <= 20) {
    ownBonus += effectValue(ownEffects, 'power-if-close')
    opponentBonus += effectValue(opponentEffects, 'power-if-close')
  }
  if (context.own.mmr < context.opponent.mmr) ownBonus += effectValue(ownEffects, 'power-if-higher-mmr')
  if (context.opponent.mmr < context.own.mmr) opponentBonus += effectValue(opponentEffects, 'power-if-higher-mmr')

  ownBonus -= effectValue(opponentEffects, 'opponent-power')
  opponentBonus -= effectValue(ownEffects, 'opponent-power')

  const ownApplied = Math.min(20, Math.max(-20, ownBonus))
  const opponentApplied = Math.min(20, Math.max(-20, opponentBonus))
  return {
    own: Math.max(1, ownBase + ownApplied),
    opponent: Math.max(1, opponentBase + opponentApplied),
    ownBase,
    opponentBase,
    ownAdventureBonus: ownApplied,
    opponentAdventureBonus: opponentApplied,
    ownScans: hasEffect(ownEffects, 'scan'),
    opponentScans: hasEffect(opponentEffects, 'scan'),
  }
}

export function winChance(ownPower: number, opponentPower: number): number {
  return Math.max(0.15, Math.min(0.85, 0.5 + ((ownPower - opponentPower) / 200) * 0.35))
}

export function resolveBattle(seed: string, ownPower: number, opponentPower: number): BattleResolution {
  const roll = hashSeed(`battle:${seed}`) / 0x100000000
  const ownChance = winChance(ownPower, opponentPower)
  return { winner: roll < ownChance ? 'own' : 'opponent', roll, ownChance }
}

export function updateMmr(own: ProfileState, opponent: ProfileState, winner: 'own' | 'opponent'): void {
  const expected = 1 / (1 + 10 ** ((opponent.mmr - own.mmr) / 400))
  const result = winner === 'own' ? 1 : 0
  const delta = Math.round(24 * (result - expected))
  own.mmr = Math.max(100, own.mmr + delta)
  opponent.mmr = Math.max(100, opponent.mmr - delta)
}

export function formatPowerBreakdown(result: BattlePowerResult, ownName: string, opponentName: string): string {
  return `${ownName}：${result.own}（基础 ${result.ownBase}，奇遇 ${result.ownAdventureBonus >= 0 ? '+' : ''}${result.ownAdventureBonus}）\n`
    + `${opponentName}：${result.opponent}（基础 ${result.opponentBase}，奇遇 ${result.opponentAdventureBonus >= 0 ? '+' : ''}${result.opponentAdventureBonus}）`
}
