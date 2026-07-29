import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'

export interface BackgroundAsset {
  id: string
  title: string
  /** 来自 Warframe Public Export 的资源路径。 */
  exportPath: string
  /** browse.wf 是公开的 Public Export 镜像，渲染前会下载到本地缓存。 */
  sourceUrl: string
}

/**
 * 这些是官方 Public Export 的 Fragment Artwork / 场景资源，不使用随机搜索图片。
 * 资源版权仍归 Digital Extremes；部署时只将它们作为粉丝项目的背景素材使用。
 */
export const BACKGROUNDS: readonly BackgroundAsset[] = [
  {
    id: 'earth-forest',
    title: '地球森林',
    exportPath: '/Lotus/Interface/FragmentArtwork/Earth1_6213x4142.png',
    sourceUrl: 'https://browse.wf/Lotus/Interface/FragmentArtwork/Earth1_6213x4142.png',
  },
  {
    id: 'void-archive',
    title: '虚空遗迹',
    exportPath: '/Lotus/Interface/FragmentArtwork/Void1_3138x2092.png',
    sourceUrl: 'https://browse.wf/Lotus/Interface/FragmentArtwork/Void1_3138x2092.png',
  },
  {
    id: 'orbiter',
    title: '轨道飞行器',
    exportPath: '/Lotus/Interface/FragmentArtwork/Tennoorbiter_4827x3218.png',
    sourceUrl: 'https://browse.wf/Lotus/Interface/FragmentArtwork/Tennoorbiter_4827x3218.png',
  },
  {
    id: 'lotus',
    title: 'Lotus',
    exportPath: '/Lotus/Interface/FragmentArtwork/Lotusconcept_2327x1551.png',
    sourceUrl: 'https://browse.wf/Lotus/Interface/FragmentArtwork/Lotusconcept_2327x1551.png',
  },
  {
    id: 'derelict',
    title: '废弃遗迹',
    exportPath: '/Lotus/Interface/FragmentArtwork/Derelict1_1535x1023.png',
    sourceUrl: 'https://browse.wf/Lotus/Interface/FragmentArtwork/Derelict1_1535x1023.png',
  },
  {
    id: 'awakening',
    title: '觉醒',
    exportPath: '/Lotus/Interface/Quests/AwakeningQuestKeychain.png',
    sourceUrl: 'https://browse.wf/Lotus/Interface/Quests/AwakeningQuestKeychain.png',
  },
  {
    id: 'vors-prize',
    title: '沃尔的战利品',
    exportPath: '/Lotus/Interface/Quests/VorsPrizeQuestKeyChain.png',
    sourceUrl: 'https://browse.wf/Lotus/Interface/Quests/VorsPrizeQuestKeyChain.png',
  },
  {
    id: 'natah',
    title: 'Natah',
    exportPath: '/Lotus/Interface/Quests/SentientQuestKeyChain.png',
    sourceUrl: 'https://browse.wf/Lotus/Interface/Quests/SentientQuestKeyChain.png',
  },
  {
    id: 'second-dream',
    title: '第二梦',
    exportPath: '/Lotus/Interface/Quests/OrokinMoonQuestKeyChain.png',
    sourceUrl: 'https://browse.wf/Lotus/Interface/Quests/OrokinMoonQuestKeyChain.png',
  },
  {
    id: 'war-within',
    title: '内战',
    exportPath: '/Lotus/Interface/Quests/TheWarWithinQuestKeychain.png',
    sourceUrl: 'https://browse.wf/Lotus/Interface/Quests/TheWarWithinQuestKeychain.png',
  },
  {
    id: 'apostasy-prologue',
    title: '变节序言',
    exportPath: '/Lotus/Interface/Quests/ApostasyPrologueStartQuestKeyChain.png',
    sourceUrl: 'https://browse.wf/Lotus/Interface/Quests/ApostasyPrologueStartQuestKeyChain.png',
  },
  {
    id: 'sacrifice',
    title: '牺牲',
    exportPath: '/Lotus/Interface/Quests/SacrificeQuestKeyChain.png',
    sourceUrl: 'https://browse.wf/Lotus/Interface/Quests/SacrificeQuestKeyChain.png',
  },
  {
    id: 'chimera-prologue',
    title: '奇美拉序言',
    exportPath: '/Lotus/Interface/Quests/ChimeraKeyChain.png',
    sourceUrl: 'https://browse.wf/Lotus/Interface/Quests/ChimeraKeyChain.png',
  },
  {
    id: 'new-war-prologue',
    title: '新纪之战序章',
    exportPath: '/Lotus/Interface/Quests/NewWarIntroQuestKeychain.png',
    sourceUrl: 'https://browse.wf/Lotus/Interface/Quests/NewWarIntroQuestKeychain.png',
  },
  {
    id: 'new-war',
    title: '新纪之战',
    exportPath: '/Lotus/Interface/Quests/TheNewWarQuestKeyChain.png',
    sourceUrl: 'https://browse.wf/Lotus/Interface/Quests/TheNewWarQuestKeyChain.png',
  },
  {
    id: 'zariman',
    title: '扎里曼的天使',
    exportPath: '/Lotus/Interface/Quests/AngelsOfTheZarimanQuestKeychain.png',
    sourceUrl: 'https://browse.wf/Lotus/Interface/Quests/AngelsOfTheZarimanQuestKeychain.png',
  },
  {
    id: 'jade-shadows',
    title: '翠玉暗影',
    exportPath: '/Lotus/Interface/Quests/JadeShadowsQuestKeychain.png',
    sourceUrl: 'https://browse.wf/Lotus/Interface/Quests/JadeShadowsQuestKeychain.png',
  },
  {
    id: 'whispers-walls',
    title: '墙中低语',
    exportPath: '/Lotus/Interface/Quests/EntratiQuestKeyChain.png',
    sourceUrl: 'https://browse.wf/Lotus/Interface/Quests/EntratiQuestKeyChain.png',
  },
  {
    id: 'duviri',
    title: '双衍悖论',
    exportPath: '/Lotus/Interface/Quests/Duviri/DuviriParadoxMain.png',
    sourceUrl: 'https://browse.wf/Lotus/Interface/Quests/Duviri/DuviriParadoxMain.png',
  },
  {
    id: 'warframe-1999',
    title: 'Warframe：1999',
    exportPath: '/Lotus/Interface/Quests/1999QuestKeyChain.png',
    sourceUrl: 'https://browse.wf/Lotus/Interface/Quests/1999QuestKeyChain.png',
  },
  {
    id: 'deadlock-protocol',
    title: '僵局协议',
    exportPath: '/Lotus/Interface/Quests/DeadlockProtocolQuestKeychain.png',
    sourceUrl: 'https://browse.wf/Lotus/Interface/Quests/DeadlockProtocolQuestKeychain.png',
  },
  {
    id: 'heart-deimos',
    title: '惊惧之心',
    exportPath: '/Lotus/Interface/Quests/HeartOfDeimosKeychain.png',
    sourceUrl: 'https://browse.wf/Lotus/Interface/Quests/HeartOfDeimosKeychain.png',
  },
  {
    id: 'vox-solaris',
    title: '索拉里斯之声',
    exportPath: '/Lotus/Interface/Quests/SolarisQuestKeyChain.png',
    sourceUrl: 'https://browse.wf/Lotus/Interface/Quests/SolarisQuestKeyChain.png',
  },
  {
    id: 'call-tempestarii',
    title: '风暴的呼唤',
    exportPath: '/Lotus/Interface/Quests/TempestariiQuestKeychain.png',
    sourceUrl: 'https://browse.wf/Lotus/Interface/Quests/TempestariiQuestKeychain.png',
  },
  {
    id: 'veilbreaker',
    title: '破障者',
    exportPath: '/Lotus/Interface/Quests/VeilbreakerQuestKeychain.png',
    sourceUrl: 'https://browse.wf/Lotus/Interface/Quests/VeilbreakerQuestKeychain.png',
  },
]

