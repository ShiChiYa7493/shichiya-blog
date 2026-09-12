import { h, type Context, type Fragment } from 'koishi'
import type { Adventure } from './adventures'
import { BackgroundCache, pickBackground } from './backgrounds'
import {
  COSMETICS,
  findCosmetic,
  loadCosmeticBackgroundFile,
  loadCosmeticThumbnail,
  shopCatalogTiles,
  type CosmeticSlot,
} from './cosmetics'
import type { FortuneAxis } from './fortune'
import { escapeXml } from './xml'

interface ScreenshotPage {
  setViewport(options: { width: number, height: number, deviceScaleFactor: number }): Promise<void>
  setContent(content: string): Promise<void>
  screenshot(options: { type: 'png', clip: { x: number, y: number, width: number, height: number } }): Promise<Buffer>
  close(): Promise<void>
}

declare module 'koishi' {
  interface Context {
    /** Optional because the bot can still fall back to text when puppeteer is unavailable. */
    puppeteer?: { page(): Promise<ScreenshotPage> }
  }
}

export interface CheckinCardData {
  userId: string
  avatarUrl?: string
  date: string
  already: boolean
  gained: number
  randomReward: number
  streak: number
  credits: number
  level: number
  battlePower: number
  tickets: number
  adventure: Adventure
  adventureUsed: boolean
  fortuneLevel: string
  fortuneScore?: number
  fortuneText: string
  fortuneAxes?: readonly FortuneAxis[]
  fortuneAdvice?: string
  titleName?: string
  titleColor?: string
  frameId?: string
  backgroundFile?: string
  headline?: string
  subhead?: string
}

export interface BattleCardData {
  battleId: number
  challengerId: string
  targetId: string
  challengerAvatarUrl?: string
  targetAvatarUrl?: string
  challengerPower: number
  targetPower: number
  challengerAdventureBonus: number
  targetAdventureBonus: number
  challengerItemBonus: number
  targetItemBonus: number
  challengerAdventureId: string
  targetAdventureId: string
  winnerId: string
  challengerStake: number
  targetStake: number
  payout: number
  refund: number
  challengerExperience: number
  targetExperience: number
  challengerChance: number
  challengerMmrChange: number
  targetMmrChange: number
  backgroundUserId: string
  date: string
  challengerTitle?: string
  targetTitle?: string
  challengerTitleColor?: string
  targetTitleColor?: string
  challengerFrameId?: string
  targetFrameId?: string
}

export interface ShopCatalogCardData {
  category: CosmeticSlot
  discountPercent: number
  credits: number
  ownedIds: readonly string[]
}

export interface CardRendererOptions {
  width?: number
  height?: number
}

export class CardRenderer {
  private readonly width: number
  private readonly height: number

  constructor(
    private readonly ctx: Context,
    private readonly backgrounds: BackgroundCache,
    options: CardRendererOptions = {},
  ) {
    this.width = options.width ?? 1280
    this.height = options.height ?? 720
  }

  async checkin(data: CheckinCardData): Promise<Fragment | undefined> {
    const equipped = data.backgroundFile
      ? await loadCosmeticBackgroundFile(data.backgroundFile)
      : undefined
    const background = equipped
      ?? await this.backgrounds.get(pickBackground(data.userId, data.date, data.adventure.id))
    if (!background || !this.ctx.puppeteer) return undefined
    const svg = this.checkinSvg(data, background)
    return this.renderSvg(svg)
  }

  async battle(data: BattleCardData): Promise<Fragment | undefined> {
    const background = await this.backgrounds.get(pickBackground(data.backgroundUserId, data.date, [
      data.challengerAdventureId,
      data.targetAdventureId,
    ]))
    if (!background || !this.ctx.puppeteer) return undefined
    const svg = this.battleSvg(data, background)
    return this.renderSvg(svg)
  }

  async shop(data: ShopCatalogCardData): Promise<Fragment | undefined> {
    if (!this.ctx.puppeteer) return undefined
    const items = COSMETICS.filter((item) => item.slot === data.category)
    const thumbs = Object.fromEntries(
      (await Promise.all(items.map(async (item) => {
        if (!item.file) return
        const uri = await loadCosmeticThumbnail(item.file)
        return uri ? [item.id, uri] as const : undefined
      }))).filter((entry): entry is readonly [string, string] => Boolean(entry)),
    )
    return this.renderSvg(this.shopSvg(data, items, thumbs))
  }

