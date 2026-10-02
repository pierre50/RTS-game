import { BUILDING_TRAINING_CAPACITY } from '../training/trainingRules'
import { BUILDING_TYPES, UNIT_TYPES } from '../constants'
import { getMissingPlayerResources, hasPlayerResourceChests } from '../resources/playerResourceTotals'
import type { ResourceAmount } from '../../types/common'
import type { BuildingEntity, UnitEntity } from '../../types/entities'
import type { PlayerLike } from '../../types/player'

const DIRECT_TRAINING_CATEGORIES = new Set(['Civilian'])
export { BUILDING_TRAINING_CAPACITY } from '../training/trainingRules'

type TrainingLoadUnit = {
  dest?: unknown
  trainingTargetType?: string | null
  isDead?: boolean
  isDestroyed?: boolean
}
type TrainingLoadBuilding = {
  buildingUpgrade?: unknown
  trainingQueue?: readonly unknown[]
  queue?: readonly string[]
  loading?: number | null
  trainingUnit?: unknown
  owner?: { units?: readonly TrainingLoadUnit[] } | null
}
type BuildingTrainingLoadOptions = { excludeUnit?: TrainingLoadUnit | null }

export function isTraineeTrainingType(building: BuildingEntity, type: string | undefined): boolean {
  if (!type) return false
  const unit = building.owner?.config?.units?.[type]
  if (!unit || !building.units?.includes(type)) return false
  if (building.type === BUILDING_TYPES.temple && type === UNIT_TYPES.priest) return true
  return !DIRECT_TRAINING_CATEGORIES.has(String(unit.category ?? ''))
}

export function canUnitTrainInto(building: BuildingEntity, unit: UnitEntity, type: string | undefined): boolean {
  if (building.buildingUpgrade || !type || !building.units?.includes(type)) return false
  if (building.type === BUILDING_TYPES.stable) {
    return unit.type !== UNIT_TYPES.villager && !unit.mountedOnHorse && unit.type === type
  }
  if (unit.type === UNIT_TYPES.villager) return isTraineeTrainingType(building, type)
  return false
}

export function getBuildingTrainingLoad(
  building: TrainingLoadBuilding,
  { excludeUnit = null }: BuildingTrainingLoadOptions = {}
): number {
  // queue/loading mirror concurrent entries; counting both would charge each place twice.
  const active =
    building.trainingQueue?.length ||
    Math.max(building.queue?.length ?? 0, building.loading != null || building.trainingUnit ? 1 : 0)
  const incoming =
    building.owner?.units?.filter(
      unit =>
        unit !== excludeUnit &&
        unit.dest === building &&
        Boolean(unit.trainingTargetType) &&
        !unit.isDead &&
        !unit.isDestroyed
    ).length ?? 0
  return active + incoming
}

export function hasBuildingTrainingCapacity(
  building: TrainingLoadBuilding,
  options?: BuildingTrainingLoadOptions
): boolean {
  return !building.buildingUpgrade && getBuildingTrainingLoad(building, options) < BUILDING_TRAINING_CAPACITY
}

export function getMissingResourceNames(
  owner: PlayerLike,
  cost: ResourceAmount = {},
  options: { includeHero?: boolean } = {}
): (keyof ResourceAmount)[] {
  if (hasPlayerResourceChests(owner)) {
    return Object.keys(getMissingPlayerResources(owner, cost, options)) as (keyof ResourceAmount)[]
  }
  return (Object.keys(cost) as (keyof ResourceAmount)[]).filter(resource => owner[resource] < (cost[resource] ?? 0))
}
