import { getUnitResourceCarryRemaining } from '../../resources/resourceDelivery'
import type { UnitEntity } from '../../../types/entities'
import { constructionToolPreparation } from './toolPreparation'
import type { PlayerLike } from '../../../types/player'
import type { SavePlayerState } from '../../../types/save'
import { HERO_CRAFT_RECIPES } from '../../hero/heroCraftRecipes'
import { isEquipmentBroken } from '../../equipment/equipmentCondition'
import { workToolFamily, toolFamilyForWork } from '../../equipment/workTools'
import { recordEconomyFlow } from '../../economy/economyTelemetry'
import type { SupplyUnit } from './townSupplies'

/** Bootstrap an autonomous resident only when no work tool is owned at all. */
export function groundToolTarget(
  unit: SupplyUnit,
  owner: PlayerLike | SavePlayerState | null | undefined = (unit as { owner?: PlayerLike }).owner
): string | undefined {
  if (
    unit.type !== 'Villager' ||
    unit.controlMode === 'hero' ||
    unit.isDead ||
    unit.isDestroyed ||
    unit.inventory?.toolsStowed
  )
    return undefined
  const preparation = constructionToolPreparation(unit, owner)
  const tool = unit.inventory?.activeWeapons?.tool
  if (preparation)
    return tool && isEquipmentBroken(tool) && workToolFamily(tool) === preparation.needed[0]
      ? tool
      : `${preparation.needed[0]}_ceramic`
  if (tool) return isEquipmentBroken(tool) && workToolFamily(tool) ? tool : undefined
  if (!unit.villageHome || unit.followingHero || unit.inventory?.equipment?.some(item => workToolFamily(item)))
    return undefined
  return `${toolFamilyForWork(unit.work) ?? 'axe'}_ceramic`
}

function groundToolRecipe(unit: SupplyUnit, owner?: PlayerLike | SavePlayerState | null) {
  const family = workToolFamily(groundToolTarget(unit, owner))
  return family ? HERO_CRAFT_RECIPES.find(recipe => recipe.outputEquipment === `${family}_ceramic`) : undefined
}

function groundToolMaterialCost(unit: SupplyUnit, owner?: PlayerLike | SavePlayerState | null) {
  const recipe = groundToolRecipe(unit, owner)
  if (!recipe) return { wood: 0, stone: 0 }
  const preparation = constructionToolPreparation(unit, owner ?? (unit as { owner?: PlayerLike }).owner)
  // Secure both production tools before spending the last ground materials on the first one.
  const production = preparation?.needed.filter(family => family === 'axe' || family === 'pickaxe') ?? []
  const recipes =
    production.length === 2
      ? production.map(
          family => HERO_CRAFT_RECIPES.find(candidate => candidate.outputEquipment === `${family}_ceramic`)!
        )
      : [recipe]
  const combined = {
    wood: recipes.reduce((sum, candidate) => sum + (candidate.cost.wood ?? 0), 0),
    stone: recipes.reduce((sum, candidate) => sum + (candidate.cost.stone ?? 0), 0),
  }
  const missing = (['wood', 'stone'] as const).reduce(
    (sum, key) => sum + Math.max(0, combined[key] - (unit.inventory?.resources?.[key] ?? 0)),
    0
  )
  // A loaded bag may not fit both tools' ingredients. Craft one paid tool at a time
  // instead of reserving a batch that can never fit; construction still waits.
  return missing <= getUnitResourceCarryRemaining(unit as UnitEntity)
    ? combined
    : { wood: recipe.cost.wood ?? 0, stone: recipe.cost.stone ?? 0 }
}

function missingGroundToolMaterials(
  unit: SupplyUnit,
  owner?: PlayerLike | SavePlayerState | null
): ('wood' | 'stone')[] {
  return groundToolPlan(unit, owner)?.missing ?? []
}

/** Shared intent for visible work, catch-up simulation and dialogue. */
export function groundToolPlan(unit: SupplyUnit, owner?: PlayerLike | SavePlayerState | null) {
  const recipe = groundToolRecipe(unit, owner)
  if (!recipe) return undefined
  const cost = groundToolMaterialCost(unit, owner)
  const missing = (['wood', 'stone'] as const).filter(
    material => (unit.inventory?.resources?.[material] ?? 0) < cost[material]
  )
  return {
    recipe,
    cost,
    missing,
    ready: missing.length === 0,
    bagFull: missing.length > 0 && getUnitResourceCarryRemaining(unit as UnitEntity) < 1,
  }
}

export function craftCarriedStoneTool(
  unit: SupplyUnit,
  owner?: PlayerLike | SavePlayerState | null
): string | undefined {
  const recipe = groundToolRecipe(unit, owner)
  const stock = unit.inventory?.resources
  if (!recipe || !stock || missingGroundToolMaterials(unit, owner).length) return undefined
  for (const key of ['wood', 'stone'] as const) stock[key] = (stock[key] ?? 0) - (recipe.cost[key] ?? 0)
  recordEconomyFlow(unit, 'craftConsumed', recipe.cost)
  recordEconomyFlow(unit, 'craftProduced', { ['item:' + recipe.outputEquipment]: 1 })
  return recipe.outputEquipment
}
