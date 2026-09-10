import { describe, expect, it } from 'vitest'
import { match } from '../src/matcher'
import { normalize } from '../src/normalize'
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

  it('参数粘连无空格：切出命令与参数，且标记为需改写', () => {
    // 粘连写法 Koishi 自己解析不了，必须由中间件改写成 `遗物 后纪a2`，
    // 所以这里是 fuzzy 而非 exact —— exact 的语义是「原文可直接解析」。
    expect(match('遗物后纪a2', CANDIDATES)).toEqual({
      type: 'fuzzy', canonical: '遗物', rest: '后纪a2',
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

describe('match — 拼音模糊', () => {
  it('同音错字：钢铁裂逢 → 钢铁裂缝', () => {
    expect(match('钢铁裂逢', CANDIDATES)).toEqual({
      type: 'fuzzy', canonical: '钢铁裂缝', rest: '',
    })
  })

  it('繁体输入经归一化后同样命中', () => {
    // match 本身不做归一化，那是中间件的职责，所以测试里显式调用
    expect(match(normalize('遺物 後紀a2'), CANDIDATES)).toEqual({
      type: 'exact', canonical: '遗物', rest: '后纪a2',
    })
  })

  it('过短的候选不参与模糊，避免误伤聊天', () => {
    const short: Candidate[] = [{ canonical: '打', normalized: '打', command: 'x' }]
    expect(match('大', short)).toEqual({ type: 'none' })
  })

  it('纯 ASCII 别名不参与模糊，仅整词精确/前缀可命中', () => {
    const ascii: Candidate[] = [
      { canonical: 'hex', normalized: 'hex', command: 'bounty-hex' },
      { canonical: '1999', normalized: '1999', command: 'bounty-hex' },
      { canonical: '六人组', normalized: '六人组', command: 'bounty-hex' },
    ]
    expect(match('hez', ascii)).toEqual({ type: 'none' })
    expect(match('1998', ascii)).toEqual({ type: 'none' })
    expect(match('hex', ascii)).toEqual({
      type: 'exact', canonical: 'hex', rest: '',
    })
    expect(match('1999', ascii)).toEqual({
      type: 'exact', canonical: '1999', rest: '',
    })
    // 中文别名仍可拼音模糊
    expect(match('六人足', ascii)).toEqual({
      type: 'fuzzy', canonical: '六人组', rest: '',
    })
  })
})

describe('match — 编辑距离与歧义', () => {
  it('不将缺少动作前缀的普通名词误判为命令', () => {
    const actionCommands: Candidate[] = [
      { canonical: '蹲九重天', normalized: '蹲九重天', command: 'watch' },
      { canonical: '查九重天', normalized: '查九重天', command: 'watch-query' },
      { canonical: '删九重天', normalized: '删九重天', command: 'watch-remove' },
    ]

    expect(match('九重天', actionCommands)).toEqual({ type: 'none' })
  })

  it('九重天作为裂缝命令别名时优先精确匹配', () => {
    const candidates: Candidate[] = [
      { canonical: '九重天', normalized: '九重天', command: 'fissure-rj' },
      { canonical: '蹲九重天', normalized: '蹲九重天', command: 'watch' },
      { canonical: '查九重天', normalized: '查九重天', command: 'watch-query' },
      { canonical: '删九重天', normalized: '删九重天', command: 'watch-remove' },
    ]

    expect(match('九重天', candidates)).toEqual({
      type: 'exact', canonical: '九重天', rest: '',
    })
  })

  it('漏字：钢铁裂 → 钢铁裂缝', () => {
    expect(match('钢铁裂', CANDIDATES)).toEqual({
      type: 'fuzzy', canonical: '钢铁裂缝', rest: '',
    })
  })

  it('多个候选同分时返回歧义列表让用户选', () => {
    const twins: Candidate[] = [
      { canonical: '裂缝甲', normalized: '裂缝甲', command: 'a' },
      { canonical: '裂缝乙', normalized: '裂缝乙', command: 'b' },
    ]
    const result = match('裂缝丙', twins)
    expect(result.type).toBe('ambiguous')
    expect((result as any).canonical.sort()).toEqual(['裂缝乙', '裂缝甲'])
  })

  it('同一命令的多个别名同分不算歧义', () => {
    // 用四字别名：两字候选的容错阈值是 0，构造不出「同分」场景
    const aliases: Candidate[] = [
      { canonical: '钢铁裂缝', normalized: '钢铁裂缝', command: 'fissure-sp' },
      { canonical: '钢铁裂隙', normalized: '钢铁裂隙', command: 'fissure-sp' },
    ]
    expect(match('钢铁裂缶', aliases).type).toBe('fuzzy')
  })

  it('差太远仍返回 none', () => {
    expect(match('晚饭', CANDIDATES)).toEqual({ type: 'none' })
  })
})
