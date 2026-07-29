import { hashSeed } from './fortune'

export type AdventureTrigger = 'battle' | 'checkin' | 'shop'

export type AdventureEffect =
  | { type: 'power', value: number }
  | { type: 'power-if-behind', value: number }
  | { type: 'power-if-close', value: number }
  | { type: 'power-if-higher-mmr', value: number }
  | { type: 'power-if-close-mmr', value: number }
  | { type: 'power-if-higher-level', value: number }
  | { type: 'power-if-revenge', value: number }
  | { type: 'opponent-power', value: number }
  | { type: 'initiative', value: number }
  | { type: 'credits', value: number }
  | { type: 'experience', value: number }
  | { type: 'ticket', value: number }
  | { type: 'win-bonus', value: number }
  | { type: 'loss-refund', value: number }
  | { type: 'scan' }
  | { type: 'cooperation-experience', value: number }
  | { type: 'cooperation-experience-if-new', value: number }
  | { type: 'shop-discount', value: number }

export interface Adventure {
  id: string
  title: string
  description: string
  trigger: AdventureTrigger
  weight: number
  effects: readonly AdventureEffect[]
}

/**
 * 奇遇池保持为纯数据，插件不依赖 Warframe 域。数值较小且大多有上限，
 * 这样扩充文案不会顺手破坏经济系统。
 */
