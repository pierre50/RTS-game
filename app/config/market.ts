import type { ResourceAmount } from '../types/common'

export const MARKET_RESTOCK_INTERVAL_DAYS = 3
export const MARKET_GOLD_TARGETS = [250, 600] as const
export const MARKET_DAILY_GOLD_FRACTION = 0.1
export const MARKET_RESOURCE_BUY_MULTIPLIER = 3
export const MARKET_TOOL_COUNTS = [2, 4] as const
export const MARKET_EQUIPMENT_COUNTS = [1, 2] as const
export const MARKET_LEATHER_EQUIPMENT_COUNT = 1
export const MARKET_ARROW_COUNTS = [20, 40] as const
export const MARKET_RESOURCE_COUNTS: Partial<Record<keyof ResourceAmount, readonly [number, number]>> = {
  wood: [30, 60],
  stone: [30, 60],
  wheat: [30, 60],
  berry: [30, 60],
  meat: [15, 30],
  fiber: [15, 30],
  leather: [10, 20],
  herb: [10, 20],
  copper: [10, 20],
  tin: [10, 20],
  feather: [0, 10],
  sinew: [0, 10],
  bronzeIngot: [3, 5],
  iron: [0, 10],
  ironIngot: [0, 4],
}
export const MARKET_MATERIAL_MIN_LEVEL: Record<string, number> = { copper: 0, bronze: 0, iron: 1 }
export const MARKET_EQUIPMENT_MIN_LEVEL: Record<string, number> = { bow: 0, bow_great: 1, bow_recurve: 1, longsword: 1 }
export const MARKET_USED_VALUE_FLOOR = 0.15

export const METAL_TIER_GOLD_VALUES: Record<string, number> = {
  ceramic: 45,
  leather: 70,
  copper: 95,
  bronze: 160,
  iron: 260,
}

export const RESOURCE_GOLD_VALUES: Partial<Record<keyof ResourceAmount, number>> = {
  wood: 1,
  berry: 1,
  meat: 2,
  wheat: 1,
  herb: 3,
  toxicHerb: 5,
  fiber: 2,
  feather: 4,
  leather: 6,
  sinew: 8,
  stone: 2,
  gold: 1,
  copper: 3,
  tin: 4,

  bronzeIngot: 12,
  ironIngot: 17,
  iron: 5,
}

export const EQUIPMENT_BASE_GOLD_VALUES: Record<string, number> = {
  arrow_ceramic: 4,
  arrow_copper: 6,
  arrow_bronze: 9,
  arrow_iron: 12,
  slingshot: 60,
  bow: 180,
  bow_great: 280,
  bow_recurve: 420,
  axe: 80,
  pickaxe: 80,
  hammer: 70,
  scythe: 80,
  sword: 140,
  dagger: 80,
  mace: 140,
  spear: 110,
  longsword: 520,
  armor_leather: 180,
  armor_mail: 340,
  armor_legion: 520,
  helmet: 140,
  shoulder_legion: 160,
  bracers: 120,
  leg_armor: 140,
  round_shield: 180,
  crest: 160,
  centurion_crest: 320,
  centurion_plumage: 340,
  legion_plumage: 260,
  plumage: 160,
  helmet_wings: 260,
  upward_horns_white: 220,
  upward_horns_ceramic: 260,
  sack_cloth_hood_leather: 180,
  cane: 120,
  longstick: 80,
  catchingPole: 80,
}

export const EQUIPMENT_RESALE_PERCENT = 25
