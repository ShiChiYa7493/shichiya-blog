import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BACKGROUNDS, BackgroundCache, pickBackground } from '../src/backgrounds'

describe('official background assets', () => {
  const directories: string[] = []

  afterEach(async () => {
    vi.unstubAllGlobals()
    await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
  })

  it('selects the same asset for the same user and date', () => {
    expect(pickBackground('u1', '2026-07-29')).toEqual(pickBackground('u1', '2026-07-29'))
    expect(BACKGROUNDS.length).toBeGreaterThanOrEqual(5)
  })

  it('downloads once and serves subsequent reads from local cache', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'entertainment-backgrounds-'))
    directories.push(directory)
    const bytes = Buffer.from([137, 80, 78, 71, 13, 10])
    const fetchMock = vi.fn(async () => new Response(bytes, {
      status: 200,
      headers: { 'content-type': 'image/png' },
    }))
    vi.stubGlobal('fetch', fetchMock)

    const cache = new BackgroundCache(directory)
    const asset = BACKGROUNDS[0]
    const first = await cache.get(asset)
    const second = await cache.get(asset)
    expect(first).toMatch(/^data:image\/png;base64,/)
    expect(second).toBe(first)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(await readFile(join(directory, 'earth-forest.png'))).toEqual(bytes)
  })
})
