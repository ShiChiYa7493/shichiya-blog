import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { Adventure } from './adventures'
import type { ShopItem } from './economy'

export type CosmeticSlot = 'title' | 'frame' | 'background'
export type BackgroundTheme = 'warframe' | 'girl'
export type ShopCategory = CosmeticSlot | 'consumable'

export interface FrameTheme {
  stroke: string
  strokeWidth: number
  innerStroke?: string
  glow?: string
}

export interface CosmeticItem {
  id: string
  slot: CosmeticSlot
  name: string
  aliases: readonly string[]
  price: number
  description: string
  theme?: BackgroundTheme
  titleColor?: string
  frame?: FrameTheme
  file?: string
}

export interface LoadoutState {
  guildId: string
  userId: string
  titleId: string
  frameId: string
  backgroundId: string
}

export const PREVIEW_ADVENTURE: Adventure = {
  id: 'shop-preview',
  title: '商店预览',
  description: '仅供预览，不会消耗积分，也不会改变当前穿戴。',
  trigger: 'shop',
  weight: 0,
  effects: [],
}

export const DEFAULT_EQUIP_ALIASES = {
  默认称号: 'title',
  默认边框: 'frame',
  默认背景: 'background',
} as const

export const BACKGROUND_PRICE = 200

export const COSMETICS: readonly CosmeticItem[] = [
  { id: 'title-relay-recruit', slot: 'title', name: '中继站新兵', aliases: ['新兵'], price: 80, description: '签到和对战卡显示该称号。', titleColor: '#c5d4dc' },
  { id: 'title-plains-guest', slot: 'title', name: '地球平原客', aliases: ['平原客'], price: 100, description: '签到和对战卡显示该称号。', titleColor: '#8fde72' },
  { id: 'title-void-walker', slot: 'title', name: '虚空行者', aliases: ['行者'], price: 130, description: '签到和对战卡显示该称号。', titleColor: '#8fe7ef' },
  { id: 'title-steel-vanguard', slot: 'title', name: '钢铁先锋', aliases: ['先锋'], price: 160, description: '签到和对战卡显示该称号。', titleColor: '#d8dee3' },
  { id: 'title-cephalon-guard', slot: 'title', name: '中枢守护者', aliases: ['守护者'], price: 190, description: '签到和对战卡显示该称号。', titleColor: '#7ec8e3' },
  { id: 'title-tenno', slot: 'title', name: 'Tenno', aliases: ['tenno'], price: 220, description: '签到和对战卡显示该称号。', titleColor: '#f5bd42' },
  { id: 'title-lotus-envoy', slot: 'title', name: 'Lotus 使节', aliases: ['使节', 'lotus使节'], price: 260, description: '签到和对战卡显示该称号。', titleColor: '#d6a3ff' },
  { id: 'title-zariman-crew', slot: 'title', name: '扎里曼船员', aliases: ['船员'], price: 300, description: '签到和对战卡显示该称号。', titleColor: '#f0d48a' },
  { id: 'title-duviri-wanderer', slot: 'title', name: '双衍旅人', aliases: ['旅人'], price: 340, description: '签到和对战卡显示该称号。', titleColor: '#c9a0ff' },
  { id: 'title-legend', slot: 'title', name: '传奇战士', aliases: ['传奇'], price: 400, description: '签到和对战卡显示该称号。', titleColor: '#ffcf69' },

  { id: 'frame-silver', slot: 'frame', name: '银质细框', aliases: ['银框'], price: 80, description: '为签到卡和对战卡加上银色细边框。', frame: { stroke: '#c9d4dc', strokeWidth: 3 } },
  { id: 'frame-bronze', slot: 'frame', name: '青铜双线', aliases: ['铜框'], price: 110, description: '为签到卡和对战卡加上青铜双线边框。', frame: { stroke: '#c08a4a', strokeWidth: 5, innerStroke: '#8a5a28' } },
  { id: 'frame-grineer', slot: 'frame', name: 'Grineer 军绿', aliases: ['军绿', 'grineer'], price: 140, description: '为签到卡和对战卡加上军绿色边框。', frame: { stroke: '#6f8f4e', strokeWidth: 4 } },
  { id: 'frame-corpus', slot: 'frame', name: 'Corpus 冷白', aliases: ['冷白', 'corpus'], price: 170, description: '为签到卡和对战卡加上冷白色边框。', frame: { stroke: '#d7eef5', strokeWidth: 4, glow: '#8fe7ef' } },
  { id: 'frame-infested', slot: 'frame', name: '感染体橙纹', aliases: ['橙框', '感染'], price: 200, description: '为签到卡和对战卡加上感染体橙色边框。', frame: { stroke: '#e38a3c', strokeWidth: 5, innerStroke: '#8a3a12' } },
  { id: 'frame-void', slot: 'frame', name: '虚空青辉', aliases: ['青框', '虚空框'], price: 230, description: '为签到卡和对战卡加上虚空青色边框。', frame: { stroke: '#8fe7ef', strokeWidth: 4, glow: '#8fe7ef' } },
  { id: 'frame-orokin', slot: 'frame', name: 'Orokin 金纹', aliases: ['金框', 'orokin'], price: 270, description: '为签到卡和对战卡加上 Orokin 金色边框。', frame: { stroke: '#f0d48a', strokeWidth: 5, innerStroke: '#c9a24a' } },
  { id: 'frame-lotus', slot: 'frame', name: 'Lotus 紫辉', aliases: ['紫框', 'lotus框'], price: 310, description: '为签到卡和对战卡加上 Lotus 紫色边框。', frame: { stroke: '#d6a3ff', strokeWidth: 4, glow: '#d6a3ff' } },
  { id: 'frame-1999', slot: 'frame', name: '1999 霓虹', aliases: ['霓虹'], price: 350, description: '为签到卡和对战卡加上 1999 霓虹边框。', frame: { stroke: '#ff4d8d', strokeWidth: 4, innerStroke: '#3de0ff', glow: '#ff4d8d' } },
  { id: 'frame-legend', slot: 'frame', name: '传奇金紫', aliases: ['金紫'], price: 400, description: '为签到卡和对战卡加上金紫传奇边框。', frame: { stroke: '#ffcf69', strokeWidth: 6, innerStroke: '#d6a3ff', glow: '#ffcf69' } },

  { id: 'bg-void-ruins', slot: 'background', name: '虚空遗迹', aliases: [], price: BACKGROUND_PRICE, description: '将签到卡背景换成虚空遗迹。', theme: 'warframe', file: 'bg-void-ruins.png' },
  { id: 'bg-orbiter', slot: 'background', name: '轨道飞行器', aliases: ['Orbiter'], price: BACKGROUND_PRICE, description: '将签到卡背景换成轨道飞行器内部。', theme: 'warframe', file: 'bg-orbiter.png' },
  { id: 'bg-earth-night', slot: 'background', name: '地球森林夜景', aliases: ['森林夜景'], price: BACKGROUND_PRICE, description: '将签到卡背景换成地球森林夜景。', theme: 'warframe', file: 'bg-earth-night.png' },
  { id: 'bg-orokin-hall', slot: 'background', name: 'Orokin 金殿', aliases: ['金殿'], price: BACKGROUND_PRICE, description: '将签到卡背景换成 Orokin 金殿。', theme: 'warframe', file: 'bg-orokin-hall.png' },
  { id: 'bg-1999-city', slot: 'background', name: '1999 夜城', aliases: ['夜城'], price: BACKGROUND_PRICE, description: '将签到卡背景换成 1999 夜城。', theme: 'warframe', file: 'bg-1999-city.png' },
  { id: 'bg-lotus-chamber', slot: 'background', name: 'Lotus 指挥室', aliases: ['指挥室'], price: BACKGROUND_PRICE, description: '将签到卡背景换成 Lotus 指挥室。', theme: 'warframe', file: 'bg-lotus-chamber.png' },
  { id: 'bg-deimos', slot: 'background', name: '火卫二感染巢', aliases: ['感染巢'], price: BACKGROUND_PRICE, description: '将签到卡背景换成火卫二感染巢。', theme: 'warframe', file: 'bg-deimos.png' },
  { id: 'bg-fortuna', slot: 'background', name: '福尔图娜雨巷', aliases: ['福尔图娜'], price: BACKGROUND_PRICE, description: '将签到卡背景换成福尔图娜雨巷。', theme: 'warframe', file: 'bg-fortuna.png' },
  { id: 'bg-zariman', slot: 'background', name: '扎里曼走廊', aliases: [], price: BACKGROUND_PRICE, description: '将签到卡背景换成扎里曼走廊。', theme: 'warframe', file: 'bg-zariman.png' },
  { id: 'bg-duviri', slot: 'background', name: '双衍王境天空', aliases: ['双衍天空'], price: BACKGROUND_PRICE, description: '将签到卡背景换成双衍王境天空。', theme: 'warframe', file: 'bg-duviri.png' },

  { id: 'bg-mecha-girl', slot: 'background', name: '银发机甲少女', aliases: ['机甲少女'], price: BACKGROUND_PRICE, description: '将签到卡背景换成银发机甲少女。', theme: 'girl', file: 'bg-mecha-girl.png' },
  { id: 'bg-rain-girl', slot: 'background', name: '夜雨短发少女', aliases: ['夜雨少女'], price: BACKGROUND_PRICE, description: '将签到卡背景换成夜雨短发少女。', theme: 'girl', file: 'bg-rain-girl.png' },
  { id: 'bg-library-girl', slot: 'background', name: '图书馆长发少女', aliases: ['图书馆少女'], price: BACKGROUND_PRICE, description: '将签到卡背景换成图书馆长发少女。', theme: 'girl', file: 'bg-library-girl.png' },
  { id: 'bg-rooftop-girl', slot: 'background', name: '天台晚风少女', aliases: ['天台少女'], price: BACKGROUND_PRICE, description: '将签到卡背景换成天台晚风少女。', theme: 'girl', file: 'bg-rooftop-girl.png' },
  { id: 'bg-cafe-girl', slot: 'background', name: '咖啡馆窗边少女', aliases: ['咖啡少女'], price: BACKGROUND_PRICE, description: '将签到卡背景换成咖啡馆窗边少女。', theme: 'girl', file: 'bg-cafe-girl.png' },
  { id: 'bg-seaside-girl', slot: 'background', name: '海边风衣少女', aliases: ['海边少女'], price: BACKGROUND_PRICE, description: '将签到卡背景换成海边风衣少女。', theme: 'girl', file: 'bg-seaside-girl.png' },
  { id: 'bg-shrine-girl', slot: 'background', name: '神社夜灯少女', aliases: ['神社少女'], price: BACKGROUND_PRICE, description: '将签到卡背景换成神社夜灯少女。', theme: 'girl', file: 'bg-shrine-girl.png' },
  { id: 'bg-metro-girl', slot: 'background', name: '地铁车厢少女', aliases: ['地铁少女'], price: BACKGROUND_PRICE, description: '将签到卡背景换成地铁车厢少女。', theme: 'girl', file: 'bg-metro-girl.png' },
  { id: 'bg-greenhouse-girl', slot: 'background', name: '温室花房少女', aliases: ['花房少女'], price: BACKGROUND_PRICE, description: '将签到卡背景换成温室花房少女。', theme: 'girl', file: 'bg-greenhouse-girl.png' },
  { id: 'bg-stargaze-girl', slot: 'background', name: '星空屋顶少女', aliases: ['星空少女'], price: BACKGROUND_PRICE, description: '将签到卡背景换成星空屋顶少女。', theme: 'girl', file: 'bg-stargaze-girl.png' },
]

