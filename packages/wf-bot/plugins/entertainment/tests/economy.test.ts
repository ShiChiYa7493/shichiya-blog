import { describe, expect, it } from 'vitest'
import {
  calculateBattlePool,
  calculateChallengePool,
  discountedPrice,
  findShopItem,
  renderShop,
  SHOP_ITEMS,
} from '../src/economy'

describe('credit shop', () => {
  it('resolves product names and aliases', () => {
    expect(findShopItem('战术增幅器')?.id).toBe('power-booster')
    expect(findShopItem('保险')?.id).toBe('battle-insurance')
    expect(findShopItem('不存在')).toBeUndefined()
  })

  it('applies the daily adventure discount to a whole purchase', () => {
    const item = findShopItem('训练数据')!
    expect(discountedPrice(item, 2)).toBe(50)
    expect(discountedPrice(item, 2, 20)).toBe(40)
  })

  it('renders every catalog item', () => {
    const output = renderShop(20)
    expect(SHOP_ITEMS.every((item) => output.includes(item.name))).toBe(true)
    expect(output).toContain('20%')
  })

  it('keeps refunds inside the player-funded battle pool', () => {
    expect(calculateBattlePool(10, 0)).toEqual({ payout: 16, refund: 0, fee: 4 })
    expect(calculateBattlePool(10, 50)).toEqual({ payout: 11, refund: 5, fee: 4 })
    const protectedPool = calculateBattlePool(5, 50)
    expect(protectedPool.payout).toBeGreaterThan(5)
    expect(protectedPool.payout + protectedPool.refund + protectedPool.fee).toBe(10)
  })

  it('halves the challenged users stake and winning payout', () => {
    expect(calculateChallengePool(10, 0, false)).toEqual({
      challengerStake: 10, targetStake: 5, payout: 12, refund: 0, fee: 3,
    })
    expect(calculateChallengePool(10, 0, true)).toEqual({
      challengerStake: 10, targetStake: 5, payout: 6, refund: 0, fee: 9,
    })
    expect(calculateChallengePool(5, 0, false).targetStake).toBe(2)
  })
})
