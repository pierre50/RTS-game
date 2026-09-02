import { getHeroInventory } from '../equipment/equipmentLoot'
import { getMissingPlayerResources, withdrawChestResources } from '../resources/playerResourceTotals'
import type { ResourceAmount } from '../../types/common'
import type { UnitEntity } from '../../types/entities'
import type { PlayerLike } from '../../types/player'

export type HeroCraftRecipe = {
  descriptionKey?: string
  id: string
  labelKey: string
  outputEquipment: string
  outputCount: number
  cost: ResourceAmount
}

export const HERO_TRAP_ITEM = 'trap'
export const HERO_CHEST_ITEM = 'chest'
export const HERO_CAMPFIRE_ITEM = 'campfire'

export const HERO_ARROW_CRAFT_RECIPES: readonly HeroCraftRecipe[] = [
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
    cost: { wood: 5 },
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
    id: 'arrow_ceramic',
    labelKey: 'craftArrowCeramic',
    outputEquipment: 'arrow_ceramic',
    outputCount: 20,
    cost: { wood: 5, stone: 2 },
  },
  {
    id: 'arrow_copper',
    labelKey: 'craftArrowCopper',
    outputEquipment: 'arrow_copper',
    outputCount: 20,
    cost: { wood: 5, copper: 2 },
  },
  {
    id: 'arrow_bronze',
    labelKey: 'craftArrowBronze',
    outputEquipment: 'arrow_bronze',
    outputCount: 20,
    cost: { wood: 5, copper: 2, iron: 1 },
  },
  {
    id: 'arrow_iron',
    labelKey: 'craftArrowIron',
    outputEquipment: 'arrow_iron',
    outputCount: 20,
    cost: { wood: 5, iron: 2 },
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

  const inventory = getHeroInventory(hero)
  for (let i = 0; i < recipe.outputCount; i++) {
    inventory.equipment!.push(recipe.outputEquipment)
  }
  return true
}
