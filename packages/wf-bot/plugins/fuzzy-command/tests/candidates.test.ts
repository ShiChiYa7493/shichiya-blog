import { describe, expect, it } from 'vitest'
import { collectCandidates } from '../src/candidates'

/** 只用到 $commander._commandList，用假对象即可，无需启动 Koishi */
function fakeCtx() {
  return {
    $commander: {
      _commandList: [
        { name: 'fissure', _aliases: { 'fissure': {}, '裂缝': {}, '裂隙': {} } },
        { name: 'fissure-sp', _aliases: { 'fissure-sp': {}, '钢铁裂缝': {} } },
      ],
    },
  } as any
}

describe('collectCandidates', () => {
  it('收集所有命令名与别名', () => {
    const names = collectCandidates(fakeCtx()).map((c) => c.canonical).sort()
    expect(names).toEqual(['fissure', 'fissure-sp', '裂隙', '裂缝', '钢铁裂缝'].sort())
  })

  it('记录每个候选归属的命令，用于消歧去重', () => {
    const found = collectCandidates(fakeCtx()).find((c) => c.canonical === '裂隙')
    expect(found?.command).toBe('fissure')
  })

  it('归一化文本随候选一起产出', () => {
    const found = collectCandidates(fakeCtx()).find((c) => c.canonical === 'fissure-sp')
    expect(found?.normalized).toBe('fissure-sp')
  })

  it('重复别名只保留一个', () => {
    const ctx = {
      $commander: {
        _commandList: [
          { name: 'a', _aliases: { 'a': {}, '裂缝': {} } },
          { name: 'b', _aliases: { 'b': {}, '裂缝': {} } },
        ],
      },
    } as any
    expect(collectCandidates(ctx).filter((c) => c.normalized === '裂缝')).toHaveLength(1)
  })

  it('按当前会话排除不可用的私聊维护命令', () => {
    const ctx = {
      $commander: {
        _commandList: [
          {
            name: 'wmu',
            _aliases: { wmu: {} },
            match: (session: any) => session.isDirect && session.userId === '1071342037',
          },
          {
            name: 'wmi',
            _aliases: { wmi: {}, '查价': {} },
            match: () => true,
          },
        ],
      },
    } as any

    const group = { isDirect: false, userId: '1071342037', resolve: () => undefined } as any
    const ownerPrivate = { isDirect: true, userId: '1071342037', resolve: () => undefined } as any

    expect(collectCandidates(ctx, group).map(c => c.canonical)).not.toContain('wmu')
    expect(collectCandidates(ctx, ownerPrivate).map(c => c.canonical)).toContain('wmu')
  })
})