  private async renderSvg(svg: string): Promise<Fragment | undefined> {
    try {
      const puppeteer = this.ctx.puppeteer
      if (!puppeteer) return undefined
      const page = await puppeteer.page()
      try {
        await page.setViewport({ width: this.width, height: this.height, deviceScaleFactor: 1 })
        await page.setContent(`<html><body style="margin:0;background:#071018">${svg}</body></html>`)
        const buffer = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: this.width, height: this.height } })
        return h.image(buffer, 'image/png')
      } finally {
        await page.close()
      }
    } catch {
      return undefined
    }
  }

  private checkinSvg(data: CheckinCardData, background: string): string {
    const adventureStatus = data.adventureUsed
      ? '今日奇遇已生效'
      : data.adventure.trigger === 'battle'
        ? '首次对战时生效'
        : data.adventure.trigger === 'shop' ? '首次购买时生效' : '签到时生效'
    const title = data.headline ?? (data.already ? '今日已签到' : '签到成功')
    const reward = data.subhead ?? (data.already ? '今日奖励已领取' : `+${data.gained} 积分`)
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${this.width}" height="${this.height}" viewBox="0 0 ${this.width} ${this.height}">
      <defs>
        <clipPath id="checkin-avatar"><circle cx="126" cy="112" r="48"/></clipPath>
      </defs>
      ${this.background(background)}
      ${this.themeFrame(data.adventure.id, data.frameId)}
      ${this.panel(34, 34, 778, 686, 'rgba(5,11,19,.84)')}
      ${this.avatar(data.avatarUrl, data.userId)}
      ${this.textLines('UID  ' + data.userId, 194, 88, 21, '#d8e8ed', 29, 360, 1, 700)}
      ${data.titleName ? this.text(`【${data.titleName}】`, 738, 88, 20, data.titleColor ?? '#ffcf69', 700, 'end') : ''}
      ${this.text(title, 194, 145, 46, data.already ? '#a6b8c0' : '#f5bd42', 800)}
      ${this.text(reward, 194, 186, 26, '#ffffff', 700)}
      ${this.line(74, 218, 738, 218)}
      ${this.sectionTitle('签到信息', 74, 260, 664)}
      ${this.badge('签到日期', data.date, 74, 304, 112)}
      ${this.badge('连续签到', `${data.streak} 天`, 408, 304, 112)}
      ${this.badge('当前积分', `${data.credits}`, 74, 354, 112)}
      ${this.badge('当前等级', `${data.level}`, 408, 354, 112)}
      ${this.badge('战斗力', `${data.battlePower}`, 74, 404, 112)}
      ${this.badge('对战券', `${data.tickets}`, 408, 404, 112)}
      ${this.panel(74, 448, 738, 650, 'rgba(17,30,42,.76)')}
      ${this.text('签到奇遇', 96, 482, 20, '#ffffff', 700)}
      ${this.textLines(data.adventure.title, 96, 525, 26, '#ffcf69', 32, 610, 1, 700)}
      ${this.textLines(adventureStatus, 96, 557, 17, '#a9c6d0', 24, 610, 1, 500)}
      ${this.textLines(data.adventure.description, 96, 594, 17, '#dce9ec', 25, 610, 2, 400)}
      ${this.panel(814, 34, 1246, 686, 'rgba(8,12,24,.93)')}
      ${this.text('TODAY FORTUNE', 856, 90, 18, '#9bb3c7', 700)}
      ${this.text('今日运势', 856, 155, 42, '#ffffff', 800)}
      ${this.text(`${data.fortuneLevel}${typeof data.fortuneScore === 'number' ? ` · ${data.fortuneScore}分` : ''}`, 1204, 155, 22, '#d6a3ff', 700, 'end')}
      ${this.line(856, 184, 1204, 184, '#7551a8')}
      ${this.radarChart(data.fortuneAxes ?? [], 1030, 363, 106)}
      ${this.textLines(data.fortuneText, 856, 552, 20, '#e8eef0', 30, 348, 2, 500)}
      ${data.fortuneAdvice ? this.textLines(`建议：${data.fortuneAdvice}`, 856, 615, 16, '#a9c6d0', 23, 348, 2, 400) : ''}
      ${this.textLines('六维结果由用户 ID 与日期固定生成', 856, 670, 14, '#8395a4', 20, 348, 1, 400)}
    </svg>`
  }

  private battleSvg(data: BattleCardData, background: string): string {
    const challengerColor = data.winnerId === data.challengerId ? '#f5bd42' : '#dce9ec'
    const targetColor = data.winnerId === data.targetId ? '#f5bd42' : '#dce9ec'
    const themeAdventureId = [data.challengerAdventureId, data.targetAdventureId].includes('lotus-gaze')
      ? 'lotus-gaze'
      : [data.challengerAdventureId, data.targetAdventureId].includes('void-echo') ? 'void-echo' : ''
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${this.width}" height="${this.height}" viewBox="0 0 ${this.width} ${this.height}">
      <defs>
        <clipPath id="battle-avatar-challenger"><circle cx="144" cy="357" r="39"/></clipPath>
        <clipPath id="battle-avatar-target"><circle cx="768" cy="357" r="39"/></clipPath>
      </defs>
      ${this.background(background)}
      ${this.themeFrame(themeAdventureId, data.challengerFrameId)}
      ${this.panel(34, 34, 1246, 686, 'rgba(5,11,19,.86)')}
      ${this.text(`对战 #${data.battleId}`, 76, 91, 22, '#a9c6d0', 700)}
      ${this.text('DUEL RESULT', 76, 137, 18, '#9bb3c7', 700)}
      ${this.text(data.winnerId === data.challengerId ? '发起方胜利' : '被挑战方胜利', 76, 202, 48, '#f5bd42', 800)}
      ${this.cardUser('发起方', data.challengerId, data.challengerAvatarUrl, data.challengerPower, data.challengerAdventureBonus, data.challengerItemBonus, data.challengerExperience, 76, 267, challengerColor, 'battle-avatar-challenger', data.challengerTitle, data.challengerTitleColor)}
      ${this.cardUser('被挑战方', data.targetId, data.targetAvatarUrl, data.targetPower, data.targetAdventureBonus, data.targetItemBonus, data.targetExperience, 700, 267, targetColor, 'battle-avatar-target', data.targetTitle, data.targetTitleColor)}
      ${this.text('VS', 614, 385, 42, '#d6a3ff', 800)}
      ${this.line(76, 507, 1190, 507)}
      ${this.badge('发起消耗', `${data.challengerStake}`, 76, 549)}
      ${this.badge('目标消耗', `${data.targetStake}`, 370, 549)}
      ${this.badge('胜者奖励', `+${data.payout}`, 664, 549)}
      ${this.badge('失败返还', `${data.refund}`, 958, 549)}
      ${this.text(`挑战者胜率 ${Math.round(data.challengerChance * 100)}%`, 76, 600, 17, '#a9c6d0', 500)}
      ${this.text(`MMR  ${data.challengerId} ${data.challengerMmrChange >= 0 ? '+' : ''}${data.challengerMmrChange}   ${data.targetId} ${data.targetMmrChange >= 0 ? '+' : ''}${data.targetMmrChange}`, 76, 646, 18, '#b9cbd1', 500)}
    </svg>`
  }

  private shopSvg(
    data: ShopCatalogCardData,
    items: typeof COSMETICS[number][],
    thumbs: Record<string, string>,
  ): string {
    const labels: Record<CosmeticSlot, string> = { title: '称号', frame: '边框', background: '背景' }
    const owned = new Set(data.ownedIds)
    const tiles = shopCatalogTiles(items)
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${this.width}" height="${this.height}" viewBox="0 0 ${this.width} ${this.height}">
      <rect width="100%" height="100%" fill="#071018"/>
      ${this.text(`积分商店｜${labels[data.category]}`, 48, 48, 32, '#ffffff', 800)}
      ${data.discountPercent > 0
        ? this.text(`今日奇遇八折 · 当前积分 ${data.credits}`, 48, 78, 16, '#d6a3ff', 500)
        : this.text(`当前积分 ${data.credits} · 预览「预览 名称」 · 购买「购买 名称」`, 48, 78, 16, '#a9c6d0', 500)}
      ${tiles.map((tile) => this.shopTile(tile.item, tile.x, tile.y, tile.width, tile.height, thumbs[tile.item.id], owned.has(tile.item.id))).join('')}
    </svg>`
  }

  private shopTile(
    item: typeof COSMETICS[number],
    x: number,
    y: number,
    width: number,
    height: number,
    thumb: string | undefined,
    owned: boolean,
  ): string {
    const clipId = `shop-${item.id}`
    const imageHeight = item.slot === 'background' ? height - 32 : height
    const frame = item.frame
    return `<defs><clipPath id="${clipId}"><rect x="${x}" y="${y}" width="${width}" height="${imageHeight}" rx="10"/></clipPath></defs>
      <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="12" fill="rgba(17,30,42,.92)" stroke="${owned ? '#f5bd42' : 'rgba(145,188,205,.28)'}" stroke-width="2"/>
      ${item.slot === 'background' && thumb
        ? `<image href="${thumb}" x="${x}" y="${y}" width="${width}" height="${imageHeight}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${clipId})"/>`
        : ''}
      ${item.slot === 'title'
        ? `${this.panel(x + 16, y + 18, x + width - 16, y + height - 42, 'rgba(8,12,24,.9)')}
           ${this.text(`【${item.name}】`, x + width / 2, y + height / 2 - 6, 26, item.titleColor ?? '#ffcf69', 800, 'middle')}`
        : ''}
      ${item.slot === 'frame' && frame
        ? `<rect x="${x + 18}" y="${y + 16}" width="${width - 36}" height="${height - 48}" rx="10" fill="none" stroke="${frame.stroke}" stroke-width="${Math.max(3, frame.strokeWidth)}"/>
           ${frame.innerStroke ? `<rect x="${x + 26}" y="${y + 24}" width="${width - 52}" height="${height - 64}" rx="8" fill="none" stroke="${frame.innerStroke}" stroke-width="2"/>` : ''}
           ${this.text(item.name, x + width / 2, y + height / 2, 16, '#dce9ec', 700, 'middle')}`
        : ''}
      ${this.text(`${item.name}  ${item.price}积分${owned ? '  已拥有' : ''}`, x + 10, y + height - 10, 13, owned ? '#f5bd42' : '#dce9ec', 600)}`
  }

  private cardUser(
    role: string,
    userId: string,
    avatarUrl: string | undefined,
    power: number,
    bonus: number,
    itemBonus: number,
    experience: number,
    x: number,
    y: number,
    color: string,
    clipId: string,
    title?: string,
    titleColor?: string,
  ): string {
    return `${this.panel(x, y, x + 460, y + 180, 'rgba(17,30,42,.88)')}
      ${this.avatarAt(avatarUrl, userId, x + 68, y + 90, 39, clipId)}
      ${this.text(role, x + 124, y + 29, 14, '#99b4bf', 600)}
      ${this.text(userId, x + 124, y + 57, 21, color, 700)}
      ${title ? this.text(`【${title}】`, x + 124, y + 80, 14, titleColor ?? '#ffcf69', 700) : ''}
      ${this.text(`${power}`, x + 124, y + 127, 50, '#ffffff', 800)}
      ${this.text(`奇遇 ${bonus >= 0 ? '+' : ''}${bonus}｜道具 +${itemBonus}`, x + 255, y + 86, 16, '#a9c6d0', 500)}
      ${this.text(`经验 +${experience}`, x + 255, y + 124, 17, '#dce9ec', 600)}`
  }

  private themeFrame(adventureId: string, frameId?: string): string {
    const theme = frameId ? findCosmetic(frameId)?.frame : undefined
    const parts: string[] = []
    if (theme) {
      parts.push(`<rect x="13" y="13" width="${this.width - 26}" height="${this.height - 26}" rx="24" fill="none" stroke="${theme.stroke}" stroke-width="${theme.strokeWidth}" opacity=".95"/>`)
      if (theme.innerStroke) {
        parts.push(`<rect x="22" y="22" width="${this.width - 44}" height="${this.height - 44}" rx="20" fill="none" stroke="${theme.innerStroke}" stroke-width="2" opacity=".9"/>`)
      }
    }
    const inset = theme ? 28 : 13
    const strokeWidth = theme ? 3 : 4
    if (adventureId === 'lotus-gaze') {
      parts.push(`<rect x="${inset}" y="${inset}" width="${this.width - inset * 2}" height="${this.height - inset * 2}" rx="18" fill="none" stroke="#d6a3ff" stroke-width="${strokeWidth}" opacity=".9"/>`)
    }
    if (adventureId === 'void-echo') {
      parts.push(`<rect x="${inset}" y="${inset}" width="${this.width - inset * 2}" height="${this.height - inset * 2}" rx="18" fill="none" stroke="#8fe7ef" stroke-width="${strokeWidth}" opacity=".9"/>`)
    }
    return parts.join('')
  }

  private background(dataUri: string): string {
    return `<image href="${dataUri}" x="0" y="0" width="${this.width}" height="${this.height}" preserveAspectRatio="xMidYMid slice"/><rect width="100%" height="100%" fill="rgba(4,10,16,.58)"/>`
  }

  private panel(x: number, y: number, right: number, bottom: number, fill: string): string {
    return `<rect x="${x}" y="${y}" width="${right - x}" height="${bottom - y}" rx="18" fill="${fill}" stroke="rgba(145,188,205,.28)" stroke-width="2"/>`
  }

  private avatar(avatarUrl: string | undefined, userId: string): string {
    return this.avatarAt(avatarUrl, userId, 126, 112, 48, 'checkin-avatar')
  }

  private avatarAt(
    avatarUrl: string | undefined,
    userId: string,
    cx: number,
    cy: number,
    radius: number,
    clipId: string,
  ): string {
    const safeUrl = avatarUrl && /^(?:https?:|data:image\/)/i.test(avatarUrl)
      ? escapeXml(avatarUrl)
      : ''
    const fallback = this.text(userId.slice(-2), cx, cy + radius * 0.25, radius * 0.54, '#dce9ec', 700, 'middle')
    return `<circle cx="${cx}" cy="${cy}" r="${radius + 3}" fill="rgba(17,30,42,.96)" stroke="#8fe7ef" stroke-width="3"/>
      ${fallback}
      ${safeUrl
        ? `<image href="${safeUrl}" x="${cx - radius}" y="${cy - radius}" width="${radius * 2}" height="${radius * 2}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${clipId})"/>`
        : ''}`
  }

  private radarChart(axes: readonly FortuneAxis[], cx: number, cy: number, radius: number): string {
    if (axes.length < 3) return ''
    const angle = (index: number) => -Math.PI / 2 + index * Math.PI / 3
    const point = (index: number, distance: number) => {
      const current = angle(index)
      return `${(cx + Math.cos(current) * distance).toFixed(1)},${(cy + Math.sin(current) * distance).toFixed(1)}`
    }
    const polygon = (distance: number) => Array.from({ length: 6 }, (_, index) => point(index, distance)).join(' ')
    const grid = [0.34, 0.67, 1].map((ratio) =>
      `<polygon points="${polygon(radius * ratio)}" fill="none" stroke="#315267" stroke-width="1.5" opacity=".9"/>`).join('')
    const spokes = Array.from({ length: 6 }, (_, index) =>
      `<line x1="${cx}" y1="${cy}" x2="${point(index, radius).split(',')[0]}" y2="${point(index, radius).split(',')[1]}" stroke="#315267" stroke-width="1" opacity=".8"/>`).join('')
    const values = axes.slice(0, 6).map((axis) => Math.max(0, Math.min(100, axis.value)))
    const valuePolygon = values.map((value, index) => point(index, radius * value / 100)).join(' ')
    const labels = axes.slice(0, 6).map((axis, index) => {
      const current = angle(index)
      const labelRadius = radius + 28
      const x = cx + Math.cos(current) * labelRadius
      const y = cy + Math.sin(current) * labelRadius
      const anchor = Math.abs(Math.cos(current)) < 0.2 ? 'middle' : Math.cos(current) > 0 ? 'start' : 'end'
      return this.text(`${axis.label} ${values[index]}`, x, y, 15, '#dce9ec', 600, anchor)
    }).join('')
    return `${grid}${spokes}<polygon points="${valuePolygon}" fill="rgba(143,231,239,.25)" stroke="#8fe7ef" stroke-width="3"/>${labels}`
  }

  private sectionTitle(value: string, x: number, y: number, width = 630): string {
    return `${this.text(value, x, y, 25, '#ffffff', 700)}${this.line(x, y + 14, x + width, y + 14, '#315267')}`
  }

  private badge(label: string, value: string, x: number, y: number, valueOffset = 160): string {
    return `${this.text(label, x, y, 16, '#99b4bf', 500)}${this.text(value, x + valueOffset, y, 21, '#ffffff', 700)}`
  }

  private text(value: string, x: number, y: number, size: number, fill: string, weight: number, anchor = 'start'): string {
    return `<text x="${x}" y="${y}" fill="${fill}" text-anchor="${anchor}" font-family="Arial, Noto Sans CJK SC, sans-serif" font-size="${size}px" font-weight="${weight}">${escapeXml(value)}</text>`
  }

  private textLines(
    value: string,
    x: number,
    y: number,
    size: number,
    fill: string,
    lineHeight: number,
    maxWidth: number,
    maxLines: number,
    weight = 500,
  ): string {
    const lines: string[] = []
    let current = ''
    let width = 0
    for (const character of value) {
      const characterWidth = /[\u0000-\u00ff]/.test(character) ? size * 0.58 : size
      if (current && width + characterWidth > maxWidth) {
        lines.push(current)
        current = character
        width = characterWidth
      } else {
        current += character
        width += characterWidth
      }
    }
    if (current || !lines.length) lines.push(current)
    const visible = lines.slice(0, maxLines)
    if (lines.length > maxLines && visible.length) {
      visible[visible.length - 1] = visible[visible.length - 1].replace(/.$/, '…')
    }
    return visible.map((line, index) =>
      this.text(line, x, y + index * lineHeight, size, fill, weight)).join('')
  }

  private line(x1: number, y1: number, x2: number, y2 = y1, stroke = '#466979'): string {
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="2" opacity=".8"/>`
  }
}