export function defaultLoadout(guildId: string, userId: string): LoadoutState {
  return { guildId, userId, titleId: '', frameId: '', backgroundId: '' }
}

export function findCosmetic(raw: string): CosmeticItem | undefined {
  const normalized = raw.trim().toLowerCase()
  return COSMETICS.find((item) =>
    item.id === normalized
    || item.name.toLowerCase() === normalized
    || item.aliases.some((alias) => alias.toLowerCase() === normalized))
}

export function parseShopCategory(raw?: string): ShopCategory | undefined {
  const normalized = raw?.trim()
  if (!normalized) return undefined
  if (['道具', '战斗', '消耗'].includes(normalized)) return 'consumable'
  if (normalized === '称号') return 'title'
  if (normalized === '边框') return 'frame'
  if (normalized === '背景') return 'background'
}

export function splitPurchaseInput(raw: string): { query: string, quantity: number } {
  const trimmed = raw.trim()
  const matched = trimmed.match(/^(.*?)(?:\s+(\d+))?$/)
  return {
    query: (matched?.[1] ?? trimmed).trim(),
    quantity: Number(matched?.[2] ?? 1),
  }
}

export function parseEquipTarget(raw: string):
  | { type: 'default', slot: CosmeticSlot }
  | { type: 'item', query: string }
  | undefined {
  const normalized = raw.trim()
  if (!normalized) return undefined
  const slot = DEFAULT_EQUIP_ALIASES[normalized as keyof typeof DEFAULT_EQUIP_ALIASES]
  if (slot) return { type: 'default', slot }
  return { type: 'item', query: normalized }
}

