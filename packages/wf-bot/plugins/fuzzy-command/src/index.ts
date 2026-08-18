import { Context, Schema } from 'koishi'
import { collectCandidates } from './candidates'
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

  // 第二个参数 true 表示前置中间件，必须早于 Koishi 的命令解析
  ctx.middleware(async (session, next) => {
    const raw = session.content?.trim()
    if (!raw) return next()

    // 命令可按群聊、私聊或用户过滤；候选必须随当前会话重新筛选，
    // 否则受限维护命令也会在普通群聊里参与拼音模糊匹配。
    const result = match(normalize(raw), collectCandidates(ctx, session), config)

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
