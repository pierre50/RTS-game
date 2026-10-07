import { FORGE_EQUIPMENT_RECIPES } from './heroForgeRecipes'
import { addHeroInventoryItem, removeHeroInventoryItem, getHeroInventory } from '../equipment/equipmentLoot'
import {
  getMissingPlayerResources,
  getPlayerResourceTotals,
  withdrawChestResources,
  syncPlayerResourceFieldsFromChests,
} from '../resources/playerResourceTotals'
import type { ResourceAmount } from '../../types/common'
import type { UnitEntity } from '../../types/entities'
import type { PlayerLike } from '../../types/player'

export type HeroCraftRecipe = {
  station: 'forge' | 'campfire'
  category: 'equipment' | 'arrows' | 'cooking' | 'potions' | 'ingots'
  forgeGroup?: 'weapons' | 'armor' | 'shields'
  materialKey?: string
  descriptionKey?: string
  iconResource?: keyof ResourceAmount
  id: string
  labelKey: string
  outputResource?: 'copperIngot' | 'bronzeIngot' | 'ironIngot'
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
export const HERO_GRILLED_MEAT_ITEM = 'grilled_meat'

const HERO_CONSUMABLE_HEALING: Record<string, number> = {
  [HERO_GRILLED_MEAT_ITEM]: 12,
  [HERO_HEALING_POULTICE_ITEM]: 18,
  [HERO_FIBER_BANDAGE_ITEM]: 8,
}

export const HERO_CRAFT_RECIPES: readonly HeroCraftRecipe[] = [
  ...FORGE_EQUIPMENT_RECIPES,
  ...(['copperIngot', 'bronzeIngot', 'ironIngot'] as const).map(resource => ({
    id: resource,
    station: 'forge' as const,
    category: 'ingots' as const,
    labelKey: resource,
    descriptionKey: 'craftIngotDescription',
    iconResource: resource,
    outputResource: resource,
    outputEquipment: '',
    outputCount: 1,
    cost:
      resource === 'copperIngot'
        ? { copper: 3, wood: 2 }
        : resource === 'bronzeIngot'
          ? { copper: 2, tin: 1, wood: 2 }
          : { iron: 3, wood: 2 },
  })),
  {
    id: HERO_GRILLED_MEAT_ITEM,
    station: 'campfire',
    category: 'cooking',
    labelKey: 'craftGrilledMeat',
    descriptionKey: 'craftGrilledMeatDescription',
    iconResource: 'meat',
    outputEquipment: HERO_GRILLED_MEAT_ITEM,
    outputCount: 1,
    cost: { meat: 2 },
  },
  {
    id: 'bow',
    station: 'forge',
    category: 'equipment',
    labelKey: 'craftBow',
    descriptionKey: 'craftBowDescription',
    outputEquipment: 'bow',
    outputCount: 1,
    cost: { wood: 5, sinew: 2 },
  },
  {
    id: 'catchingPole',
    station: 'forge',
    category: 'equipment',
    labelKey: 'craftCatchingPole',
    descriptionKey: 'craftCatchingPoleDescription',
    outputEquipment: 'catchingPole',
    outputCount: 1,
    cost: { wood: 4, fiber: 2 },
  },
  {
    id: HERO_HEALING_POULTICE_ITEM,
    station: 'campfire',
    category: 'potions',
    labelKey: 'craftHealingPoultice',
    descriptionKey: 'craftHealingPoulticeDescription',
    iconResource: 'herb',
    outputEquipment: HERO_HEALING_POULTICE_ITEM,
    outputCount: 1,
    cost: { herb: 2, fiber: 1 },
  },
  {
    id: HERO_POISON_VIAL_ITEM,
    station: 'campfire',
    category: 'potions',
    labelKey: 'craftPoisonVial',
    descriptionKey: 'craftPoisonVialDescription',
    iconResource: 'toxicHerb',
    outputEquipment: HERO_POISON_VIAL_ITEM,
    outputCount: 1,
    cost: { toxicHerb: 2 },
  },
  {
    id: HERO_FIBER_BANDAGE_ITEM,
    station: 'campfire',
    category: 'potions',
    labelKey: 'craftFiberBandage',
    descriptionKey: 'craftFiberBandageDescription',
    iconResource: 'fiber',
    outputEquipment: HERO_FIBER_BANDAGE_ITEM,
    outputCount: 1,
    cost: { fiber: 3 },
  },
  {
    id: 'arrow_ceramic',
    station: 'forge',
    category: 'arrows',
    labelKey: 'craftArrowCeramic',
    descriptionKey: 'craftArrowDescription',
    outputEquipment: 'arrow_ceramic',
    outputCount: 1,
    cost: { wood: 5, feather: 2, stone: 2 },
  },
  {
    id: 'arrow_copper',
    station: 'forge',
    category: 'arrows',
    labelKey: 'craftArrowCopper',
    descriptionKey: 'craftArrowDescription',
    outputEquipment: 'arrow_copper',
    outputCount: 1,
    cost: { wood: 5, feather: 2, copperIngot: 1 },
  },
  {
    id: 'arrow_bronze',
    station: 'forge',
    category: 'arrows',
    labelKey: 'craftArrowBronze',
    descriptionKey: 'craftArrowDescription',
    outputEquipment: 'arrow_bronze',
    outputCount: 1,
    cost: { wood: 5, feather: 2, bronzeIngot: 1 },
  },
  {
    id: 'arrow_iron',
    station: 'forge',
    category: 'arrows',
    labelKey: 'craftArrowIron',
    descriptionKey: 'craftArrowDescription',
    outputEquipment: 'arrow_iron',
    outputCount: 1,
    cost: { wood: 5, feather: 2, ironIngot: 1 },
  },
]

export function getAvailableHeroCraftRecipes(
  _player?: unknown,
  station?: HeroCraftRecipe['station']
): readonly HeroCraftRecipe[] {
  return station ? HERO_CRAFT_RECIPES.filter(recipe => recipe.station === station) : HERO_CRAFT_RECIPES
}

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

export function getMaxHeroCraftCount(player: PlayerLike, recipe: HeroCraftRecipe, hero?: UnitEntity | null): number {
  if (!hero) return 0
  const totals = getPlayerResourceTotals(player, { hero })
  const limits = (Object.entries(recipe.cost) as [keyof ResourceAmount, number][])
    .filter(([, amount]) => amount > 0)
    .map(([resource, amount]) => Math.floor((totals[resource] ?? 0) / amount))
  return limits.length ? Math.max(0, Math.min(...limits)) : 1
}

export function craftHeroRecipe(
  player: PlayerLike,
  hero: UnitEntity | null | undefined,
  recipe: HeroCraftRecipe,
  count = 1
): boolean {
  if (!hero || !Number.isSafeInteger(count) || count < 1) return false
  const cost = Object.fromEntries(Object.entries(recipe.cost).map(([resource, amount]) => [resource, amount * count]))
  if (!withdrawChestResources(player, cost, { hero })) return false

  if (recipe.outputResource) {
    const inventory = getHeroInventory(hero)
    inventory.resources[recipe.outputResource] =
      (inventory.resources[recipe.outputResource] ?? 0) + recipe.outputCount * count
    syncPlayerResourceFieldsFromChests(player)
    return true
  }
  for (let i = 0; i < recipe.outputCount * count; i++) {
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
