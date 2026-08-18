export const GENSHIN_MUTE_KEYWORD = '原神'
export const GENSHIN_MUTE_DURATION = 30_000

export interface GenshinMuteOptions {
  content?: string
  guildId?: string
  userId?: string
  selfId?: string
  mute: () => Promise<void>
}

export type GenshinMuteResult
  = | { status: 'ignored' }
    | { status: 'muted' }
    | { status: 'mute-failed', error: unknown }

export async function muteGenshinSpeaker(
  options: GenshinMuteOptions,
): Promise<GenshinMuteResult> {
  const { content, guildId, userId, selfId, mute } = options
  if (!guildId || !userId || userId === selfId || !content?.includes(GENSHIN_MUTE_KEYWORD)) {
    return { status: 'ignored' }
  }

  try {
    await mute()
    return { status: 'muted' }
  } catch (error) {
    return { status: 'mute-failed', error }
  }
}