export const ADVENTURES: readonly Adventure[] = [
  { id: 'fire-calibration', title: '火力校准', description: '武器系统完成了精准校准，本场战斗力 +10。', trigger: 'battle', weight: 10, effects: [{ type: 'power', value: 10 }] },
  { id: 'void-charge', title: '虚空聚能', description: '虚空能量短暂汇聚，本场战斗力 +12。', trigger: 'battle', weight: 8, effects: [{ type: 'power', value: 12 }] },
  { id: 'overload-protocol', title: '过载协议', description: '本日首次对战进入过载状态，战斗力 +16。', trigger: 'battle', weight: 5, effects: [{ type: 'power', value: 16 }] },
  { id: 'target-lock', title: '目标锁定', description: '锁定更强的目标，若你的基础战力较低则额外 +10。', trigger: 'battle', weight: 7, effects: [{ type: 'power-if-behind', value: 10 }] },
  { id: 'hunter-mode', title: '追猎模式', description: '挑战更高 MMR 的对手时，战斗力 +10。', trigger: 'battle', weight: 6, effects: [{ type: 'power-if-higher-mmr', value: 10 }] },
  { id: 'swift-protocol', title: '迅捷协议', description: '行动先手得到强化，战斗力 +8。', trigger: 'battle', weight: 8, effects: [{ type: 'initiative', value: 8 }] },
  { id: 'void-shield', title: '虚空护盾', description: '护盾吸收部分损失，本场战斗力 +8，失败返还 20% 消耗。', trigger: 'battle', weight: 7, effects: [{ type: 'power', value: 8 }, { type: 'loss-refund', value: 20 }] },
  { id: 'guardian-matrix', title: '守护矩阵', description: '防御矩阵展开，本场战斗力 +10，并削弱对方 +4。', trigger: 'battle', weight: 6, effects: [{ type: 'power', value: 10 }, { type: 'opponent-power', value: 4 }] },
  { id: 'counter-algorithm', title: '反制算法', description: '分析对手弱点，使对手本场战斗力 -8。', trigger: 'battle', weight: 5, effects: [{ type: 'opponent-power', value: 8 }] },
  { id: 'tactical-rehearsal', title: '战术预演', description: '提前完成模拟演练，战斗力 +5，并允许查看对手区间。', trigger: 'battle', weight: 7, effects: [{ type: 'power', value: 5 }, { type: 'scan' }] },
  { id: 'armor-break', title: '破甲脉冲', description: '对战力高于自己的对手时，额外获得 +8。', trigger: 'battle', weight: 6, effects: [{ type: 'power-if-behind', value: 8 }] },
  { id: 'backup-weapon', title: '备用武装', description: '准备了第二套武装，本场战斗力 +8。', trigger: 'battle', weight: 8, effects: [{ type: 'power', value: 8 }] },
  { id: 'composite-ammo', title: '复合弹头', description: '双方战力接近时，弹头协同效果更好，额外 +12。', trigger: 'battle', weight: 6, effects: [{ type: 'power-if-close', value: 12 }] },
  { id: 'iron-will', title: '钢铁意志', description: '面对强敌不退缩，基础战力较低时额外 +6。', trigger: 'battle', weight: 8, effects: [{ type: 'power-if-behind', value: 6 }] },
  { id: 'tactical-scan', title: '战术扫描', description: '获得对手战斗力区间和 MMR 段位提示。', trigger: 'battle', weight: 8, effects: [{ type: 'scan' }] },
  { id: 'emergency-repair', title: '紧急修复', description: '本场失败时返还 50% 对战消耗。', trigger: 'battle', weight: 5, effects: [{ type: 'loss-refund', value: 50 }] },
  { id: 'supply-drop', title: '资源补给', description: '签到时发现资源箱，立即获得 8 积分。', trigger: 'checkin', weight: 8, effects: [{ type: 'credits', value: 8 }] },
  { id: 'void-cache', title: '虚空储藏', description: '从裂隙边缘找到储藏箱，立即获得 12 积分。', trigger: 'checkin', weight: 5, effects: [{ type: 'credits', value: 12 }] },
  { id: 'salvage-recovery', title: '残骸回收', description: '本场战斗失败时返还 40% 消耗。', trigger: 'battle', weight: 7, effects: [{ type: 'loss-refund', value: 40 }] },
  { id: 'victory-bounty', title: '胜利赏金', description: '下一场获胜时额外获得 10 积分。', trigger: 'battle', weight: 7, effects: [{ type: 'win-bonus', value: 10 }] },
  { id: 'battle-insurance', title: '对战保险', description: '本场失败时返还 50% 对战消耗。', trigger: 'battle', weight: 6, effects: [{ type: 'loss-refund', value: 50 }] },
  { id: 'training-data', title: '训练数据', description: '整理战斗数据，立即获得 10 点经验。', trigger: 'checkin', weight: 7, effects: [{ type: 'experience', value: 10 }] },
  { id: 'double-training', title: '双倍训练', description: '下一场完成对战时，双方经验奖励额外 +4。', trigger: 'battle', weight: 6, effects: [{ type: 'cooperation-experience', value: 4 }] },
  { id: 'spare-ammunition', title: '备用弹药', description: '获得 1 张额外对战券，仍受每日上限限制。', trigger: 'checkin', weight: 5, effects: [{ type: 'ticket', value: 1 }] },
  { id: 'relay-supply', title: '中继站补给', description: '中继站赠送 5 积分和 1 点经验。', trigger: 'checkin', weight: 8, effects: [{ type: 'credits', value: 5 }, { type: 'experience', value: 1 }] },
  { id: 'cooperative-operation', title: '协同作战', description: '对手接受挑战后，双方各获得额外经验。', trigger: 'battle', weight: 7, effects: [{ type: 'cooperation-experience', value: 2 }] },
  { id: 'honor-challenge', title: '荣誉挑战', description: '挑战 MMR 接近的对手时，战斗力 +6。', trigger: 'battle', weight: 7, effects: [{ type: 'power-if-close-mmr', value: 6 }] },
  { id: 'public-bounty', title: '公开悬赏', description: '本场获胜时额外获得 5 积分。', trigger: 'battle', weight: 7, effects: [{ type: 'win-bonus', value: 5 }] },
  { id: 'revenge-mark', title: '复仇标记', description: '挑战曾击败自己的对手时，战斗力 +8。', trigger: 'battle', weight: 4, effects: [{ type: 'power-if-revenge', value: 8 }] },
  { id: 'newbie-mentor', title: '新人导师', description: '与累计对战不足 3 场的新用户对战时，双方额外获得 3 点经验。', trigger: 'battle', weight: 5, effects: [{ type: 'cooperation-experience-if-new', value: 3 }] },
  { id: 'arena-license', title: '竞技许可', description: '获得 1 张额外对战券，仍受每日上限限制。', trigger: 'checkin', weight: 5, effects: [{ type: 'ticket', value: 1 }] },
  { id: 'fair-play', title: '公平协议', description: '挑战战力相近的对手时，失败返还 20% 消耗。', trigger: 'battle', weight: 8, effects: [{ type: 'power-if-close', value: 4 }, { type: 'loss-refund', value: 20 }] },
  { id: 'star-chart-navigation', title: '星图导航', description: '下一次自动匹配会优先寻找战力接近的对手。', trigger: 'battle', weight: 7, effects: [{ type: 'scan' }] },
  { id: 'expedition-license', title: '远征许可', description: '本场获胜时额外获得 8 积分。', trigger: 'battle', weight: 6, effects: [{ type: 'win-bonus', value: 8 }] },
  { id: 'observer-pass', title: '观战凭证', description: '本场战报会生成更完整的战斗力构成。', trigger: 'battle', weight: 5, effects: [{ type: 'scan' }] },
  { id: 'lotus-gaze', title: 'Lotus 的注视', description: '本日签到卡获得特殊边框，战斗力 +4。', trigger: 'battle', weight: 6, effects: [{ type: 'power', value: 4 }] },
  { id: 'void-echo', title: '虚空回响', description: '本日对战卡使用虚空主题，战斗力 +4。', trigger: 'battle', weight: 6, effects: [{ type: 'power', value: 4 }] },
  { id: 'weapon-resonance', title: '兵器共鸣', description: '武器系统与今日状态产生共鸣，本场战斗力 +7。', trigger: 'battle', weight: 6, effects: [{ type: 'power', value: 7 }] },
  { id: 'data-complete', title: '数据完整', description: '战斗结算会展示完整战力构成，额外获得 2 点经验。', trigger: 'battle', weight: 5, effects: [{ type: 'cooperation-experience', value: 2 }, { type: 'scan' }] },
  { id: 'lucky-coordinate', title: '幸运坐标', description: '今天首次购买积分商店商品享受八折。', trigger: 'shop', weight: 6, effects: [{ type: 'shop-discount', value: 20 }] },
  { id: 'squad-beacon', title: '战友信标', description: '与同群用户完成对战时，双方各获得额外经验。', trigger: 'battle', weight: 7, effects: [{ type: 'cooperation-experience', value: 2 }] },
  { id: 'battle-replay', title: '战术复盘', description: '对战结算后可以查看一次详细战报。', trigger: 'battle', weight: 5, effects: [{ type: 'scan' }] },
  { id: 'steel-path', title: '钢铁之路', description: '本场对手等级高于自己时，战斗力 +8。', trigger: 'battle', weight: 5, effects: [{ type: 'power-if-higher-level', value: 8 }] },
  { id: 'relay-honor', title: '中继站荣誉', description: '本场获胜时额外获得 3 积分和 3 点经验。', trigger: 'battle', weight: 6, effects: [{ type: 'win-bonus', value: 3 }, { type: 'cooperation-experience', value: 3 }] },
]

export function getAdventure(id: string): Adventure | undefined {
  return ADVENTURES.find((adventure) => adventure.id === id)
}

/** 按用户和日期固定抽取，避免用户反复查询时重摇。 */
export function pickDailyAdventure(userId: string, date: string): Adventure {
  const total = ADVENTURES.reduce((sum, adventure) => sum + adventure.weight, 0)
  let cursor = hashSeed(`${userId}:adventure:${date}`) % total
  for (const adventure of ADVENTURES) {
    cursor -= adventure.weight
    if (cursor < 0) return adventure
  }
  return ADVENTURES[ADVENTURES.length - 1]
}

export function renderAdventure(adventure: Adventure, used = false): string {
  const status = used
    ? '（今日奇遇已生效）'
    : adventure.trigger === 'battle'
      ? '（首次对战时生效）'
      : adventure.trigger === 'shop' ? '（首次购买时生效）' : '（签到时生效）'
  return `【${adventure.title}】${status}\n${adventure.description}`
}
