import { BUILDING_TYPES } from '../../constants'
import { refundCost } from '../../lib'
import { HORSE_TAMING_STATUS } from '../../lib/horses/horseTaming'
import { returnStableHorse } from '../../lib/horses/stableHorses'
import { getUnitTrainingCost } from '../../lib/training/unitTrainingCost'
import { refreshOpenBuildingMenu } from './BuildingMenuRefresh'
import type { UnitCreationExtra } from '../../types/entities'
import type { BuildingControllerHost } from './BuildingTypes'
import type { TrainingTrainee } from '../../types/training'

type TrainingCancellationHost = {
  activeTrainingTrainee: TrainingTrainee | null
  activeTrainingExtra: UnitCreationExtra | undefined
  clearActiveTraining(trainee?: TrainingTrainee | null): void
  placeUnit(type: string, extra?: UnitCreationExtra, options?: { consumePopulationSlot?: boolean }): boolean
  syncPrimaryTrainingState(): void
}

function createRestoredTraineeExtra(trainee: TrainingTrainee): UnitCreationExtra {
  const extra: UnitCreationExtra = {}
  if (trainee.label) extra.label = trainee.label
  if (trainee.inventory) extra.inventory = structuredClone(trainee.inventory)
  if (trainee.hitPoints != null) extra.hitPoints = trainee.hitPoints
  if (trainee.companionHorseColor != null) extra.companionHorseColor = trainee.companionHorseColor
  if (trainee.name) extra.name = trainee.name
  if (trainee.gender) extra.gender = trainee.gender
  if (trainee.appearanceVariants) extra.appearanceVariants = { ...trainee.appearanceVariants }
  if (trainee.mountedOnHorse) extra.mountedOnHorse = true
  if (trainee.horseColor) extra.horseColor = trainee.horseColor
  if (trainee.experience) extra.experience = { ...trainee.experience }
  if (Number.isFinite(Number(trainee.speed))) extra.speed = Number(trainee.speed)
  return extra
}

function restoreCancelledTrainee(host: TrainingCancellationHost, trainee: TrainingTrainee): boolean {
  return host.placeUnit(trainee.type, createRestoredTraineeExtra(trainee), { consumePopulationSlot: false })
}

function restoreCancelledStableHorse(building: BuildingControllerHost, extra: UnitCreationExtra | undefined): void {
  if (building.type !== BUILDING_TYPES.stable || !extra?.mountedOnHorse) return
  returnStableHorse(building, { horseColor: extra.horseColor, tamingStatus: HORSE_TAMING_STATUS.tamed })
}

function cancelPendingTraineeOrders(building: BuildingControllerHost): boolean {
  let cancelled = false
  for (const unit of [...(building.owner.units ?? [])]) {
    if (unit.dest !== building || !unit.trainingTargetType || unit.isDead) continue
    unit.trainingTargetType = null
    unit.affectNewDest?.()
    cancelled = true
  }
  return cancelled
}

function cancelConcurrentTrainingEntries(
  building: BuildingControllerHost,
  host: TrainingCancellationHost
): { cancelled: boolean; typeCounts: Map<string, number> } {
  const typeCounts = new Map<string, number>()
  let cancelled = false
  for (const entry of [...(building.trainingQueue ?? [])]) {
    typeCounts.set(entry.type, (typeCounts.get(entry.type) ?? 0) + 1)
    if (!restoreCancelledTrainee(host, entry.trainee)) continue
    entry.trainingDayChangeUnsubscribe?.()
    const unit = building.owner.config.units[entry.type]
    if (unit) refundCost(building.owner, entry.cost ?? getUnitTrainingCost(building.owner, entry.type))
    restoreCancelledStableHorse(building, entry.extra)
    building.trainingQueue?.splice(building.trainingQueue.indexOf(entry), 1)
    cancelled = true
  }
  return { cancelled, typeCounts }
}

function cancelClassicActiveTraining(building: BuildingControllerHost, host: TrainingCancellationHost): boolean {
  const activeType = building.loading !== null ? building.queue[0] : null
  if (!activeType || host.activeTrainingTrainee) return false
  refundCost(building.owner, getUnitTrainingCost(building.owner, activeType))
  building.trainingDayChangeUnsubscribe?.()
  building.trainingDayChangeUnsubscribe = null
  building.loading = null
  building.trainingStartedDay = null
  building.trainingCompleteDay = null
  building.queue.shift()
  host.clearActiveTraining()
  host.activeTrainingExtra = undefined
  host.activeTrainingTrainee = null
  return true
}

function refundRemainingQueue(building: BuildingControllerHost, trainingEntryTypeCounts: Map<string, number>): boolean {
  let cancelled = false
  for (const type of building.queue) {
    const traineeCount = trainingEntryTypeCounts.get(type) ?? 0
    if (traineeCount > 0) {
      trainingEntryTypeCounts.set(type, traineeCount - 1)
      continue
    }
    const unit = building.owner.config.units[type]
    if (unit) refundCost(building.owner, getUnitTrainingCost(building.owner, type))
    cancelled = true
  }
  return cancelled
}

function refreshCancelledTrainingUi(building: BuildingControllerHost): void {
  if (!building.owner.isPlayed) return
  building.context.menu.updateTopbar?.()
  for (const type of building.units ?? []) {
    building.context.menu.updateButtonContent(type, building.queue.filter(queued => queued === type).length || '')
  }
  building.updateTrainingPreview?.()
  refreshOpenBuildingMenu(building)
}

export function cancelAllUnitTraining(building: BuildingControllerHost, host: TrainingCancellationHost): boolean {
  let cancelled = cancelPendingTraineeOrders(building)
  const concurrent = cancelConcurrentTrainingEntries(building, host)
  cancelled = concurrent.cancelled || cancelled
  if (!concurrent.typeCounts.size) cancelled = cancelClassicActiveTraining(building, host) || cancelled
  cancelled = refundRemainingQueue(building, concurrent.typeCounts) || cancelled

  building.queue = (building.trainingQueue ?? []).map(entry => entry.type)
  host.syncPrimaryTrainingState()
  if (cancelled) refreshCancelledTrainingUi(building)
  return cancelled
}
