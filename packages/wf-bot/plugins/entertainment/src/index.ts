import { Context, Schema } from 'koishi'
import { dateKey, getDailyFortune, renderFortune } from './fortune'
import { pickRandom, WARFRAMES, WEAPONS } from './items'

export const name = 'entertainment'

export interface Config {
  timeZone: string
}

export const Config: Schema<Config> = Schema.object({
  timeZone: Schema.string().default('Asia/Shanghai').description('今日运势使用的时区'),
})

function identifyUser(session?: { userId?: string }): string {
  // 私聊 session 也有 userId；极端情况下回退到固定值，避免命令抛错。
  return session?.userId || 'anonymous'
}

export function apply(ctx: Context, config: Config) {
  ctx.command('今日运势', '查看今天固定的个人运势')
    .alias('运势')
    .action(({ session }) => {
      const now = new Date()
      const today = dateKey(now, config.timeZone)
      const fortune = getDailyFortune(identifyUser(session), now, config.timeZone)
      return renderFortune(fortune, today)
    })

  ctx.command('随机战甲', '随机推荐一台 Warframe 战甲')
    .alias('随机甲')
    .action(() => `今日战甲推荐：${pickRandom(WARFRAMES)}`)

  ctx.command('随机武器', '随机推荐一件 Warframe 武器')
    .alias('随机枪', '随机装备')
    .action(() => `今日武器推荐：${pickRandom(WEAPONS)}`)
}

export { dateKey, getDailyFortune, hashSeed, renderFortune } from './fortune'
export { pickRandom, WARFRAMES, WEAPONS } from './items'
