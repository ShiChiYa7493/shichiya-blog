import { h, type Context, type Fragment } from 'koishi'
import type { Adventure } from './adventures'
import { BackgroundCache, pickBackground } from './backgrounds'
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
  fortuneText: string
}

export interface BattleCardData {
  battleId: number
  challengerId: string
  targetId: string
  challengerPower: number
  targetPower: number
  challengerAdventureBonus: number
  targetAdventureBonus: number
  winnerId: string
  stake: number
  payout: number
  refund: number
  challengerChance: number
  challengerMmrChange: number
  targetMmrChange: number
  backgroundUserId: string
  date: string
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
    const background = await this.backgrounds.get(pickBackground(data.userId, data.date))
    if (!background || !this.ctx.puppeteer) return undefined
    const svg = this.checkinSvg(data, background)
    return this.renderSvg(svg)
  }

  async battle(data: BattleCardData): Promise<Fragment | undefined> {
    const background = await this.backgrounds.get(pickBackground(data.backgroundUserId, data.date))
    if (!background || !this.ctx.puppeteer) return undefined
    const svg = this.battleSvg(data, background)
    return this.renderSvg(svg)
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
    const adventureStatus = data.adventureUsed ? '今日奇遇已生效' : '首次对战时生效'
    const title = data.already ? '今日已签到' : '签到成功'
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${this.width}" height="${this.height}" viewBox="0 0 ${this.width} ${this.height}">
      ${this.background(background)}
      ${this.panel(34, 34, 736, 652, 'rgba(5,11,19,.84)')}
      ${this.text('UID  ' + data.userId, 74, 85, 24, '#d8e8ed', 700)}
      ${this.text(title, 74, 148, 52, data.already ? '#a6b8c0' : '#f5bd42', 800)}
      ${this.text(data.already ? '今日奖励已领取' : `+${data.gained} 积分`, 76, 203, 34, '#ffffff', 700)}
      ${this.line(74, 235, 704, 235)}
      ${this.sectionTitle('签到信息', 74, 282)}
      ${this.badge('签到日期', data.date, 74, 322)}
      ${this.badge('连续签到', `${data.streak} 天`, 74, 374)}
      ${this.badge('当前积分', `${data.credits}`, 74, 426)}
      ${this.badge('战斗力', `${data.battlePower}`, 74, 478)}
      ${this.badge('对战券', `${data.tickets}`, 74, 530)}
      ${this.sectionTitle('签到奇遇', 74, 591)}
      ${this.text(data.adventure.title, 88, 628, 27, '#ffcf69', 700)}
      ${this.text(adventureStatus, 315, 628, 18, '#a9c6d0', 500)}
      ${this.text(data.adventure.description, 88, 659, 17, '#dce9ec', 400)}
      ${this.panel(806, 34, 1246, 686, 'rgba(8,12,24,.93)')}
      ${this.text('TODAY FORTUNE', 856, 90, 18, '#9bb3c7', 700)}
      ${this.text('今日运势', 856, 155, 46, '#ffffff', 800)}
      ${this.text(data.fortuneLevel, 856, 239, 70, '#d6a3ff', 800)}
      ${this.line(856, 270, 1196, 270, '#7551a8')}
      ${this.textLines(data.fortuneText, 856, 327, 24, '#e8eef0', 38, 3)}
      ${this.text('每日结果由用户 ID 与日期固定生成', 856, 622, 16, '#8395a4', 400)}
    </svg>`
  }

  private battleSvg(data: BattleCardData, background: string): string {
    const challengerColor = data.winnerId === data.challengerId ? '#f5bd42' : '#dce9ec'
    const targetColor = data.winnerId === data.targetId ? '#f5bd42' : '#dce9ec'
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${this.width}" height="${this.height}" viewBox="0 0 ${this.width} ${this.height}">
      ${this.background(background)}
      ${this.panel(34, 34, 1246, 686, 'rgba(5,11,19,.86)')}
      ${this.text(`对战 #${data.battleId}`, 76, 91, 22, '#a9c6d0', 700)}
      ${this.text('DUEL RESULT', 76, 137, 18, '#9bb3c7', 700)}
      ${this.text(data.winnerId === data.challengerId ? '挑战者胜利' : '目标胜利', 76, 202, 48, '#f5bd42', 800)}
      ${this.cardUser(data.challengerId, data.challengerPower, data.challengerAdventureBonus, 76, 267, challengerColor)}
      ${this.cardUser(data.targetId, data.targetPower, data.targetAdventureBonus, 700, 267, targetColor)}
      ${this.text('VS', 614, 385, 42, '#d6a3ff', 800)}
      ${this.line(76, 507, 1190, 507)}
      ${this.badge('积分消耗', `${data.stake} / 人`, 76, 549)}
      ${this.badge('胜者奖池', `+${data.payout}`, 370, 549)}
      ${this.badge('失败返还', `${data.refund}`, 664, 549)}
      ${this.badge('挑战者胜率', `${Math.round(data.challengerChance * 100)}%`, 958, 549)}
      ${this.text(`MMR  ${data.challengerId} ${data.challengerMmrChange >= 0 ? '+' : ''}${data.challengerMmrChange}   ${data.targetId} ${data.targetMmrChange >= 0 ? '+' : ''}${data.targetMmrChange}`, 76, 646, 18, '#b9cbd1', 500)}
    </svg>`
  }

  private cardUser(userId: string, power: number, bonus: number, x: number, y: number, color: string): string {
    return `${this.panel(x, y, x + 460, y + 180, 'rgba(17,30,42,.88)')}
      ${this.text(userId, x + 24, y + 51, 25, color, 700)}
      ${this.text(`${power}`, x + 24, y + 119, 52, '#ffffff', 800)}
      ${this.text(`奇遇 ${bonus >= 0 ? '+' : ''}${bonus}`, x + 190, y + 111, 20, '#a9c6d0', 500)}`
  }

  private background(dataUri: string): string {
    return `<image href="${dataUri}" x="0" y="0" width="${this.width}" height="${this.height}" preserveAspectRatio="xMidYMid slice"/><rect width="100%" height="100%" fill="rgba(4,10,16,.58)"/>`
  }

  private panel(x: number, y: number, right: number, bottom: number, fill: string): string {
    return `<rect x="${x}" y="${y}" width="${right - x}" height="${bottom - y}" rx="18" fill="${fill}" stroke="rgba(145,188,205,.28)" stroke-width="2"/>`
  }

  private sectionTitle(value: string, x: number, y: number): string {
    return `${this.text(value, x, y, 25, '#ffffff', 700)}${this.line(x, y + 14, x + 630, y + 14, '#315267')}`
  }

  private badge(label: string, value: string, x: number, y: number): string {
    return `${this.text(label, x, y, 16, '#99b4bf', 500)}${this.text(value, x + 160, y, 21, '#ffffff', 700)}`
  }

  private text(value: string, x: number, y: number, size: number, fill: string, weight: number): string {
    return `<text x="${x}" y="${y}" fill="${fill}" font-family="Arial, Noto Sans CJK SC, sans-serif" font-size="${size}px" font-weight="${weight}">${escapeXml(value)}</text>`
  }

  private textLines(value: string, x: number, y: number, size: number, fill: string, lineHeight: number, maxLines: number): string {
    const words = value.match(/.{1,18}/g) ?? [value]
    return words.slice(0, maxLines).map((line, index) => this.text(line, x, y + index * lineHeight, size, fill, 500)).join('')
  }

  private line(x1: number, y1: number, x2: number, y2 = y1, stroke = '#466979'): string {
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="2" opacity=".8"/>`
  }
}
