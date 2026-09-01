import { BUILDING_TYPES, FADE_DURATION_MS, MOUNTED_HORSE_SPEED_BONUS, UNIT_TYPES } from '../../constants'
import { canAfford, payCost } from '../../lib'
import { fadeOut } from '../../lib/entities/entityFade'
import {
  canUnitTrainInto,
  getMissingResourceNames,
  hasBuildingTrainingCapacity,
  isTraineeTrainingType,
} from '../../lib/buildings/buildingTraining'
import { hasLivingChief, playerNeedsChiefForCommand } from '../../lib/chief'
import { t } from '../../lib/lang'
import { consumeStableHorse, returnStableHorse, type StableHorse } from '../../lib/horses/stableHorses'
import type { UnitCreationExtra, UnitEntity } from '../../types/entities'
import type { ResourceAmount } from '../../types/common'
import type { BuildingControllerHost, TrainingBuilding } from './BuildingTypes'

export function getTrainingBuilding(building: BuildingControllerHost): TrainingBuilding {
  return building as TrainingBuilding
}

function isExpectedTrainingUnit(unit: UnitEntity, type: string): boolean {
  return Boolean(unit.trainingTargetType === type && !unit.isDead && !unit.isDestroyed && unit.controlMode !== 'hero')
}

function isStableMountTraining(
  building: BuildingControllerHost,
  trainee: UnitEntity | null | undefined,
  type: string
): boolean {
  return Boolean(building.type === BUILDING_TYPES.stable && trainee && trainee.type === type && !trainee.mountedOnHorse)
}

function getTrainingCost(
  building: BuildingControllerHost,
  unit: { cost?: ResourceAmount },
  trainee: UnitEntity,
  type: string
): ResourceAmount {
  return isStableMountTraining(building, trainee, type) ? {} : (unit.cost ?? {})
}

export function getTrainingDays(
  building: TrainingBuilding,
  unit: { trainingDays?: number },
  trainee: UnitEntity | null | undefined,
  type: string
): number {
  return isStableMountTraining(building, trainee, type)
    ? (building.mountingDays ?? unit.trainingDays ?? 1)
    : (unit.trainingDays ?? 1)
}

function getTrainingExtra(
  building: BuildingControllerHost,
  trainee: UnitEntity,
  type: string,
  stableHorse?: StableHorse | null
): UnitCreationExtra | undefined {
  const baseExtra: UnitCreationExtra = {}
  if (trainee.name) baseExtra.name = trainee.name
  if (trainee.gender) baseExtra.gender = trainee.gender
  if (trainee.appearanceVariants) baseExtra.appearanceVariants = { ...trainee.appearanceVariants }
  if (trainee.mountedOnHorse) {
    baseExtra.mountedOnHorse = true
    if (trainee.horseColor) baseExtra.horseColor = trainee.horseColor
    const traineeSpeed = Number(trainee.speed)
    if (Number.isFinite(traineeSpeed)) baseExtra.speed = traineeSpeed
  }
  if (!isStableMountTraining(building, trainee, type)) return { ...baseExtra, experience: {} }
  const traineeSpeed = Number(trainee.speed)
  const mountedExtra: UnitCreationExtra = {
    ...baseExtra,
    mountedOnHorse: true,
    hitPoints: trainee.hitPoints,
    speed: Number.isFinite(traineeSpeed) ? traineeSpeed + MOUNTED_HORSE_SPEED_BONUS : undefined,
    experience: trainee.experience ? { ...trainee.experience } : undefined,
  }
  mountedExtra.horseColor = stableHorse?.horseColor ?? trainee.horseColor
  return mountedExtra
}

function formatMissingResources(owner: BuildingControllerHost['owner'], cost: ResourceAmount = {}): string {
  const missing = getMissingResourceNames(owner, cost)
  return missing.map(resource => t(resource)).join(', ')
}

