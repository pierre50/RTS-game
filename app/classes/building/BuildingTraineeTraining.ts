import {
  ACTION_TYPES,
  BUILDING_TYPES,
  FADE_DURATION_MS,
  MOUNTED_HORSE_SPEED_BONUS,
  UNIT_TYPES,
} from '../../constants'
import { canAfford, payCost } from '../../lib'
import { fadeOut } from '../../lib/entityFade'
import { canUnitTrainInto, getMissingResourceNames, isTraineeTrainingType } from '../../lib/buildingTraining'
import { hasLivingChief, playerNeedsChiefForCommand } from '../../lib/chief'
import { t } from '../../lib/lang'
import { consumeStableHorse, returnStableHorse, type StableHorse } from '../../lib/stableHorses'
import type { UnitCreationExtra, UnitEntity } from '../../types/entities'
import type { ResourceAmount } from '../../types/common'
import type { BuildingControllerHost, TrainingBuilding } from './BuildingTypes'

export function getTrainingBuilding(building: BuildingControllerHost): TrainingBuilding {
  return building as TrainingBuilding
}

function isAvailableTrainingUnit(unit: UnitEntity): boolean {
  return Boolean(
    !unit.isDead && !unit.isDestroyed && !unit.actionLocked && unit.controlMode !== 'hero' && !unit.trainingTargetType
  )
}

function isExpectedTrainingUnit(unit: UnitEntity, type: string): boolean {
  return Boolean(
    unit.trainingTargetType === type && !unit.isDead && !unit.isDestroyed && unit.controlMode !== 'hero'
  )
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

export function getProductionTime(
  building: TrainingBuilding,
  unit: { trainingTime?: number },
  trainee: UnitEntity | null | undefined,
  type: string
): number {
  return isStableMountTraining(building, trainee, type)
    ? (building.mountingTime ?? unit.trainingTime ?? 0)
    : (unit.trainingTime ?? 0)
}

function getTrainingExtra(
  building: BuildingControllerHost,
  trainee: UnitEntity,
  type: string,
  stableHorse?: StableHorse | null
): UnitCreationExtra | undefined {
  const baseExtra: UnitCreationExtra = {}
  if (trainee.name) baseExtra.name = trainee.name
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

function refreshOpenBuildingMenu(building: BuildingControllerHost): void {
  const menu = building.context.menu
  if (menu.getHeroBuildingMenuTarget?.() === building) {
    menu.refreshHeroBuildingMenu?.()
  }
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

export function findTrainingUnit(building: BuildingControllerHost, type: string): UnitEntity | null {
  const { owner } = building
  const isEligible = (unit: UnitEntity) => isAvailableTrainingUnit(unit) && canUnitTrainInto(building, unit, type)
  const selectedUnit = owner.selectedUnits?.find(isEligible)
  if (selectedUnit) return selectedUnit
  return owner.units.find(unit => isEligible(unit) && unit.inactif) || owner.units.find(isEligible) || null
}

export function clearActiveTraining(building: BuildingControllerHost, trainee?: UnitEntity | null): void {
  const trainingBuilding = getTrainingBuilding(building)
  if (trainee && trainingBuilding.trainingUnit && trainingBuilding.trainingUnit !== trainee) return
  trainingBuilding.trainingUnit = null
  trainingBuilding.trainingType = null
  if (!trainee || trainingBuilding.isUsedBy === trainee) trainingBuilding.isUsedBy = null
}

export function cancelTrainingForUnit(building: BuildingControllerHost, trainee: UnitEntity): boolean {
  const type = trainee.trainingTargetType
  if (!type || !canUnitTrainInto(building, trainee, type)) return false
  trainee.trainingTargetType = null
  if (getTrainingBuilding(building).trainingUnit === trainee) clearActiveTraining(building, trainee)
  if (building.owner.isPlayed) refreshOpenBuildingMenu(building)
  return true
}

export function cancelPendingTraining(building: BuildingControllerHost, type?: string): boolean {
  if (building.loading !== null || building.queue.length) return false
  const candidates = building.owner.units.filter(
    unit =>
      unit.dest === building &&
      !!unit.trainingTargetType &&
      (!type || unit.trainingTargetType === type) &&
      canUnitTrainInto(building, unit, unit.trainingTargetType)
  )
  if (!candidates.length) return false
  for (const unit of candidates) {
    unit.trainingTargetType = null
    unit.affectNewDest?.()
  }
  if (building.owner.isPlayed) {
    const { menu } = building.context
    if (type) {
      menu.updateButtonContent(type, '')
      menu.toggleQueuedActionCancel(type, false)
    }
    refreshOpenBuildingMenu(building)
  }
  return true
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
  buyUnit: (type: string, alreadyPaid: boolean, force: boolean, extra?: UnitCreationExtra, trainee?: UnitEntity) => boolean | undefined
): boolean {
  const trainingBuilding = getTrainingBuilding(building)
  const type = trainee.trainingTargetType
  if (!type || !isTraineeTrainingType(building, type)) return false
  if (building.loading !== null || building.queue.length || building.technology) return false
  if (!isExpectedTrainingUnit(trainee, type) || !canUnitTrainInto(building, trainee, type)) return false
  if (isBlockedByMissingChief(building, type)) return failTraineeEntry(building, trainee, t('requiresChief'))

  const unit = building.owner.config.units[type]
  const stableHorse = isStableMountTraining(building, trainee, type) ? consumeStableHorse(building) : null
  if (isStableMountTraining(building, trainee, type) && !stableHorse) {
    return failTraineeEntry(building, trainee, t('stableNeedsHorse'))
  }

  const cost = getTrainingCost(building, unit, trainee, type)
  if (!canAfford(building.owner, cost)) {
    returnStableHorse(building, stableHorse)
    return failTraineeEntry(building, trainee, t('needMore', { resource: formatMissingResources(building.owner, cost) }), true)
  }

  payCost(building.owner, cost)
  if (building.owner.isPlayed) building.context.menu.updateTopbar()
  trainingBuilding.trainingUnit = trainee
  trainingBuilding.trainingType = type
  trainingBuilding.isUsedBy = trainee
  removeTraineeForTraining(trainee)
  const started = Boolean(buyUnit(type, true, false, getTrainingExtra(building, trainee, type, stableHorse), trainee))
  if (!started) returnStableHorse(building, stableHorse)
  return started
}

export function requestUnitTraining(
  building: BuildingControllerHost,
  type: string,
  traineeOverride?: UnitEntity | null
): boolean {
  const {
    context: { menu },
  } = building
  const unit = building.owner.config.units[type]
  if (!unit || !building.units?.includes(type)) return false
  if (!building.isBuilt || building.isDead) return false
  const trainee = traineeOverride || findTrainingUnit(building, type)
  if (!trainee) {
    if (building.owner.isPlayed) menu.showMessage(t('noTrainingUnitAvailable'), 'warning')
    return false
  }
  if (!isAvailableTrainingUnit(trainee) || !canUnitTrainInto(building, trainee, type)) {
    if (building.owner.isPlayed) menu.showMessage(t('onlyEligibleUnitsCanTrain'), 'warning')
    return false
  }
  trainee.trainingTargetType = type
  if (building.owner.isPlayed) {
    menu.updateButtonContent(type, '')
    menu.toggleQueuedActionCancel(type, true)
    refreshOpenBuildingMenu(building)
  }
  trainee.sendToEvt?.(building, ACTION_TYPES.train, { forceRepath: true })
  return true
}