export function applyEquip(loadout: LoadoutState, item: CosmeticItem): LoadoutState {
  const next = { ...loadout }
  if (item.slot === 'title') next.titleId = item.id
  if (item.slot === 'frame') next.frameId = item.id
  if (item.slot === 'background') next.backgroundId = item.id
  return next
}

export function applyUnequip(loadout: LoadoutState, slot: CosmeticSlot): LoadoutState {
  const next = { ...loadout }
  if (slot === 'title') next.titleId = ''
  if (slot === 'frame') next.frameId = ''
  if (slot === 'background') next.backgroundId = ''
  return next
}

export function equippedId(loadout: LoadoutState, slot: CosmeticSlot): string {
  if (slot === 'title') return loadout.titleId
  if (slot === 'frame') return loadout.frameId
  return loadout.backgroundId
}

export function formatTitle(item: CosmeticItem | undefined): string {
  return item ? `【${item.name}】` : ''
}

function discountLine(discountPercent: number): string {
  return discountPercent > 0 ? `今日奇遇折扣：${discountPercent}%（首次购买生效）\n` : ''
}

function itemLine(
  name: string,
  price: number,
  description: string,
  owned: boolean,
): string {
  return `${name}｜${price} 积分｜${description}${owned ? '｜已拥有' : ''}`
}

