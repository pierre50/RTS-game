import { canForgeProduce, type ForgeProductionBuilding } from '../equipment/forgeProduction'
import { isCurrentEquipment } from '../equipment/equipmentMaterials'
import { observeEconomyChange, recordEconomyFlow } from '../economy/economyTelemetry'
import { isEquipmentEnabledForCivilization } from '../lpc/equipmentData'
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

type CraftStation = ForgeProductionBuilding & {
  i: number
  j: number
  spaceId?: string | null
  owner?: Pick<PlayerLike, 'civ' | 'label'>
}

function isRecipeAvailableAtForge(
  recipe: HeroCraftRecipe,
  player: { civ?: string } | undefined,
  forge?: Pick<CraftStation, 'owner' | 'buildingLevel' | 'assetLevel'>
): boolean {
  if (!isCurrentEquipment(recipe.outputEquipment)) return false
  if (recipe.station === 'forge' && !canForgeProduce(recipe, forge)) return false
  if (recipe.civilizations?.length && forge && !forge.owner?.civ) return false
  return isEquipmentEnabledForCivilization(recipe, forge ? forge.owner?.civ : player?.civ)
}

export * from './heroCraftRecipes'
import {
  HERO_CRAFT_RECIPES,
  HERO_GRILLED_MEAT_ITEM,
  HERO_HEALING_POULTICE_ITEM,
  HERO_FIBER_BANDAGE_ITEM,
} from './heroCraftRecipes'
import type { HeroCraftRecipe } from './heroCraftRecipes'

const HERO_CONSUMABLE_HEALING: Record<string, number> = {
  [HERO_GRILLED_MEAT_ITEM]: 12,
  [HERO_HEALING_POULTICE_ITEM]: 18,
  [HERO_FIBER_BANDAGE_ITEM]: 8,
}

export function getAvailableHeroCraftRecipes(
  player?: { civ?: string },
  station?: HeroCraftRecipe['station'],
  forge?: Pick<CraftStation, 'owner' | 'buildingLevel' | 'assetLevel'>
): readonly HeroCraftRecipe[] {
  return HERO_CRAFT_RECIPES.filter(
    recipe => (!station || recipe.station === station) && isRecipeAvailableAtForge(recipe, player, forge)
  )
}

export function getMissingCraftResources(
  player: PlayerLike,
  cost: ResourceAmount,
  hero?: UnitEntity | null,
  station?: UnitEntity | { i: number; j: number; spaceId?: string | null }
): ResourceAmount {
  return getMissingPlayerResources(player, cost, { hero, settlement: station ?? hero })
}

/** Pay whole materials and retain their unused tenths in the hero's saved inventory.
 * Integer arithmetic keeps ten single crafts equivalent to a single ten-item craft. */
export function getHeroCraftPayment(
  recipe: HeroCraftRecipe,
  hero?: UnitEntity | null,
  count = 1
): {
  cost: ResourceAmount
  remainders: ResourceAmount
} {
  const cost: ResourceAmount = {}
  const remainders = { ...hero?.inventory?.craftingRemainders }
  for (const [resource, amount] of Object.entries(recipe.cost) as [keyof ResourceAmount, number][]) {
    const credit = remainders[resource] ?? 0
    const needed = Math.round(amount * 10) * count - credit
    const payment = Math.max(0, Math.ceil(needed / 10))
    if (payment) cost[resource] = payment
    const remainder = payment * 10 - needed
    if (remainder) remainders[resource] = remainder
    else delete remainders[resource]
  }
  return { cost, remainders }
}

export function canCraftHeroRecipe(
  player: PlayerLike,
  recipe: HeroCraftRecipe,
  hero?: UnitEntity | null,
  station?: CraftStation
): boolean {
  return (
    isRecipeAvailableAtForge(recipe, player, station) &&
    Object.keys(getMissingCraftResources(player, getHeroCraftPayment(recipe, hero).cost, hero, station)).length === 0
  )
}

export function getMaxHeroCraftCount(
  player: PlayerLike,
  recipe: HeroCraftRecipe,
  hero?: UnitEntity | null,
  station?: CraftStation
): number {
  if (!hero || !isRecipeAvailableAtForge(recipe, player, station)) return 0
  const totals = getPlayerResourceTotals(player, { hero, settlement: station ?? hero })
  const limits = (Object.entries(recipe.cost) as [keyof ResourceAmount, number][])
    .filter(([, amount]) => amount > 0)
    .map(([resource, amount]) =>
      Math.floor(
        ((totals[resource] ?? 0) * 10 + (hero.inventory?.craftingRemainders?.[resource] ?? 0)) / Math.round(amount * 10)
      )
    )
  return limits.length ? Math.max(0, Math.min(...limits)) : 1
}

export function craftHeroRecipe(
  player: PlayerLike,
  hero: UnitEntity | null | undefined,
  recipe: HeroCraftRecipe,
  count = 1,
  station?: CraftStation
): boolean {
  if (!hero || !Number.isSafeInteger(count) || count < 1 || !isRecipeAvailableAtForge(recipe, player, station))
    return false
  const { cost, remainders } = getHeroCraftPayment(recipe, hero, count)
  if (
    !observeEconomyChange(
      player,
      'craftConsumed',
      () => getPlayerResourceTotals(player, { hero, settlement: station ?? hero }),
      'removed',
      () => withdrawChestResources(player, cost, { hero, settlement: station ?? hero })
    )
  )
    return false

  const inventory = getHeroInventory(hero)
  if (Object.keys(remainders).length) inventory.craftingRemainders = remainders
  else delete inventory.craftingRemainders

  if (recipe.outputResource) {
    inventory.resources[recipe.outputResource] =
      (inventory.resources[recipe.outputResource] ?? 0) + recipe.outputCount * count
    recordEconomyFlow(player, 'craftProduced', { [recipe.outputResource]: recipe.outputCount * count })
    syncPlayerResourceFieldsFromChests(player)
    return true
  }
  recordEconomyFlow(player, 'craftProduced', { ['item:' + recipe.outputEquipment]: recipe.outputCount * count })
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
