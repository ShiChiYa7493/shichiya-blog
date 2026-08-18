export const ROULETTE_CHAMBERS = 6

export interface RouletteState {
  guildId: string
  bulletChamber: number
  nextChamber: number
  updatedAt: Date
}

export interface RoulettePull {
  hit: boolean
  shotNumber: number
  state: RouletteState
}

export interface RouletteStore {
  getRouletteState(guildId: string): Promise<RouletteState | undefined>
  saveRouletteState(state: RouletteState): Promise<void>
}

export type RouletteTurnStatus = 'empty' | 'hit' | 'mute-failed'

export interface RouletteTurnResult extends RoulettePull {
  status: RouletteTurnStatus
  muteError?: unknown
}

function assertChamber(chamber: number): void {
  if (!Number.isInteger(chamber) || chamber < 0 || chamber >= ROULETTE_CHAMBERS) {
    throw new RangeError(`roulette chamber must be between 0 and ${ROULETTE_CHAMBERS - 1}`)
  }
}

export function createRouletteState(
  guildId: string,
  bulletChamber: number,
  updatedAt = new Date(),
): RouletteState {
  assertChamber(bulletChamber)
  return { guildId, bulletChamber, nextChamber: 0, updatedAt }
}

export function pullRouletteTrigger(
  current: RouletteState,
  reloadedBulletChamber: number,
  updatedAt = new Date(),
): RoulettePull {
  assertChamber(current.bulletChamber)
  assertChamber(current.nextChamber)
  const hit = current.nextChamber === current.bulletChamber
  const shotNumber = current.nextChamber + 1

  if (hit) {
    return {
      hit,
      shotNumber,
      state: createRouletteState(current.guildId, reloadedBulletChamber, updatedAt),
    }
  }

  return {
    hit,
    shotNumber,
    state: {
      ...current,
      nextChamber: current.nextChamber + 1,
      updatedAt,
    },
  }
}

export async function playRouletteTurn(options: {
  store: RouletteStore
  guildId: string
  randomChamber: () => number
  mute: () => Promise<void>
  now?: Date
}): Promise<RouletteTurnResult> {
  const { store, guildId, randomChamber, mute } = options
  const now = options.now ?? new Date()
  const current = await store.getRouletteState(guildId)
    ?? createRouletteState(guildId, randomChamber(), now)
  const pull = pullRouletteTrigger(current, randomChamber(), now)

  // Persist the next chamber (or freshly reloaded cylinder) before attempting
  // the external mute so a failed API call cannot make the bullet reusable.
  await store.saveRouletteState(pull.state)
  if (!pull.hit) return { ...pull, status: 'empty' }

  try {
    await mute()
    return { ...pull, status: 'hit' }
  } catch (muteError) {
    return { ...pull, status: 'mute-failed', muteError }
  }
}
