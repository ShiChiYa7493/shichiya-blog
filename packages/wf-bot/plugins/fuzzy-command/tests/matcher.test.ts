import { describe, expect, it } from 'vitest'
import { match } from '../src/matcher'
import type { Candidate } from '../src/candidates'

const CANDIDATES: Candidate[] = [
  { canonical: '裂缝', normalized: '裂缝', command: 'fissure' },
  { canonical: '钢铁裂缝', normalized: '钢铁裂缝', command: 'fissure-sp' },
  { canonical: '遗物', normalized: '遗物', command: 'relic' },
  { canonical: 'wmi', normalized: 'wmi', command: 'wmi' },
]

describe('match — 精确与切分', () => {
  it('完全相同视为精确命中，交给 Koishi 原生解析', () => {
    expect(match('钢铁裂缝', CANDIDATES)).toEqual({
      type: 'exact', canonical: '钢铁裂缝', rest: '',
    })
  })

  it('带空格参数：切出命令与参数', () => {
    expect(match('遗物 后纪a2', CANDIDATES)).toEqual({
      type: 'exact', canonical: '遗物', rest: '后纪a2',
    })
  })

  it('参数粘连无空格：仍能切出命令与参数', () => {
    expect(match('遗物后纪a2', CANDIDATES)).toEqual({
      type: 'exact', canonical: '遗物', rest: '后纪a2',
    })
  })

  it('前缀切分取最长候选，避免 裂缝 抢走 钢铁裂缝', () => {
    expect(match('钢铁裂缝', CANDIDATES)).toEqual({
      type: 'exact', canonical: '钢铁裂缝', rest: '',
    })
  })

  it('超长消息直接放弃，正常聊天不被打扰', () => {
    expect(match('今天钢铁裂缝刷了半天什么都没出气死我了真的', CANDIDATES))
      .toEqual({ type: 'none' })
  })

  it('完全无关的消息返回 none', () => {
    expect(match('晚上吃什么', CANDIDATES)).toEqual({ type: 'none' })
  })

  it('以命令名开头的正常聊天不被误判为命令', () => {
    // `遗物是什么` 以候选 `遗物` 开头，但后面不是参数而是聊天内容。
    // 真实参数形态必含字母数字（后纪a2 / 前纪b3），聊天不会。
    expect(match('遗物是什么', CANDIDATES)).toEqual({ type: 'none' })
  })
})