export function isBlockedByMissingChief(building: BuildingControllerHost, type: string): boolean {
  if (!playerNeedsChiefForCommand(building.owner)) return false
  if (type === UNIT_TYPES.villager) return !hasLivingChief(building.owner)
  if (isTraineeTrainingType(building, type)) return !hasLivingChief(building.owner)
  return false
}

export function removeTraineeForTraining(trainee: UnitEntity): void {
  const map = trainee.context?.map
  const owner = trainee.owner
  trainee.stopInterval?.()
  trainee.stopTimeout?.()
  trainee.path = []
  trainee.dest = null
  trainee.realDest = null
  trainee.previousDest = null
  trainee.previousWork = null
  trainee.pendingOrder = null
  trainee.blockedGatherApproach = null
  trainee.inactif = false
  trainee.trainingTargetType = null
  if (trainee.selected && owner?.isPlayed) owner.unselectUnit?.(trainee)
  trainee.unselect?.()
  if (trainee.currentCell?.has === trainee) {
    trainee.currentCell.has = null
    trainee.currentCell.solid = false
  }
  map?.removeFromInstanceBucket?.(trainee)
  const index = owner?.units.indexOf(trainee) ?? -1
  if (index >= 0) owner?.units.splice(index, 1)
  fadeOut(trainee, FADE_DURATION_MS, () => {
    map?.removeChild?.(trainee)
    trainee.destroy?.({ children: true, texture: false })
  })
}

export function clearActiveTraining(building: BuildingControllerHost, trainee?: UnitEntity | null): void {
  const trainingBuilding = getTrainingBuilding(building)
  if (trainee && trainingBuilding.trainingUnit && trainingBuilding.trainingUnit !== trainee) return
  trainingBuilding.trainingUnit = null
  trainingBuilding.trainingType = null
  trainingBuilding.trainingStartedDay = null
  trainingBuilding.trainingCompleteDay = null
  if (!trainee || trainingBuilding.isUsedBy === trainee) trainingBuilding.isUsedBy = null
}

export function failTraineeEntry(
  building: BuildingControllerHost,
  trainee: UnitEntity,
  message?: string,
  updateTopbar = false
): false {
  if (message && building.owner.isPlayed) building.context.menu.showMessage(message, 'warning')
  if (updateTopbar && building.owner.isPlayed) building.context.menu.updateTopbar?.()
  trainee.trainingTargetType = null
  clearActiveTraining(building, trainee)
  return false
}

export function startTrainingWithUnit(
  building: BuildingControllerHost,
  trainee: UnitEntity,
  buyUnit: (
    type: string,
    alreadyPaid: boolean,
    force: boolean,
    extra?: UnitCreationExtra,
    trainee?: UnitEntity
  ) => boolean | undefined
): boolean {
  const type = trainee.trainingTargetType
  if (!type || !isTraineeTrainingType(building, type)) return false
  if (!hasBuildingTrainingCapacity(building, { excludeUnit: trainee })) return false
  if (!isExpectedTrainingUnit(trainee, type) || !canUnitTrainInto(building, trainee, type)) return false
  if (isBlockedByMissingChief(building, type)) return failTraineeEntry(building, trainee, t('requiresChief'))
  if (building.technology) return false

  const unit = building.owner.config.units[type]
  const stableHorse = isStableMountTraining(building, trainee, type) ? consumeStableHorse(building) : null
  if (isStableMountTraining(building, trainee, type) && !stableHorse) {
    return failTraineeEntry(building, trainee, t('stableNeedsHorse'))
  }

  const cost = getTrainingCost(building, unit, trainee, type)
  if (!canAfford(building.owner, cost)) {
    returnStableHorse(building, stableHorse)
    return failTraineeEntry(
      building,
      trainee,
      t('needMore', { resource: formatMissingResources(building.owner, cost) }),
      true
    )
  }

  payCost(building.owner, cost)
  if (building.owner.isPlayed) building.context.menu.updateTopbar()
  removeTraineeForTraining(trainee)
  const started = Boolean(buyUnit(type, true, false, getTrainingExtra(building, trainee, type, stableHorse), trainee))
  if (!started) returnStableHorse(building, stableHorse)
  return started
}
