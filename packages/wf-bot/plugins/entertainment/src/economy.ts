export type ShopEffect =
  | { type: 'experience', value: number }
  | { type: 'ticket', value: number }
  | { type: 'inventory', itemId: 'power-booster' | 'battle-insurance', value: number }

export interface ShopItem {
  id: string
  name: string
  aliases: readonly string[]
  price: number
  description: string
  effect: ShopEffect
}

export const SHOP_ITEMS: readonly ShopItem[] = [
  {
    id: 'training-data',
    name: '训练数据',
    aliases: ['经验包', '训练'],
    price: 25,
    description: '立即获得 20 点经验。',
    effect: { type: 'experience', value: 20 },
  },
  {
    id: 'battle-ticket',
    name: '对战券',
    aliases: ['票', '挑战券'],
    price: 20,
    description: '补充 1 张对战券，上限仍为 3 张。',
    effect: { type: 'ticket', value: 1 },
  },
  {
    id: 'power-booster',
    name: '战术增幅器',
    aliases: ['增幅器', '战力药'],
    price: 40,
    description: '自动在下一场对战消耗，使本场战斗力 +6。',
    effect: { type: 'inventory', itemId: 'power-booster', value: 1 },
  },
  {
    id: 'battle-insurance',
    name: '护盾保险',
    aliases: ['保险', '护盾'],
    price: 35,
    description: '失败时自动消耗，使本场返还比例至少达到 30%。',
    effect: { type: 'inventory', itemId: 'battle-insurance', value: 1 },
  },
]

export const MAX_PURCHASE_QUANTITY = 5
export const MIN_GIFT_CREDITS = 5
export const MAX_DAILY_GIFT_CREDITS = 50

export function findShopItem(raw: string): ShopItem | undefined {
  const normalized = raw.trim().toLowerCase()
  return SHOP_ITEMS.find((item) =>
    item.id === normalized
    || item.name.toLowerCase() === normalized
    || item.aliases.some((alias) => alias.toLowerCase() === normalized))
}

export function discountedPrice(item: ShopItem, quantity: number, discountPercent = 0): number {
  const safeQuantity = Math.max(1, Math.min(MAX_PURCHASE_QUANTITY, Math.floor(quantity)))
  const discount = Math.max(0, Math.min(50, Math.floor(discountPercent)))
  return Math.max(1, Math.ceil(item.price * safeQuantity * (100 - discount) / 100))
}

export function calculateBattlePool(stake: number, refundPercent: number): {
  payout: number
  refund: number
  fee: number
} {
  const safeStake = Math.max(0, Math.floor(stake))
  const refundRate = Math.max(0, Math.min(50, Math.floor(refundPercent)))
  const grossPool = safeStake * 2
  const refund = Math.floor(safeStake * refundRate / 100)
  const baseFee = Math.floor(grossPool * 0.2)
  const fee = Math.min(baseFee, Math.max(0, grossPool - refund - (safeStake + 1)))
  return { payout: grossPool - refund - fee, refund, fee }
}

export function calculateChallengePool(
  stake: number,
  refundPercent: number,
  targetWon: boolean,
): {
  challengerStake: number
  targetStake: number
  payout: number
  refund: number
  fee: number
} {
  const challengerStake = Math.max(1, Math.floor(stake))
  const targetStake = Math.max(1, Math.floor(challengerStake / 2))
  const loserStake = targetWon ? challengerStake : targetStake
  const winnerStake = targetWon ? targetStake : challengerStake
  const refundRate = Math.max(0, Math.min(50, Math.floor(refundPercent)))
  const grossPool = challengerStake + targetStake
  const refund = Math.floor(loserStake * refundRate / 100)
  const baseFee = Math.floor(grossPool * 0.2)
  const feeBeforeTargetPenalty = Math.min(
    baseFee,
    Math.max(0, grossPool - refund - (winnerStake + 1)),
  )
  const fullPayout = grossPool - refund - feeBeforeTargetPenalty
  const payout = targetWon ? Math.max(1, Math.floor(fullPayout / 2)) : fullPayout
  return { challengerStake, targetStake, payout, refund, fee: grossPool - refund - payout }
}

export function renderShop(discountPercent = 0): string {
  const discount = discountPercent > 0 ? `\n今日奇遇折扣：${discountPercent}%（首次购买生效）` : ''
  return `积分商店${discount}\n`
    + SHOP_ITEMS.map((item) => `${item.name}｜${item.price} 积分｜${item.description}`).join('\n')
    + '\n购买方式：「购买 商品名 [数量]」'
}
