import memory from '@koishijs/plugin-database-memory'
import { Context } from '@koishijs/core'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { EntertainmentStore, extendModels } from '../src/storage'

describe('database storage', () => {
  let app: Context
  let store: EntertainmentStore

  beforeEach(async () => {
    app = new Context()
    app.plugin(memory)
    extendModels(app)
    await app.start()
    store = new EntertainmentStore(app)
  })

  afterEach(async () => {
    await app.stop()
  })

  it('persists group-scoped profiles', async () => {
    const profile = await store.getProfile('g1', 'u1')
    profile.credits = 42
    await store.saveProfile(profile)
    expect((await store.getProfile('g1', 'u1')).credits).toBe(42)
    expect((await store.getProfile('g2', 'u1')).credits).toBe(0)
  })

  it('creates and retrieves pending challenges', async () => {
    const now = new Date('2026-07-29T00:00:00.000Z')
    const battle = await store.createBattle({
      guildId: 'g1', challengerId: 'u1', targetId: 'u2', status: 'pending', stake: 10,
      createdAt: now, expiresAt: new Date(now.getTime() + 90_000), completedDate: '',
      challengerPower: 0, targetPower: 0, challengerChance: 0, roll: 0, winnerId: '',
      challengerAdventureId: '', targetAdventureId: '', mmrChange: 0,
    })
    expect(battle.id).toBeTypeOf('number')
    expect((await store.findPendingForTarget('g1', 'u2', now))?.id).toBe(battle.id)
  })

  it('stores consumable inventory and consumes one item at a time', async () => {
    expect(await store.addItem('g1', 'u1', 'power-booster', 2)).toBe(2)
    expect(await store.consumeItem('g1', 'u1', 'power-booster')).toBe(true)
    expect(await store.getItemQuantity('g1', 'u1', 'power-booster')).toBe(1)
    expect((await store.getInventory('g1', 'u1'))[0]).toMatchObject({
      itemId: 'power-booster',
      quantity: 1,
    })
  })

  it('tracks daily gifts and previous losses', async () => {
    const now = new Date('2026-07-29T00:00:00.000Z')
    await store.createTransfer({
      guildId: 'g1', senderId: 'u1', targetId: 'u2', amount: 20,
      date: '2026-07-29', createdAt: now,
    })
    expect(await store.sentCreditsOnDate('g1', 'u1', '2026-07-29')).toBe(20)

    await store.createBattle({
      guildId: 'g1', challengerId: 'u1', targetId: 'u2', status: 'completed', stake: 10,
      createdAt: now, expiresAt: now, completedDate: '2026-07-29', challengerPower: 100,
      targetPower: 100, challengerChance: 0.5, roll: 0.8, winnerId: 'u2',
      challengerAdventureId: '', targetAdventureId: '', mmrChange: -12,
    })
    expect(await store.hasLostTo('g1', 'u1', 'u2')).toBe(true)
    expect(await store.hasLostTo('g1', 'u2', 'u1')).toBe(false)
  })

  it('rolls back multi-record economy operations on failure', async () => {
    const profile = await store.getProfile('g1', 'u1')
    profile.credits = 50
    await store.saveProfile(profile)

    await expect(store.withTransaction(async (transaction) => {
      const current = await transaction.getProfile('g1', 'u1')
      current.credits = 10
      await transaction.saveProfile(current)
      await transaction.addItem('g1', 'u1', 'power-booster', 1)
      throw new Error('rollback')
    })).rejects.toThrow('rollback')

    expect((await store.getProfile('g1', 'u1')).credits).toBe(50)
    expect(await store.getItemQuantity('g1', 'u1', 'power-booster')).toBe(0)
  })
})
