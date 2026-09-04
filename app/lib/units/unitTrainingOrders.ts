import { ACTION_TYPES, BUILDING_TYPES, UNIT_TYPES } from '../../constants'
import { canUnitTrainInto, getBuildingTrainingLoad, hasBuildingTrainingCapacity } from '../buildings/buildingTraining'
import { instancesDistance } from '../maths'
import { t } from '../lang'
import type { BuildingEntity, UnitEntity } from '../../types/entities'

export const VILLAGER_TRAINING_UNIT_TYPES = [UNIT_TYPES.infantry, UNIT_TYPES.bowman, UNIT_TYPES.priest] as const

function sameOwner(building: BuildingEntity, unit: UnitEntity): boolean {
  return Boolean(
    building.owner === unit.owner ||
      (building.owner?.label && unit.owner?.label && building.owner.label === unit.owner.label)
  )
}

function isUsableTrainingBuilding(building: BuildingEntity, unit: UnitEntity, type: string): boolean {
  return Boolean(
    sameOwner(building, unit) &&
      building.isBuilt &&
      !building.isDead &&
      !building.isDestroyed &&
      building.units?.includes(type) &&
      canUnitTrainInto(building, unit, type) &&
      hasBuildingTrainingCapacity(building)
  )
}

export function findTrainingTypeForUnitAtBuilding(
  unit: UnitEntity,
  building: BuildingEntity,
  allowedTypes: readonly string[] | null = null
): string | null {
  for (const type of building.units ?? []) {
    if (allowedTypes && !allowedTypes.includes(type)) continue
    if (isUsableTrainingBuilding(building, unit, type)) return type
  }
  return null
}

export function findBestTrainingBuildingForUnit(unit: UnitEntity, type: string): BuildingEntity | null {
  const buildings = unit.owner?.buildings ?? []
  let best: BuildingEntity | null = null
  let bestLoad = Infinity
  let bestDistance = Infinity

  for (const building of buildings) {
    if (!isUsableTrainingBuilding(building, unit, type)) continue
    const load = getBuildingTrainingLoad(building)
    const distance = instancesDistance(unit, building)
    if (load > bestLoad) continue
    if (load === bestLoad && distance >= bestDistance) continue
    best = building
    bestLoad = load
    bestDistance = distance
  }

  return best
}

export function sendUnitToTraining(unit: UnitEntity, type: string): boolean {
  const building = findBestTrainingBuildingForUnit(unit, type)
  if (!building) {
    if (unit.owner?.isPlayed) unit.context?.menu?.showMessage(t('noTrainingBuildingAvailable'), 'warning')
    return false
  }

  unit.trainingTargetType = type
  unit.sendToEvt?.(building, ACTION_TYPES.train, { forceRepath: true, allowPassageStop: true })
  return true
}

export function canShowVillagerTrainingMenu(unit: UnitEntity): boolean {
  return (
    unit.type === UNIT_TYPES.villager &&
    VILLAGER_TRAINING_UNIT_TYPES.some(type => findBestTrainingBuildingForUnit(unit, type))
  )
}

export function canShowMountHorseAction(unit: UnitEntity): boolean {
  return Boolean(
    unit.type !== UNIT_TYPES.villager &&
      !unit.mountedOnHorse &&
      findBestTrainingBuildingForUnit(unit, unit.type ?? '')?.type === BUILDING_TYPES.stable
  )
}
