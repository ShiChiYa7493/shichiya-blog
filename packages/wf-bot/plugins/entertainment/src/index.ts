import { Context, Schema, type Session } from 'koishi'
import { join } from 'node:path'
import { getAdventure, pickDailyAdventure, renderAdventure } from './adventures'
import {
  MAX_DAILY_BATTLES,
  MAX_STAKE,
  MIN_STAKE,
  addExperience,
  applyCheckin,
  applyCheckinAdventure,
  baseCombatPower,
  calculateBattlePower,
  effectValue,
  formatPowerBreakdown,
  resetDailyBattleCount,
  resolveBattle,
  updateMmr,
  type ProfileState,
} from './game'
import { dateKey, getDailyFortune, hashSeed, renderFortune } from './fortune'
import { pickRandom, WARFRAMES, WEAPONS } from './items'
import { BackgroundCache } from './backgrounds'
import { CardRenderer, type BattleCardData, type CheckinCardData } from './render'
import { EntertainmentStore, extendModels } from './storage'

export const name = 'entertainment'
export const inject = ['database']

export interface Config {
  timeZone: string
  defaultStake: number
  inviteTimeoutSeconds: number
  maxMmrGap: number
  maxPowerGapRatio: number
  renderImages: boolean
  backgroundCacheDir: string
}

export const Config: Schema<Config> = Schema.object({
  timeZone: Schema.string().default('Asia/Shanghai').description('每日签到与运势使用的时区'),
  defaultStake: Schema.number().min(MIN_STAKE).max(MAX_STAKE).default(10)
    .description('发起挑战时未填写积分消耗所使用的默认值'),
  inviteTimeoutSeconds: Schema.number().min(30).max(300).default(90)
    .description('挑战邀请有效时间（秒）'),
  maxMmrGap: Schema.number().min(50).max(500).default(200)
    .description('允许手动挑战的最大 MMR 差距'),
  maxPowerGapRatio: Schema.number().min(0.1).max(1).step(0.05).default(0.3)
    .description('允许手动挑战的最大基础战力差比例'),
  renderImages: Schema.boolean().default(true).description('签到和对战是否尝试渲染图片'),
  backgroundCacheDir: Schema.string().default('data/entertainment-backgrounds')
    .description('Warframe 官方 Public Export 背景图本地缓存目录'),
})

interface Identity {
  guildId: string
  userId: string
}

function identify(session?: Session): Identity | string {
  if (!session?.guildId) return '该功能仅支持群聊。'
  if (!session.userId) return '无法识别你的用户账号。'
  return { guildId: session.guildId, userId: session.userId }
}

function targetFromSession(session?: Session, raw?: string): string | undefined {
  const mention = session?.elements?.find((element) =>
    element.type === 'at' && String(element.attrs?.id) !== session.selfId)
  const mentionId = mention?.attrs?.id
  if (mentionId) return String(mentionId)
  const normalized = raw?.trim().replace(/^@/, '')
  return normalized || undefined
}

function activeAdventure(profile: ProfileState, today: string) {
  if (profile.dailyDate !== today || profile.dailyAdventureUsed) return undefined
  const adventure = getAdventure(profile.dailyAdventureId)
  return adventure?.trigger === 'battle' ? adventure : undefined
}

function battleLimitMessage(profile: ProfileState): string | undefined {
  if (profile.battleCount >= MAX_DAILY_BATTLES) return `你今天已经完成 ${MAX_DAILY_BATTLES} 场对战了。`
  if (profile.tickets <= 0) return '你没有可用的对战券，请明天签到后再来。'
}

