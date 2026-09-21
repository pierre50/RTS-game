import { BUILDING_TYPES, UNIT_TYPES } from '../constants'
import { getMissingPlayerResources, hasPlayerResourceChests } from '../resources/playerResourceTotals'
import type { ResourceAmount } from '../../types/common'
import type { BuildingEntity, UnitEntity } from '../../types/entities'
import type { PlayerLike } from '../../types/player'

const DIRECT_TRAINING_CATEGORIES = new Set(['Civilian'])
const BUILDING_TRAINING_CAPACITY = 5

type BuildingTrainingLoadOptions = {
  excludeUnit?: UnitEntity | null
}

export function isTraineeTrainingType(building: BuildingEntity, type: string | undefined): boolean {
  if (!type) return false
  const unit = building.owner?.config?.units?.[type]
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
  return false
}

export function getBuildingTrainingLoad(
  building: BuildingEntity,
  { excludeUnit = null }: BuildingTrainingLoadOptions = {}
): number {
  const parallelTraining = building.trainingQueue?.length ?? 0
  if (parallelTraining > 0) {
    const incoming =
      building.owner?.units?.filter(
        unit =>
          unit !== excludeUnit &&
          unit.dest === building &&
          Boolean(unit.trainingTargetType) &&
          !unit.isDead &&
          !unit.isDestroyed
      ).length ?? 0
    return parallelTraining + incoming
  }
  const hasActiveTraining = building.loading != null || Boolean(building.trainingUnit)
  const active = hasActiveTraining ? 1 : 0
  const queued = Math.max(0, (building.queue?.length ?? 0) - active)
  const incoming =
    building.owner?.units?.filter(
      unit =>
        unit !== excludeUnit &&
        unit.dest === building &&
        Boolean(unit.trainingTargetType) &&
        !unit.isDead &&
        !unit.isDestroyed
    ).length ?? 0
  return active + queued + incoming
}

export function hasBuildingTrainingCapacity(building: BuildingEntity, options?: BuildingTrainingLoadOptions): boolean {
  return getBuildingTrainingLoad(building, options) < BUILDING_TRAINING_CAPACITY
}

export function getMissingResourceNames(owner: PlayerLike, cost: ResourceAmount = {}): (keyof ResourceAmount)[] {
  if (hasPlayerResourceChests(owner)) {
    return Object.keys(getMissingPlayerResources(owner, cost)) as (keyof ResourceAmount)[]
  }
  return (Object.keys(cost) as (keyof ResourceAmount)[]).filter(resource => owner[resource] < (cost[resource] ?? 0))
}
