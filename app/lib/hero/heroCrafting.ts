import { addHeroInventoryItem, removeHeroInventoryItem } from '../equipment/equipmentLoot'
import { getMissingPlayerResources, withdrawChestResources } from '../resources/playerResourceTotals'
import type { ResourceAmount } from '../../types/common'
import type { UnitEntity } from '../../types/entities'
import type { PlayerLike } from '../../types/player'

export type HeroCraftRecipe = {
  descriptionKey?: string
  iconResource?: keyof ResourceAmount
  id: string
  labelKey: string
  outputEquipment: string
  outputCount: number
  cost: ResourceAmount
}

export const HERO_TRAP_ITEM = 'trap'
export const HERO_CHEST_ITEM = 'chest'
export const HERO_CAMPFIRE_ITEM = 'campfire'
export const HERO_HEALING_POULTICE_ITEM = 'healing_poultice'
export const HERO_POISON_VIAL_ITEM = 'poison_vial'
export const HERO_FIBER_BANDAGE_ITEM = 'fiber_bandage'

const HERO_CONSUMABLE_HEALING: Record<string, number> = {
  [HERO_HEALING_POULTICE_ITEM]: 18,
  [HERO_FIBER_BANDAGE_ITEM]: 8,
}

export const HERO_ARROW_CRAFT_RECIPES: readonly HeroCraftRecipe[] = [
  {
    id: 'bow',
    labelKey: 'craftBow',
    descriptionKey: 'craftBowDescription',
    outputEquipment: 'bow',
    outputCount: 1,
    cost: { wood: 5, sinew: 2 },
  },
  {
    id: HERO_CAMPFIRE_ITEM,
    labelKey: 'craftCampfire',
    descriptionKey: 'craftCampfireDescription',
    outputEquipment: HERO_CAMPFIRE_ITEM,
    outputCount: 1,
    cost: { wood: 8, stone: 2 },
  },
  {
    id: HERO_TRAP_ITEM,
    labelKey: 'craftTrap',
    descriptionKey: 'craftTrapDescription',
    outputEquipment: HERO_TRAP_ITEM,
    outputCount: 1,
    cost: { wood: 5, fiber: 2 },
  },
  {
    id: HERO_CHEST_ITEM,
    labelKey: 'craftChest',
    descriptionKey: 'craftChestDescription',
    outputEquipment: HERO_CHEST_ITEM,
    outputCount: 1,
    cost: { wood: 5 },
  },
  {
    id: HERO_HEALING_POULTICE_ITEM,
    labelKey: 'craftHealingPoultice',
    descriptionKey: 'craftHealingPoulticeDescription',
    iconResource: 'herb',
    outputEquipment: HERO_HEALING_POULTICE_ITEM,
    outputCount: 1,
    cost: { herb: 2, fiber: 1 },
  },
  {
    id: HERO_POISON_VIAL_ITEM,
    labelKey: 'craftPoisonVial',
    descriptionKey: 'craftPoisonVialDescription',
    iconResource: 'toxicHerb',
    outputEquipment: HERO_POISON_VIAL_ITEM,
    outputCount: 1,
    cost: { toxicHerb: 2 },
  },
  {
    id: HERO_FIBER_BANDAGE_ITEM,
    labelKey: 'craftFiberBandage',
    descriptionKey: 'craftFiberBandageDescription',
    iconResource: 'fiber',
    outputEquipment: HERO_FIBER_BANDAGE_ITEM,
    outputCount: 1,
    cost: { fiber: 3 },
  },
  {
    id: 'arrow_ceramic',
    labelKey: 'craftArrowCeramic',
    outputEquipment: 'arrow_ceramic',
    outputCount: 20,
    cost: { wood: 5, feather: 2, stone: 2 },
  },
  {
    id: 'arrow_copper',
    labelKey: 'craftArrowCopper',
    outputEquipment: 'arrow_copper',
    outputCount: 20,
    cost: { wood: 5, feather: 2, copper: 2 },
  },
  {
    id: 'arrow_bronze',
    labelKey: 'craftArrowBronze',
    outputEquipment: 'arrow_bronze',
    outputCount: 20,
    cost: { wood: 5, feather: 2, copper: 2, iron: 1 },
  },
  {
    id: 'arrow_iron',
    labelKey: 'craftArrowIron',
    outputEquipment: 'arrow_iron',
    outputCount: 20,
    cost: { wood: 5, feather: 2, iron: 2 },
  },
]

export function getMissingCraftResources(
  player: PlayerLike,
  cost: ResourceAmount,
  hero?: UnitEntity | null
): ResourceAmount {
  return getMissingPlayerResources(player, cost, { hero })
}

export function canCraftHeroRecipe(player: PlayerLike, recipe: HeroCraftRecipe, hero?: UnitEntity | null): boolean {
  return Object.keys(getMissingCraftResources(player, recipe.cost, hero)).length === 0
}

export function craftHeroRecipe(
  player: PlayerLike,
  hero: UnitEntity | null | undefined,
  recipe: HeroCraftRecipe
): boolean {
  if (!hero || !canCraftHeroRecipe(player, recipe, hero)) return false
  if (!withdrawChestResources(player, recipe.cost, { hero })) return false

  for (let i = 0; i < recipe.outputCount; i++) {
    addHeroInventoryItem(hero, recipe.outputEquipment)
  }
  return true
}

export function getHeroConsumableHealing(item: string): number {
  return HERO_CONSUMABLE_HEALING[item] ?? 0
}

export function useHeroConsumableItem(hero: UnitEntity | null | undefined, item: string): boolean {
  const healAmount = getHeroConsumableHealing(item)
  if (!hero || healAmount <= 0) return false
  const hitPoints = hero.hitPoints ?? 0
  const totalHitPoints = hero.totalHitPoints ?? hitPoints
  if (hitPoints >= totalHitPoints) return false
  if (!removeHeroInventoryItem(hero, item)) return false
  hero.hitPoints = Math.min(totalHitPoints, hitPoints + healAmount)
  return true
}
