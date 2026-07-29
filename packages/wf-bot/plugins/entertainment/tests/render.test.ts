import { describe, expect, it } from 'vitest'
import { escapeXml } from '../src/xml'

describe('card rendering fallbacks', () => {
  it('escapes user-controlled SVG text', () => {
    expect(escapeXml(`<u&"'>`)).toBe('&lt;u&amp;&quot;&apos;&gt;')
  })
})
