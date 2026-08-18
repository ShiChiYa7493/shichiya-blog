import { describe, expect, it, vi } from 'vitest'
import {
  GENSHIN_MUTE_DURATION,
  muteGenshinSpeaker,
} from '../src/genshin-mute'

describe('genshin mute', () => {
  it('mutes a guild speaker for 30 seconds when the message contains the keyword', async () => {
    const mute = vi.fn().mockResolvedValue(undefined)

    const result = await muteGenshinSpeaker({
      content: '今天玩原神吗',
      guildId: 'guild-1',
      userId: 'user-1',
      selfId: 'bot-1',
      mute,
    })

    expect(result.status).toBe('muted')
    expect(GENSHIN_MUTE_DURATION).toBe(30_000)
    expect(mute).toHaveBeenCalledOnce()
  })

  it.each([
    { content: '原神', userId: 'user-1' },
    { content: '原 神', guildId: 'guild-1', userId: 'user-1' },
    { content: '原神', guildId: 'guild-1' },
    { content: '原神', guildId: 'guild-1', userId: 'bot-1' },
  ])('ignores non-matching or ineligible messages: %o', async (input) => {
    const mute = vi.fn().mockResolvedValue(undefined)
    const result = await muteGenshinSpeaker({ ...input, selfId: 'bot-1', mute })

    expect(result.status).toBe('ignored')
    expect(mute).not.toHaveBeenCalled()
  })

  it('reports permission failures without throwing', async () => {
    const error = new Error('forbidden')
    const result = await muteGenshinSpeaker({
      content: '原神',
      guildId: 'guild-1',
      userId: 'user-1',
      selfId: 'bot-1',
      mute: vi.fn().mockRejectedValue(error),
    })

    expect(result).toEqual({ status: 'mute-failed', error })
  })
})