export function apply(ctx: Context, config: Config) {
  extendModels(ctx)
  const store = new EntertainmentStore(ctx)
  const renderer = new CardRenderer(
    ctx,
    new BackgroundCache(join(process.cwd(), config.backgroundCacheDir)),
  )

  async function renderOrText<T extends CheckinCardData | BattleCardData>(
    data: T,
    text: string,
  ) {
    if (!config.renderImages) return text
    const image = 'adventure' in data
      ? await renderer.checkin(data)
      : await renderer.battle(data)
    return image ?? text
  }

  async function createChallenge(identity: Identity, targetId: string, rawStake?: number): Promise<string> {
    if (identity.userId === targetId) return '不能挑战自己。'
    const today = dateKey(new Date(), config.timeZone)
    const stake = Math.floor(rawStake ?? config.defaultStake)
    if (stake < MIN_STAKE || stake > MAX_STAKE) {
      return `每次挑战消耗必须在 ${MIN_STAKE}～${MAX_STAKE} 积分之间。`
    }

    const [challenger, target] = await Promise.all([
      store.getProfile(identity.guildId, identity.userId),
      store.getProfile(identity.guildId, targetId),
    ])
    resetDailyBattleCount(challenger, today)
    resetDailyBattleCount(target, today)

    if (challenger.dailyDate !== today) return '请先签到，再发起挑战。'
    if (target.dailyDate !== today) return '对方今天尚未签到，暂时不能参与对战。'
    const challengerLimit = battleLimitMessage(challenger)
    if (challengerLimit) return challengerLimit
    const targetLimit = battleLimitMessage(target)
    if (targetLimit) return `对方暂时不能接受挑战：${targetLimit}`
    if (challenger.credits < stake) return `你的积分不足，需要至少 ${stake} 积分。`
    if (target.credits < stake) return `对方积分不足 ${stake}，无法接受这次挑战。`
    if (Math.abs(challenger.mmr - target.mmr) > config.maxMmrGap) {
      return `双方 MMR 差距超过 ${config.maxMmrGap}，请寻找水平更接近的对手。`
    }

    const challengerPower = baseCombatPower(challenger)
    const targetPower = baseCombatPower(target)
    const gapRatio = Math.abs(challengerPower - targetPower) / Math.max(challengerPower, targetPower)
    if (gapRatio > config.maxPowerGapRatio) {
      return `双方基础战力差距超过 ${Math.round(config.maxPowerGapRatio * 100)}%，不能发起挑战。`
    }
    if (await store.hasRewardedPairBattle(identity.guildId, identity.userId, targetId, today)) {
      return '你们今天已经完成过一场有效对战，请换一个对手。'
    }

    const now = new Date()
    const pending = await store.findPendingFromChallenger(identity.guildId, identity.userId, now)
    if (pending) {
      return `你已经发出了等待处理的挑战 #${pending.id}，请等待对方接受或邀请过期。`
    }
    const battle = await store.createBattle({
      guildId: identity.guildId,
      challengerId: identity.userId,
      targetId,
      status: 'pending',
      stake,
      createdAt: now,
      expiresAt: new Date(now.getTime() + config.inviteTimeoutSeconds * 1000),
      completedDate: '',
      challengerPower: 0,
      targetPower: 0,
      challengerChance: 0,
      roll: 0,
      winnerId: '',
      challengerAdventureId: '',
      targetAdventureId: '',
      mmrChange: 0,
    })
    return `挑战 #${battle.id} 已发出：${identity.userId} → ${targetId}\n`
      + `双方各消耗 ${stake} 积分，对方请在 ${config.inviteTimeoutSeconds} 秒内发送「接受挑战」。`
  }

  ctx.command('今日运势', '查看今天固定的个人运势')
    .alias('运势')
    .action(({ session }) => {
      const now = new Date()
      const today = dateKey(now, config.timeZone)
      const fortune = getDailyFortune(session?.userId || 'anonymous', now, config.timeZone)
      return renderFortune(fortune, today)
    })

  ctx.command('随机战甲', '随机推荐一台 Warframe 战甲')
    .alias('随机甲')
    .action(() => `今日战甲推荐：${pickRandom(WARFRAMES)}`)

  ctx.command('随机武器', '随机推荐一件 Warframe 武器')
    .alias('随机枪', '随机装备')
    .action(() => `今日武器推荐：${pickRandom(WEAPONS)}`)

  ctx.command('签到', '每日签到，获得积分、经验、对战券和今日奇遇')
    .action(async ({ session }) => {
      const identity = identify(session)
      if (typeof identity === 'string') return identity
      const now = new Date()
      const today = dateKey(now, config.timeZone)
      const profile = await store.getProfile(identity.guildId, identity.userId)
      const adventure = pickDailyAdventure(identity.userId, today)
      const randomReward = hashSeed(`${identity.userId}:checkin:${today}`) % 11
      const result = applyCheckin(profile, today, randomReward, adventure.id)
      if (result.already) {
        const current = getAdventure(profile.dailyAdventureId)
        const fortune = getDailyFortune(identity.userId, now, config.timeZone)
        const text = `今天已经签到过了。\n积分：${profile.credits}｜连签：${profile.streak} 天｜战斗力：${baseCombatPower(profile)}\n`
          + (current ? renderAdventure(current, profile.dailyAdventureUsed) : '')
        if (!current) return text
        return renderOrText({
          userId: identity.userId,
          date: today,
          already: true,
          gained: 0,
          randomReward: profile.dailyRandom,
          streak: profile.streak,
          credits: profile.credits,
          level: profile.level,
          battlePower: baseCombatPower(profile),
          tickets: profile.tickets,
          adventure: current,
          adventureUsed: profile.dailyAdventureUsed,
          fortuneLevel: fortune.level,
          fortuneText: fortune.text,
        }, text)
      }

      const instant = applyCheckinAdventure(profile, adventure)
      await store.saveProfile(profile)
      const instantParts = [
        instant.credits ? `额外积分 +${instant.credits}` : '',
        instant.experience ? `额外经验 +${instant.experience}` : '',
        instant.tickets ? `额外对战券 +${instant.tickets}` : '',
      ].filter(Boolean).join('，')

      const text = `签到成功｜${today}\n`
        + `积分：10 + 随机 ${result.random} + 连签 ${result.streakBonus} = +${result.total}\n`
        + `当前积分：${profile.credits}｜连续签到：${profile.streak} 天｜等级：${profile.level}\n`
        + `对战券：${profile.tickets}｜基础战斗力：${baseCombatPower(profile)}\n`
        + `${renderAdventure(adventure, profile.dailyAdventureUsed)}`
        + (instantParts ? `\n奇遇收益：${instantParts}` : '')
        + (result.levelUp || instant.levelUp ? '\n等级提升了！' : '')
      const fortune = getDailyFortune(identity.userId, now, config.timeZone)
      return renderOrText({
        userId: identity.userId,
        date: today,
        already: false,
        gained: result.total,
        randomReward: result.random,
        streak: profile.streak,
        credits: profile.credits,
        level: profile.level,
        battlePower: baseCombatPower(profile),
        tickets: profile.tickets,
        adventure,
        adventureUsed: profile.dailyAdventureUsed,
        fortuneLevel: fortune.level,
        fortuneText: fortune.text,
      }, text)
    })

  ctx.command('我的资料', '查看积分、等级、战斗力和战绩')
    .alias('积分', '战斗力', '战力')
    .action(async ({ session }) => {
      const identity = identify(session)
      if (typeof identity === 'string') return identity
      const today = dateKey(new Date(), config.timeZone)
      const profile = await store.getProfile(identity.guildId, identity.userId)
      resetDailyBattleCount(profile, today)
      const adventure = getAdventure(profile.dailyAdventureId)
      return `用户：${identity.userId}\n`
        + `等级：${profile.level}｜经验：${profile.experience}\n`
        + `积分：${profile.credits}｜战斗力：${baseCombatPower(profile)}｜MMR：${profile.mmr}\n`
        + `战绩：${profile.wins} 胜 ${profile.losses} 负｜当前连胜：${profile.winStreak}\n`
        + `连签：${profile.streak} 天｜对战券：${profile.tickets}｜今日场次：${profile.battleCount}/${MAX_DAILY_BATTLES}\n`
        + (profile.dailyDate === today && adventure
          ? renderAdventure(adventure, profile.dailyAdventureUsed)
          : '今日尚未签到。')
    })

  ctx.command('今日奇遇', '查看今天抽到的签到奇遇')
    .alias('奇遇')
    .action(async ({ session }) => {
      const identity = identify(session)
      if (typeof identity === 'string') return identity
      const today = dateKey(new Date(), config.timeZone)
      const profile = await store.getProfile(identity.guildId, identity.userId)
      if (profile.dailyDate !== today) return '今天尚未签到，请先发送「签到」。'
      const adventure = getAdventure(profile.dailyAdventureId)
      return adventure ? renderAdventure(adventure, profile.dailyAdventureUsed) : '今日奇遇数据异常。'
    })

  ctx.command('挑战 <target:string> [stake:number]', '向指定群友发起积分对战')
    .action(async ({ session }, target, stake) => {
      const identity = identify(session)
      if (typeof identity === 'string') return identity
      const targetId = targetFromSession(session, target)
      if (!targetId) return '请使用「挑战 @群友 10」发起挑战。'
      return createChallenge(identity, targetId, stake)
    })

  ctx.command('匹配对战', '寻找 MMR 和战力接近的群友')
    .alias('自动匹配')
    .action(async ({ session }) => {
      const identity = identify(session)
      if (typeof identity === 'string') return identity
      const today = dateKey(new Date(), config.timeZone)
      const own = await store.getProfile(identity.guildId, identity.userId)
      resetDailyBattleCount(own, today)
      if (own.dailyDate !== today) return '请先签到，再寻找对手。'
      const ownLimit = battleLimitMessage(own)
      if (ownLimit) return ownLimit

      const profiles = await store.listProfiles(identity.guildId)
      const candidates = profiles
        .filter((profile) => profile.userId !== identity.userId)
        .filter((profile) => profile.dailyDate === today && profile.tickets > 0)
        .filter((profile) => profile.credits >= config.defaultStake)
        .filter((profile) => Math.abs(profile.mmr - own.mmr) <= config.maxMmrGap)
        .sort((left, right) => Math.abs(left.mmr - own.mmr) - Math.abs(right.mmr - own.mmr))

      for (const candidate of candidates) {
        if (await store.hasRewardedPairBattle(identity.guildId, identity.userId, candidate.userId, today)) continue
        return createChallenge(identity, candidate.userId, config.defaultStake)
      }
      return '暂时没有符合条件的对手，请稍后再试或手动挑战。'
    })

  ctx.command('接受挑战', '接受最新一条未过期的对战邀请')
    .action(async ({ session }) => {
      const identity = identify(session)
      if (typeof identity === 'string') return identity
      const now = new Date()
      const today = dateKey(now, config.timeZone)
      const battle = await store.findPendingForTarget(identity.guildId, identity.userId, now)
      if (!battle) return '没有等待你接受的挑战。'

      const [challenger, target] = await Promise.all([
        store.getProfile(identity.guildId, battle.challengerId),
        store.getProfile(identity.guildId, battle.targetId),
      ])
      resetDailyBattleCount(challenger, today)
      resetDailyBattleCount(target, today)
      if (challenger.dailyDate !== today || target.dailyDate !== today) return '双方今天都必须先签到。'
      const challengerLimit = battleLimitMessage(challenger)
      const targetLimit = battleLimitMessage(target)
      if (challengerLimit || targetLimit) return challengerLimit || targetLimit
      if (challenger.credits < battle.stake || target.credits < battle.stake) return '有一方积分不足，挑战无法结算。'

      const challengerAdventure = activeAdventure(challenger, today)
      const targetAdventure = activeAdventure(target, today)
      const power = calculateBattlePower({
        own: challenger,
        opponent: target,
        ownAdventure: challengerAdventure,
        opponentAdventure: targetAdventure,
      })
      const resolution = resolveBattle(`${battle.id}:${battle.createdAt.getTime()}`, power.own, power.opponent)
      const winner = resolution.winner === 'own' ? challenger : target
      const loser = resolution.winner === 'own' ? target : challenger
      const winnerAdventure = resolution.winner === 'own' ? challengerAdventure : targetAdventure
      const loserAdventure = resolution.winner === 'own' ? targetAdventure : challengerAdventure

      challenger.credits -= battle.stake
      target.credits -= battle.stake
      const payout = Math.floor(battle.stake * 2 * 0.8)
      const winBonus = winnerAdventure ? effectValue(winnerAdventure.effects, 'win-bonus') : 0
      const refundPercent = loserAdventure
        ? Math.min(50, effectValue(loserAdventure.effects, 'loss-refund'))
        : 0
      const refund = Math.min(
        Math.floor(battle.stake * refundPercent / 100),
        battle.stake * 2 - payout,
      )
      winner.credits += payout + winBonus
      loser.credits += refund

      const cooperationExperience = (challengerAdventure
        ? effectValue(challengerAdventure.effects, 'cooperation-experience') : 0)
        + (targetAdventure ? effectValue(targetAdventure.effects, 'cooperation-experience') : 0)
      addExperience(winner, 11 + cooperationExperience)
      addExperience(loser, 3 + cooperationExperience)
      winner.wins += 1
      winner.winStreak += 1
      loser.losses += 1
      loser.winStreak = 0
      challenger.tickets -= 1
      target.tickets -= 1
      challenger.battleCount += 1
      target.battleCount += 1
      challenger.battleDate = today
      target.battleDate = today
      if (challengerAdventure) challenger.dailyAdventureUsed = true
      if (targetAdventure) target.dailyAdventureUsed = true

      const challengerMmrBefore = challenger.mmr
      updateMmr(challenger, target, resolution.winner)
      const mmrChange = challenger.mmr - challengerMmrBefore
      await Promise.all([store.saveProfile(challenger), store.saveProfile(target)])
      await store.updateBattle(battle.id, {
        status: 'completed',
        completedDate: today,
        challengerPower: power.own,
        targetPower: power.opponent,
        challengerChance: resolution.ownChance,
        roll: resolution.roll,
        winnerId: winner.userId,
        challengerAdventureId: challengerAdventure?.id ?? '',
        targetAdventureId: targetAdventure?.id ?? '',
        mmrChange,
      })

      const text = `对战 #${battle.id} 结算完成\n`
        + `${formatPowerBreakdown(power, challenger.userId, target.userId)}\n`
        + `${challenger.userId} 胜率：${Math.round(resolution.ownChance * 100)}%｜判定值：${Math.round(resolution.roll * 100)}\n`
        + `胜者：${winner.userId}｜获得奖池 ${payout}${winBonus ? ` + 奇遇 ${winBonus}` : ''} 积分\n`
        + `败者返还：${refund} 积分｜双方额外经验：${cooperationExperience}\n`
        + `MMR：${challenger.userId} ${mmrChange >= 0 ? '+' : ''}${mmrChange}，${target.userId} ${-mmrChange >= 0 ? '+' : ''}${-mmrChange}`
      return renderOrText({
        battleId: battle.id,
        challengerId: challenger.userId,
        targetId: target.userId,
        challengerPower: power.own,
        targetPower: power.opponent,
        challengerAdventureBonus: power.ownAdventureBonus,
        targetAdventureBonus: power.opponentAdventureBonus,
        winnerId: winner.userId,
        stake: battle.stake,
        payout,
        refund,
        challengerChance: resolution.ownChance,
        challengerMmrChange: mmrChange,
        targetMmrChange: -mmrChange,
        backgroundUserId: challenger.userId,
        date: today,
      }, text)
    })

  ctx.command('拒绝挑战', '拒绝最新一条未过期的对战邀请')
    .action(async ({ session }) => {
      const identity = identify(session)
      if (typeof identity === 'string') return identity
      const battle = await store.findPendingForTarget(identity.guildId, identity.userId, new Date())
      if (!battle) return '没有等待你处理的挑战。'
      await store.updateBattle(battle.id, { status: 'rejected' })
      return `已拒绝对战 #${battle.id}。`
    })

  ctx.command('积分排行', '查看本群积分排行榜')
    .alias('排行榜')
    .action(async ({ session }) => {
      const identity = identify(session)
      if (typeof identity === 'string') return identity
      const profiles = (await store.listProfiles(identity.guildId))
        .sort((left, right) => right.credits - left.credits)
      const top = profiles.slice(0, 10)
      const ownRank = profiles.findIndex((profile) => profile.userId === identity.userId) + 1
      return `本群积分排行榜\n${top.map((profile, index) => `${index + 1}. ${profile.userId}｜${profile.credits} 分`).join('\n')}`
        + (ownRank > 10 ? `\n你的排名：${ownRank}` : '')
    })

  ctx.command('对战排行', '查看本群 MMR 排行榜')
    .action(async ({ session }) => {
      const identity = identify(session)
      if (typeof identity === 'string') return identity
      const profiles = (await store.listProfiles(identity.guildId))
        .sort((left, right) => right.mmr - left.mmr)
        .slice(0, 10)
      return `本群对战排行榜\n${profiles.map((profile, index) =>
        `${index + 1}. ${profile.userId}｜MMR ${profile.mmr}｜${profile.wins}胜${profile.losses}负`).join('\n')}`
    })
}

export { ADVENTURES, getAdventure, pickDailyAdventure, renderAdventure } from './adventures'
export {
  applyCheckin,
  baseCombatPower,
  calculateBattlePower,
  defaultProfile,
  resolveBattle,
  winChance,
} from './game'
export { dateKey, getDailyFortune, hashSeed, renderFortune } from './fortune'
export { pickRandom, WARFRAMES, WEAPONS } from './items'
