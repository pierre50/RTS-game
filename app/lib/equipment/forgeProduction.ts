import { FORGE_IRON_REQUIRED_LEVEL } from '../../config/forge'
import { getBuildingLevel } from '../buildings/buildingLevel'
import type { ResourceAmount } from '../../types/common'

export type ForgeProductionBuilding = { buildingLevel?: number; assetLevel?: unknown }

/** Check production only: existing equipment and repairs remain usable at any level. */
export function canForgeProduce(
  recipe: { cost: ResourceAmount; outputResource?: string; outputEquipment?: string },
  forge?: ForgeProductionBuilding
): boolean {
  const requiresIron =
    recipe.outputResource === 'ironIngot' ||
    (recipe.cost.ironIngot ?? 0) > 0 ||
    /_iron(?:_|~|$)/.test(recipe.outputEquipment ?? '')
  return !requiresIron || (!!forge && getBuildingLevel(forge) >= FORGE_IRON_REQUIRED_LEVEL)
}
