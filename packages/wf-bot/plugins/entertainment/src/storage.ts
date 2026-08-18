import type { Context } from 'koishi'
import type { ProfileState } from './game'
import { defaultProfile } from './game'
import type { RouletteState } from './roulette'

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

export interface InventoryRecord {
  guildId: string
  userId: string
  itemId: string
  quantity: number
}

export interface TransferRecord {
  id: number
  guildId: string
  senderId: string
  targetId: string
  amount: number
  date: string
  createdAt: Date
}

declare module 'koishi' {
  interface Tables {
    entertainment_profile: ProfileState
    entertainment_battle: BattleRecord
    entertainment_inventory: InventoryRecord
    entertainment_transfer: TransferRecord
    entertainment_roulette: RouletteState
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
    challengerChance: 'double',
    roll: 'double',
    winnerId: 'string(255)',
    challengerAdventureId: 'string(64)',
    targetAdventureId: 'string(64)',
    mmrChange: 'integer',
  }, {
    autoInc: true,
  })

  ctx.model.extend('entertainment_inventory', {
    guildId: 'string(255)',
    userId: 'string(255)',
    itemId: 'string(64)',
    quantity: 'integer',
  }, {
    primary: ['guildId', 'userId', 'itemId'],
  })

  ctx.model.extend('entertainment_transfer', {
    id: 'unsigned',
    guildId: 'string(255)',
    senderId: 'string(255)',
    targetId: 'string(255)',
    amount: 'integer',
    date: 'string(10)',
    createdAt: 'timestamp',
  }, {
    autoInc: true,
  })

  ctx.model.extend('entertainment_roulette', {
    guildId: 'string(255)',
    bulletChamber: 'integer',
    nextChamber: 'integer',
    updatedAt: 'timestamp',
  }, {
    primary: 'guildId',
  })
}

export class EntertainmentStore {
  constructor(private ctx: Pick<Context, 'database'>) {}

  async withTransaction<T>(callback: (store: EntertainmentStore) => Promise<T>): Promise<T> {
    let result!: T
    await this.ctx.database.withTransaction(async (database) => {
      result = await callback(new EntertainmentStore({ database }))
    })
    return result
  }

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
    const battles = await this.ctx.database.get('entertainment_battle', {
      guildId,
      status: 'completed',
    }, { sort: { createdAt: 'desc' } })
    return battles.filter((battle) => battle.challengerId === userId || battle.targetId === userId)
  }

  async getBattle(guildId: string, id: number): Promise<BattleRecord | undefined> {
    const [battle] = await this.ctx.database.get('entertainment_battle', { guildId, id })
    return battle
  }

  async hasLostTo(guildId: string, userId: string, opponentId: string): Promise<boolean> {
    const battles = await this.listBattles(guildId, userId)
    return battles.some((battle) =>
      (battle.challengerId === userId && battle.targetId === opponentId
        || battle.targetId === userId && battle.challengerId === opponentId)
      && battle.winnerId === opponentId)
  }

  async getInventory(guildId: string, userId: string): Promise<InventoryRecord[]> {
    const records = await this.ctx.database.get('entertainment_inventory', { guildId, userId })
    return records.filter((record) => record.quantity > 0)
  }

  async getItemQuantity(guildId: string, userId: string, itemId: string): Promise<number> {
    const [record] = await this.ctx.database.get('entertainment_inventory', { guildId, userId, itemId })
    return Math.max(0, record?.quantity ?? 0)
  }

  async addItem(guildId: string, userId: string, itemId: string, amount: number): Promise<number> {
    const quantity = Math.max(0, await this.getItemQuantity(guildId, userId, itemId) + Math.floor(amount))
    await this.ctx.database.upsert('entertainment_inventory', [{ guildId, userId, itemId, quantity }], [
      'guildId',
      'userId',
      'itemId',
    ])
    return quantity
  }

  async consumeItem(guildId: string, userId: string, itemId: string): Promise<boolean> {
    const quantity = await this.getItemQuantity(guildId, userId, itemId)
    if (quantity <= 0) return false
    await this.addItem(guildId, userId, itemId, -1)
    return true
  }

  async sentCreditsOnDate(guildId: string, senderId: string, date: string): Promise<number> {
    const transfers = await this.ctx.database.get('entertainment_transfer', { guildId, senderId, date })
    return transfers.reduce((sum, transfer) => sum + transfer.amount, 0)
  }

  async createTransfer(data: Omit<TransferRecord, 'id'>): Promise<TransferRecord> {
    return this.ctx.database.create('entertainment_transfer', data)
  }

  async getRouletteState(guildId: string): Promise<RouletteState | undefined> {
    const [state] = await this.ctx.database.get('entertainment_roulette', { guildId })
    return state
  }

  async saveRouletteState(state: RouletteState): Promise<void> {
    await this.ctx.database.upsert('entertainment_roulette', [{ ...state }], ['guildId'])
  }
}
