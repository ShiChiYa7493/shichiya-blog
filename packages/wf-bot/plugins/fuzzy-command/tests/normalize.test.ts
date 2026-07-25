import { describe, expect, it } from 'vitest'
import { normalize } from '../src/normalize'

describe('normalize', () => {
  it('全角转半角并转小写', () => {
    expect(normalize('ＷＭ　猴ｐ')).toBe('wm 猴p')
  })

  it('繁体转简体', () => {
    expect(normalize('鋼鐵裂縫')).toBe('钢铁裂缝')
  })

  it('去掉首尾空白但保留中间空白（参数切分依赖它）', () => {
    expect(normalize('  遗物 后纪A2  ')).toBe('遗物 后纪a2')
  })

  it('空串安全', () => {
    expect(normalize('')).toBe('')
  })
})
