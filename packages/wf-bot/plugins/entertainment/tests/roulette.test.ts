import { describe, expect, it, vi } from 'vitest'
import {
  createRouletteState,
  playRouletteTurn,
  pullRouletteTrigger,
  type RouletteState,
} from '../src/roulette'

describe('roulette', () => {
  it('advances sequentially until the loaded chamber fires', () => {
    let state = createRouletteState('g1', 2, new Date(0))
    const first = pullRouletteTrigger(state, 5, new Date(1))
    expect(first).toMatchObject({ hit: false, shotNumber: 1 })
    state = first.state

    const second = pullRouletteTrigger(state, 5, new Date(2))
    expect(second).toMatchObject({ hit: false, shotNumber: 2 })
    state = second.state

    const third = pullRouletteTrigger(state, 4, new Date(3))
    expect(third).toMatchObject({ hit: true, shotNumber: 3 })
    expect(third.state).toMatchObject({ bulletChamber: 4, nextChamber: 0 })
  })

  it('persists a reload before muting the hit user', async () => {
    let state: RouletteState | undefined = createRouletteState('g1', 0)
    const events: string[] = []
    const result = await playRouletteTurn({
      guildId: 'g1',
      store: {
        getRouletteState: async () => state,
        saveRouletteState: async (next) => {
          events.push('save')
          state = next
        },
      },
      randomChamber: () => 3,
      mute: async () => {
        events.push('mute')
      },
    })

    expect(result.status).toBe('hit')
    expect(events).toEqual(['save', 'mute'])
    expect(state).toMatchObject({ bulletChamber: 3, nextChamber: 0 })
  })

  it('consumes the bullet and reports mute failures', async () => {
    let state: RouletteState | undefined = createRouletteState('g1', 0)
    const mute = vi.fn().mockRejectedValue(new Error('forbidden'))
    const result = await playRouletteTurn({
      guildId: 'g1',
      store: {
        getRouletteState: async () => state,
        saveRouletteState: async (next) => { state = next },
      },
      randomChamber: () => 5,
      mute,
    })

    expect(result.status).toBe('mute-failed')
    expect(state).toMatchObject({ bulletChamber: 5, nextChamber: 0 })
    expect(mute).toHaveBeenCalledOnce()
  })
})
