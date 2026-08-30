import { getHeroInventory } from '../equipment/equipmentLoot'
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

export const HERO_ARROW_CRAFT_RECIPES: readonly HeroCraftRecipe[] = [
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

export function getMissingCraftResources(player: PlayerLike, cost: ResourceAmount): ResourceAmount {
  const missing: ResourceAmount = {}
  for (const [resource, amount] of Object.entries(cost) as [keyof ResourceAmount, number][]) {
    const needed = Math.max(0, Math.floor(amount ?? 0))
    if (needed > 0 && (player[resource] ?? 0) < needed) missing[resource] = needed - (player[resource] ?? 0)
  }
  return missing
}

export function canCraftHeroRecipe(player: PlayerLike, recipe: HeroCraftRecipe): boolean {
  return Object.keys(getMissingCraftResources(player, recipe.cost)).length === 0
}

export function craftHeroRecipe(
  player: PlayerLike,
  hero: UnitEntity | null | undefined,
  recipe: HeroCraftRecipe
): boolean {
  if (!hero || !canCraftHeroRecipe(player, recipe)) return false

  for (const [resource, amount] of Object.entries(recipe.cost) as [keyof ResourceAmount, number][]) {
    player[resource] -= Math.max(0, Math.floor(amount ?? 0))
  }

  const inventory = getHeroInventory(hero)
  for (let i = 0; i < recipe.outputCount; i++) {
    inventory.equipment!.push(recipe.outputEquipment)
  }
  return true
}
