import { BUILDING_TYPES, UNIT_TYPES } from '../constants'
import { isValidCondition } from '../combat'
import { canUpgradeUnitAtBuilding, getUnitUpgradeTargetForBuilding } from '../units/unitUpgrades'
import type { ResourceAmount } from '../../types/common'
import type { BuildingEntity, UnitEntity } from '../../types/entities'
import type { PlayerLike } from '../../types/player'

const DIRECT_TRAINING_CATEGORIES = new Set(['Civilian'])

export function isTraineeTrainingType(building: BuildingEntity, type: string | undefined): boolean {
  if (!type) return false
  const unit = building.owner?.config.units[type]
  if (!unit || !building.units?.includes(type)) return false
  if (building.type === BUILDING_TYPES.temple && type === UNIT_TYPES.priest) return true
  return !DIRECT_TRAINING_CATEGORIES.has(String(unit.category ?? ''))
}

export function canUnitTrainInto(building: BuildingEntity, unit: UnitEntity, type: string | undefined): boolean {
  if (!type || !building.units?.includes(type)) return false
  if (building.type === BUILDING_TYPES.stable) {
    return unit.type !== UNIT_TYPES.villager && !unit.mountedOnHorse && unit.type === type
  }
  if (unit.type === UNIT_TYPES.villager) return isTraineeTrainingType(building, type)
  return canUpgradeUnitAtBuilding(building.type, unit.type, type)
}

export function getTrainingTargetForUnit(building: BuildingEntity, unit: UnitEntity): string | null {
  if (!building.owner || building.owner !== unit.owner || !building.isBuilt || building.isDead) return null
  if (building.type === BUILDING_TYPES.stable) {
    return canUnitTrainInto(building, unit, unit.type) ? unit.type : null
  }
  if (unit.type !== UNIT_TYPES.villager) {
    const upgradeType = getUnitUpgradeTargetForBuilding(building.type, unit.type)
    return upgradeType && building.units?.includes(upgradeType) ? upgradeType : null
  }
  return getDefaultTraineeTrainingType(building)
}

function getDefaultTraineeTrainingType(building: BuildingEntity): string | null {
  for (const type of building.units || []) {
    if (!isTraineeTrainingType(building, type)) continue
    const config = building.owner?.config.units[type]
    if (!config || !building.owner) continue
    if ((config.conditions || []).some(condition => !isValidCondition(condition, building.owner!))) continue
    return type
  }
  return null
}

export function getMissingResourceNames(owner: PlayerLike, cost: ResourceAmount = {}): (keyof ResourceAmount)[] {
  return (Object.keys(cost) as (keyof ResourceAmount)[]).filter(resource => owner[resource] < (cost[resource] ?? 0))
}
