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
})