const MAX_BACKGROUND_BYTES = 8 * 1024 * 1024

export function pickBackground(userId: string, date: string): BackgroundAsset {
  const index = hash(`${userId}:${date}`) % BACKGROUNDS.length
  return BACKGROUNDS[index]
}

function hash(input: string): number {
  let value = 2166136261
  for (let index = 0; index < input.length; index++) {
    value ^= input.charCodeAt(index)
    value = Math.imul(value, 16777619)
  }
  return (value >>> 0)
}

export class BackgroundCache {
  private readonly pending = new Map<string, Promise<string | undefined>>()

  constructor(private readonly directory: string) {}

  async get(asset: BackgroundAsset): Promise<string | undefined> {
    const existing = this.pending.get(asset.id)
    if (existing) return existing
    const task = this.load(asset).finally(() => this.pending.delete(asset.id))
    this.pending.set(asset.id, task)
    return task
  }

  private filePath(asset: BackgroundAsset): string {
    const extension = basename(asset.exportPath).split('.').pop() || 'png'
    return join(this.directory, `${asset.id}.${extension}`)
  }

  private async load(asset: BackgroundAsset): Promise<string | undefined> {
    const path = this.filePath(asset)
    try {
      const metadata = await stat(path)
      if (metadata.size > 0 && metadata.size <= MAX_BACKGROUND_BYTES) {
        return this.toDataUri(await readFile(path), 'image/png')
      }
    } catch {
      // 首次使用时没有缓存，继续下载。
    }

    try {
      const response = await fetch(asset.sourceUrl, {
        headers: { 'user-agent': 'shichiya-blog/entertainment-background-cache' },
        signal: AbortSignal.timeout(8_000),
      })
      if (!response.ok) return undefined
      const contentType = response.headers.get('content-type') || ''
      if (!contentType.startsWith('image/')) return undefined
      const buffer = Buffer.from(await response.arrayBuffer())
      if (!buffer.length || buffer.length > MAX_BACKGROUND_BYTES) return undefined
      await mkdir(this.directory, { recursive: true })
      await writeFile(path, buffer)
      return this.toDataUri(buffer, contentType.split(';')[0] || 'image/png')
    } catch {
      return undefined
    }
  }

  private toDataUri(buffer: Buffer, contentType: string): string {
    return `data:${contentType};base64,${buffer.toString('base64')}`
  }
}
