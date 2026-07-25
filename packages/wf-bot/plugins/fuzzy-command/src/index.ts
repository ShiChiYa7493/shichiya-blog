import { Context, Schema } from 'koishi'
import { type Candidate, collectCandidates } from './candidates'
import { match } from './matcher'
import { normalize } from './normalize'

export const name = 'fuzzy-command'

export interface Config {
  maxInputLength: number
  minFuzzyLength: number
}

export const Config: Schema<Config> = Schema.object({
  maxInputLength: Schema.number().default(12)
    .description('超过该字数的消息不做模糊匹配（显然是聊天不是命令）'),
  minFuzzyLength: Schema.number().default(2)
    .description('参与模糊匹配的最短命令名长度，过短会误伤正常聊天'),
})

export function apply(ctx: Context, config: Config) {
  const logger = ctx.logger('fuzzy-command')

  // 命令表在启动期注册完毕，缓存避免每条消息重复遍历；
  // 数量变化时重建，兼容插件热重载。
  let cache: Candidate[] = []
  let cachedSize = -1

  function candidates() {
    const size = ctx.$commander._commandList.length
    if (size !== cachedSize) {
      cache = collectCandidates(ctx)
      cachedSize = size
    }
    return cache
  }

  // 第二个参数 true 表示前置中间件，必须早于 Koishi 的命令解析
  ctx.middleware(async (session, next) => {
    const raw = session.content?.trim()
    if (!raw) return next()

    const result = match(normalize(raw), candidates(), config)

    switch (result.type) {
      case 'fuzzy':
        session.content = result.rest
          ? `${result.canonical} ${result.rest}`
          : result.canonical
        logger.debug('改写 %s → %s', raw, session.content)
        return next()

      case 'ambiguous':
        return session.send(
          `没认出「${raw}」，你是指：`
          + result.canonical.map((name, i) => `${i + 1}. ${name}`).join('   '),
        )

      // exact 交给 Koishi 原生解析；none 静默放行，绝不打扰正常聊天
      default:
        return next()
    }
  }, true)

  logger.info('已加载，maxInputLength=%d', config.maxInputLength)
}
