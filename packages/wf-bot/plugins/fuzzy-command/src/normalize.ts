import * as OpenCC from 'opencc-js'

const toSimplified = OpenCC.Converter({ from: 'tw', to: 'cn' })

/** 全角字符转半角，全角空格转普通空格 */
function toHalfWidth(input: string): string {
  return input
    .replace(/[！-～]/g, (ch) =>
      String.fromCharCode(ch.charCodeAt(0) - 0xFEE0))
    .replace(/　/g, ' ')
}

/**
 * 归一化：全角→半角、繁→简、去首尾空白、转小写。
 *
 * 注意不去除中间空白 —— `遗物 后纪a2` 的参数切分依赖它。
 */
export function normalize(input: string): string {
  return toSimplified(toHalfWidth(input)).trim().toLowerCase()
}