export function renderShopCatalog(
  category: ShopCategory | undefined,
  discountPercent: number,
  ownedIds: ReadonlySet<string>,
  combatItems: readonly ShopItem[],
): string {
  const discount = discountLine(discountPercent)
  if (!category) {
    return `积分商店\n${discount}`
      + `道具：${combatItems.map((item) => item.name).join('、')}\n`
      + '称号：发送「积分商店 称号」查看 10 件\n'
      + '边框：发送「积分商店 边框」查看 10 件\n'
      + '背景：发送「积分商店 背景」查看 20 件\n'
      + '购买方式：「购买 商品名」；预览：「预览 商品名」'
  }
  if (category === 'consumable') {
    return `积分商店｜道具\n${discount}`
      + combatItems.map((item) => itemLine(item.name, item.price, item.description, false)).join('\n')
      + '\n购买方式：「购买 商品名 [数量]」'
  }
  const items = COSMETICS.filter((item) => item.slot === category)
  const label = category === 'title' ? '称号' : category === 'frame' ? '边框' : '背景'
  return `积分商店｜${label}\n${discount}`
    + items.map((item) => itemLine(item.name, item.price, item.description, ownedIds.has(item.id))).join('\n')
    + '\n购买方式：「购买 商品名」；预览：「预览 商品名」'
}

