import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { SHOP_ITEMS } from '../src/economy'
import {
  BACKGROUND_PRICE,
  COSMETICS,
  DEFAULT_EQUIP_ALIASES,
  applyEquip,
  cosmeticBackgroundDirectory,
  cosmeticThumbnailPath,
  defaultLoadout,
  findCosmetic,
  parseEquipTarget,
  parseShopCategory,
  previewAppearance,
  renderPreviewText,
  shopCatalogTiles,
  splitPurchaseInput,
  renderCosmeticBag,
  renderShopCatalog,
} from '../src/cosmetics'

describe('cosmetic catalog', () => {
  it('provides ten titles, ten frames and twenty backgrounds', () => {
    const titles = COSMETICS.filter((item) => item.slot === 'title')
    const frames = COSMETICS.filter((item) => item.slot === 'frame')
    const backgrounds = COSMETICS.filter((item) => item.slot === 'background')
    expect(titles).toHaveLength(10)
    expect(frames).toHaveLength(10)
    expect(backgrounds).toHaveLength(20)
    expect(backgrounds.filter((item) => item.theme === 'warframe')).toHaveLength(10)
    expect(backgrounds.filter((item) => item.theme === 'girl')).toHaveLength(10)
    expect(new Set(COSMETICS.map((item) => item.id)).size).toBe(40)
    expect(new Set(backgrounds.map((item) => item.price))).toEqual(new Set([BACKGROUND_PRICE]))
    expect(BACKGROUND_PRICE).toBe(200)
  })

  it('resolves cosmetic names, aliases and default unequip targets', () => {
    expect(findCosmetic('Tenno')?.id).toBe('title-tenno')
    expect(findCosmetic('虚空青辉')?.id).toBe('frame-void')
    expect(findCosmetic('天台晚风少女')?.id).toBe('bg-rooftop-girl')
    expect(findCosmetic('不存在')).toBeUndefined()
    expect(parseEquipTarget('默认边框')).toEqual({ type: 'default', slot: 'frame' })
    expect(parseEquipTarget('银质细框')).toEqual({ type: 'item', query: '银质细框' })
    expect(DEFAULT_EQUIP_ALIASES.默认称号).toBe('title')
    expect(splitPurchaseInput('Orokin 金殿')).toEqual({ query: 'Orokin 金殿', quantity: 1 })
    expect(splitPurchaseInput('训练数据 2')).toEqual({ query: '训练数据', quantity: 2 })
  })

  it('keeps a local image for every shop background', () => {
    const directory = cosmeticBackgroundDirectory()
    for (const item of COSMETICS.filter((cosmetic) => cosmetic.slot === 'background')) {
      expect(existsSync(join(directory, item.file!)), item.file).toBe(true)
      expect(existsSync(cosmeticThumbnailPath(item.file!)), item.file).toBe(true)
    }
  })
})

describe('cosmetic shop and bag text', () => {
  it('summarizes categories and lists a requested section', () => {
    const summary = renderShopCatalog(undefined, 20, new Set(), SHOP_ITEMS)
    expect(summary).toContain('今日奇遇折扣：20%')
    expect(summary).toContain('积分商店 称号')
    expect(summary).toContain('积分商店 背景')
    expect(summary).toContain('训练数据')
    expect(summary).not.toContain('传奇战士｜')

    const titles = renderShopCatalog('title', 0, new Set(['title-tenno']), SHOP_ITEMS)
    expect(titles).toContain('Tenno')
    expect(titles).toContain('已拥有')
    expect(titles).not.toContain('银质细框')
    expect(parseShopCategory('背景')).toBe('background')
    expect(parseShopCategory('皮肤')).toBeUndefined()
  })

  it('renders owned cosmetics in the bag with equipped marks', () => {
    const loadout = applyEquip(defaultLoadout('g1', 'u1'), findCosmetic('Tenno')!)
    const bag = renderCosmeticBag([
      findCosmetic('Tenno')!,
      findCosmetic('银质细框')!,
    ], loadout)
    expect(bag).toContain('Tenno（已装备）')
    expect(bag).toContain('银质细框')
    expect(bag).not.toContain('银质细框（已装备）')
  })

  it('builds a shop preview from a single cosmetic without mixing other slots', () => {
    expect(renderShopCatalog('background', 0, new Set(), SHOP_ITEMS)).toContain('预览 商品名')
    expect(previewAppearance(findCosmetic('Tenno')!)).toEqual({
      titleName: 'Tenno',
      titleColor: '#f5bd42',
      frameId: undefined,
      backgroundFile: undefined,
    })
    expect(previewAppearance(findCosmetic('虚空青辉')!).frameId).toBe('frame-void')
    expect(previewAppearance(findCosmetic('天台晚风少女')!).backgroundFile).toBe('bg-rooftop-girl.png')
    expect(renderPreviewText(findCosmetic('Tenno')!)).toContain('购买 Tenno')
  })

  it('lays out shop thumbnails in a compressed catalog grid', () => {
    const backgrounds = shopCatalogTiles(COSMETICS.filter((item) => item.slot === 'background'))
    expect(backgrounds).toHaveLength(20)
    expect(backgrounds[0]?.width).toBeLessThanOrEqual(240)
    expect(backgrounds[0]?.height).toBeLessThanOrEqual(140)
    expect(new Set(backgrounds.map((tile) => `${tile.x},${tile.y}`)).size).toBe(20)

    const titles = shopCatalogTiles(COSMETICS.filter((item) => item.slot === 'title'))
    expect(titles).toHaveLength(10)
    expect(titles[0]?.width).toBeGreaterThan(400)
  })
})
