import type { Context } from 'koishi'
import type { ProfileState } from './game'
import { defaultProfile } from './game'

export type BattleStatus = 'pending' | 'accepted' | 'rejected' | 'expired' | 'completed'

export interface BattleRecord {
  id: number
  guildId: string
  challengerId: string
  targetId: string
  status: BattleStatus
  stake: number
  createdAt: Date
  expiresAt: Date
  completedDate: string
  challengerPower: number
  targetPower: number
  challengerChance: number
  roll: number
  winnerId: string
  challengerAdventureId: string
  targetAdventureId: string
  mmrChange: number
}

declare module 'koishi' {
  interface Tables {
    entertainment_profile: ProfileState
    entertainment_battle: BattleRecord
  }
}

export function extendModels(ctx: Context): void {
  ctx.model.extend('entertainment_profile', {
    guildId: 'string(255)',
    userId: 'string(255)',
    credits: 'integer',
    experience: 'integer',
    level: 'integer',
    streak: 'integer',
    lastCheckin: 'string(10)',
    dailyDate: 'string(10)',
    dailyRandom: 'integer',
    dailyAdventureId: 'string(64)',
    dailyAdventureUsed: 'boolean',
    tickets: 'integer',
    battleDate: 'string(10)',
    battleCount: 'integer',
    mmr: 'integer',
    wins: 'integer',
    losses: 'integer',
    winStreak: 'integer',
  }, {
    primary: ['guildId', 'userId'],
  })

  ctx.model.extend('entertainment_battle', {
    id: 'unsigned',
    guildId: 'string(255)',
    challengerId: 'string(255)',
    targetId: 'string(255)',
    status: 'string(16)',
    stake: 'integer',
    createdAt: 'timestamp',
    expiresAt: 'timestamp',
    completedDate: 'string(10)',
    challengerPower: 'integer',
    targetPower: 'integer',
    challengerChance: 'decimal',
    roll: 'decimal',
    winnerId: 'string(255)',
    challengerAdventureId: 'string(64)',
    targetAdventureId: 'string(64)',
    mmrChange: 'integer',
  }, {
    autoInc: true,
  })
}

export class EntertainmentStore {
  constructor(private ctx: Context) {}

  async getProfile(guildId: string, userId: string): Promise<ProfileState> {
    const [profile] = await this.ctx.database.get('entertainment_profile', { guildId, userId })
    if (profile) return profile
    const created = defaultProfile(guildId, userId)
    await this.saveProfile(created)
    return created
  }

  async saveProfile(profile: ProfileState): Promise<void> {
    await this.ctx.database.upsert('entertainment_profile', [{ ...profile }], ['guildId', 'userId'])
  }

  async listProfiles(guildId: string): Promise<ProfileState[]> {
    return this.ctx.database.get('entertainment_profile', { guildId })
  }

  async createBattle(data: Omit<BattleRecord, 'id'>): Promise<BattleRecord> {
    return this.ctx.database.create('entertainment_battle', data)
  }

  async updateBattle(id: number, data: Partial<BattleRecord>): Promise<void> {
    await this.ctx.database.set('entertainment_battle', { id }, data)
  }

  async findPendingForTarget(guildId: string, targetId: string, now: Date): Promise<BattleRecord | undefined> {
    const battles = await this.ctx.database.get('entertainment_battle', {
      guildId,
      targetId,
      status: 'pending',
    }, { sort: { createdAt: 'desc' } })
    for (const battle of battles) {
      if (battle.expiresAt.getTime() > now.getTime()) return battle
      await this.updateBattle(battle.id, { status: 'expired' })
    }
  }

  async findPendingFromChallenger(
    guildId: string,
    challengerId: string,
    now: Date,
  ): Promise<BattleRecord | undefined> {
    const battles = await this.ctx.database.get('entertainment_battle', {
      guildId,
      challengerId,
      status: 'pending',
    }, { sort: { createdAt: 'desc' } })
    for (const battle of battles) {
      if (battle.expiresAt.getTime() > now.getTime()) return battle
      await this.updateBattle(battle.id, { status: 'expired' })
    }
  }

  async hasRewardedPairBattle(
    guildId: string,
    firstId: string,
    secondId: string,
    date: string,
  ): Promise<boolean> {
    const battles = await this.ctx.database.get('entertainment_battle', {
      guildId,
      status: 'completed',
      completedDate: date,
    })
    return battles.some((battle) =>
      (battle.challengerId === firstId && battle.targetId === secondId)
      || (battle.challengerId === secondId && battle.targetId === firstId))
  }

  async listBattles(guildId: string, userId: string): Promise<BattleRecord[]> {
    const battles = await this.ctx.database.get('entertainment_battle', { guildId, status: 'completed' })
    return battles.filter((battle) => battle.challengerId === userId || battle.targetId === userId)
  }
}