export function renderCosmeticBag(owned: readonly CosmeticItem[], loadout: LoadoutState): string {
  const slots: CosmeticSlot[] = ['title', 'frame', 'background']
  const labels: Record<CosmeticSlot, string> = { title: '称号', frame: '边框', background: '背景' }
  const lines = slots.map((slot) => {
    const items = owned.filter((item) => item.slot === slot)
    if (!items.length) return `${labels[slot]}：暂无`
    return `${labels[slot]}：${items.map((item) =>
      item.id === equippedId(loadout, slot) ? `${item.name}（已装备）` : item.name).join('、')}`
  })
  return `外观\n${lines.join('\n')}\n更换：「装备 名称」；卸下：「装备 默认称号」`
}

export function cosmeticBackgroundDirectory(): string {
  const bundled = join(__dirname, 'assets', 'cosmetics', 'backgrounds')
  const source = join(__dirname, '..', 'assets', 'cosmetics', 'backgrounds')
  return existsSync(bundled) ? bundled : source
}

export async function loadCosmeticBackgroundFile(file: string): Promise<string | undefined> {
  try {
    const buffer = await readFile(join(cosmeticBackgroundDirectory(), file))
    if (!buffer.length) return undefined
    return `data:image/png;base64,${buffer.toString('base64')}`
  } catch {
    return undefined
  }
}

export function previewAppearance(item: CosmeticItem): {
  titleName?: string
  titleColor?: string
  frameId?: string
  backgroundFile?: string
} {
  return {
    titleName: item.slot === 'title' ? item.name : undefined,
    titleColor: item.slot === 'title' ? item.titleColor : undefined,
    frameId: item.slot === 'frame' ? item.id : undefined,
    backgroundFile: item.slot === 'background' ? item.file : undefined,
  }
}

export function renderPreviewText(item: CosmeticItem): string {
  const kind = item.slot === 'title' ? '称号' : item.slot === 'frame' ? '边框' : '签到背景'
  return `外观预览：${item.name}（${kind}）\n${item.price} 积分｜${item.description}\n购买：「购买 ${item.name}」`
}

export interface ShopTile {
  item: CosmeticItem
  x: number
  y: number
  width: number
  height: number
}

export function shopCatalogColumns(slot: CosmeticSlot): number {
  return slot === 'title' ? 2 : 5
}

export function shopCatalogTiles(
  items: readonly CosmeticItem[],
  canvasWidth = 1280,
  canvasHeight = 720,
): ShopTile[] {
  if (!items.length) return []
  const columns = shopCatalogColumns(items[0].slot)
  const rows = Math.ceil(items.length / columns)
  const gap = 12
  const header = 72
  const footer = 44
  const areaWidth = canvasWidth - 64
  const areaHeight = canvasHeight - header - footer
  const rawWidth = Math.floor((areaWidth - gap * (columns - 1)) / columns)
  const rawHeight = Math.floor((areaHeight - gap * (rows - 1)) / rows)
  const width = items[0].slot === 'background' ? Math.min(240, rawWidth) : rawWidth
  const height = items[0].slot === 'background' ? Math.min(140, rawHeight) : rawHeight
  const startX = Math.floor((canvasWidth - (columns * width + (columns - 1) * gap)) / 2)
  const startY = header
  return items.map((item, index) => ({
    item,
    x: startX + (index % columns) * (width + gap),
    y: startY + Math.floor(index / columns) * (height + gap),
    width,
    height,
  }))
}

export function cosmeticThumbnailPath(file: string): string {
  const name = file.replace(/\.png$/i, '.jpg')
  const bundled = join(__dirname, 'assets', 'cosmetics', 'thumbs', name)
  const source = join(__dirname, '..', 'assets', 'cosmetics', 'thumbs', name)
  return existsSync(bundled) ? bundled : source
}

export async function loadCosmeticThumbnail(file: string): Promise<string | undefined> {
  try {
    const buffer = await readFile(cosmeticThumbnailPath(file))
    if (!buffer.length) return undefined
    return `data:image/jpeg;base64,${buffer.toString('base64')}`
  } catch {
    return loadCosmeticBackgroundFile(file)
  }
}

export function toCosmeticShopItems(): ShopItem[] {
  return COSMETICS.map((item) => ({
    id: item.id,
    name: item.name,
    aliases: item.aliases,
    price: item.price,
    description: item.description,
    effect: { type: 'cosmetic', itemId: item.id },
  }))
}
