import { BUILDING_TYPES, UNIT_TYPES } from '../constants'

const STABLE_MOUNTABLE_UNITS = new Set([
  UNIT_TYPES.infantry,
  UNIT_TYPES.bowman,
])

export function getUnitUpgradeTargetForBuilding(
  buildingType: string | undefined,
  unitType: string | undefined
): string | null {
  if (buildingType === BUILDING_TYPES.stable && unitType && STABLE_MOUNTABLE_UNITS.has(unitType)) return unitType
  return null
}

export function canUpgradeUnitAtBuilding(
  buildingType: string | undefined,
  unitType: string | undefined,
  targetType: string | undefined
): boolean {
  return getUnitUpgradeTargetForBuilding(buildingType, unitType) === targetType
}
