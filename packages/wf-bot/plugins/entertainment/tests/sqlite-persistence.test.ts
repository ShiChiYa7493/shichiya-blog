import sqlite from '@koishijs/plugin-database-sqlite'
import { Context } from '@koishijs/core'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { EntertainmentStore, extendModels } from '../src/storage'

describe('sqlite persistence', () => {
  const directories: string[] = []

  afterEach(async () => {
    await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
  })

  it('keeps profiles, inventory and gift records after a restart', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'entertainment-sqlite-'))
    directories.push(directory)
    const databasePath = join(directory, 'koishi.db')

    const first = new Context()
    first.plugin(sqlite, { path: databasePath })
    extendModels(first)
    await first.start()
    const firstStore = new EntertainmentStore(first)
    const profile = await firstStore.getProfile('g1', 'u1')
    profile.credits = 88
    await firstStore.saveProfile(profile)
    await firstStore.addItem('g1', 'u1', 'power-booster', 2)
    await firstStore.createTransfer({
      guildId: 'g1', senderId: 'u1', targetId: 'u2', amount: 10,
      date: '2026-07-29', createdAt: new Date('2026-07-29T00:00:00.000Z'),
    })
    await first.stop()

    const second = new Context()
    second.plugin(sqlite, { path: databasePath })
    extendModels(second)
    await second.start()
    const secondStore = new EntertainmentStore(second)
    expect((await secondStore.getProfile('g1', 'u1')).credits).toBe(88)
    expect(await secondStore.getItemQuantity('g1', 'u1', 'power-booster')).toBe(2)
    expect(await secondStore.sentCreditsOnDate('g1', 'u1', '2026-07-29')).toBe(10)
    await second.stop()
  })
})
