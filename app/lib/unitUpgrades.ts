import { BUILDING_TYPES, UNIT_TYPES } from '../constants'

const BUILDING_UNIT_UPGRADE_CHAINS: Partial<Record<string, string[]>> = {
  [BUILDING_TYPES.barracks]: [
    UNIT_TYPES.clubman,
    UNIT_TYPES.axeman,
    UNIT_TYPES.shortSwordsman,
    UNIT_TYPES.broadSwordsman,
    UNIT_TYPES.longSwordsman,
  ],
  [BUILDING_TYPES.archeryRange]: [UNIT_TYPES.bowman, UNIT_TYPES.improvedBowman, UNIT_TYPES.compositeBowman],
}

export function getUnitUpgradeTargetForBuilding(
  buildingType: string | undefined,
  unitType: string | undefined
): string | null {
  const chain = buildingType ? BUILDING_UNIT_UPGRADE_CHAINS[buildingType] : undefined
  if (!chain || !unitType) return null
  const index = chain.indexOf(unitType)
  if (index < 0 || index >= chain.length - 1) return null
  return chain[index + 1]
}

export function canUpgradeUnitAtBuilding(
  buildingType: string | undefined,
  unitType: string | undefined,
  targetType: string | undefined
): boolean {
  return getUnitUpgradeTargetForBuilding(buildingType, unitType) === targetType
}
