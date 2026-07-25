import { Context, Schema } from 'koishi'

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
  ctx.logger('fuzzy-command').info('已加载，maxInputLength=%d', config.maxInputLength)
}
