/**
 * 仅作为娱乐推荐池，刻意与 Warframe 插件的数据层隔离。
 * 后续若需要完整物品库，可在不改变命令接口的前提下替换为配置或独立数据源。
 */
export const WARFRAMES = [
  'Excalibur', 'Mag', 'Volt', 'Loki', 'Rhino', 'Ember', 'Ash', 'Trinity',
  'Frost', 'Saryn', 'Nova', 'Nekros', 'Valkyr', 'Mesa', 'Limbo', 'Atlas',
  'Ivara', 'Inaros', 'Nezha', 'Wukong', 'Gara', 'Garuda', 'Revenant', 'Khora',
  'Baruuk', 'Hildryn', 'Wisp', 'Gauss', 'Grendel', 'Protea', 'Xaku', 'Yareli',
  'Caliban', 'Gyre', 'Styanax', 'Voruna', 'Citrine', 'Kullervo', 'Dante', 'Jade',
] as const

export const WEAPONS = [
  'Braton', 'BOLTOR', 'Paris', 'MK1-Paris', 'Latron', 'Dread', 'Cernos', 'Lanka',
  'Soma', 'Burston', 'Tigris', 'Hek', 'Ignis', 'Amprex', 'Arca Plasmor', 'Kuva Bramma',
  'Rubico', 'Vectis', 'Akstiletto', 'Lex', 'Sicarus', 'Pandero', 'Kuva Nukor', 'Laetum',
  'Skana', 'Gram', 'Galatine', 'Orthos', 'Nikana', 'Dragon Nikana', 'Lesion', 'Redeemer',
  'Glaive', 'Venka', 'Kronen', 'Silva & Aegis', 'Ninkondi', 'Plasma Sword', 'Praedos', 'Xoris',
] as const

export function pickRandom<T>(items: readonly T[], random = Math.random): T {
  if (!items.length) throw new Error('推荐池不能为空')
  const index = Math.max(0, Math.min(items.length - 1, Math.floor(random() * items.length)))
  return items[index]
}
