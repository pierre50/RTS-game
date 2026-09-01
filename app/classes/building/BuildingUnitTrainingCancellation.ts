import { refundCost } from '../../lib'
import { refreshOpenBuildingMenu } from './BuildingTechnologyProduction'
import type { UnitCreationExtra, UnitEntity } from '../../types/entities'
import type { BuildingControllerHost } from './BuildingTypes'

type TrainingCancellationHost = {
  activeTrainingTrainee: UnitEntity | null
  activeTrainingExtra: UnitCreationExtra | undefined
  clearActiveTraining(trainee?: UnitEntity | null): void
  placeUnit(type: string, extra?: UnitCreationExtra, options?: { consumePopulationSlot?: boolean }): boolean
  syncPrimaryTrainingState(): void
}

function createRestoredTraineeExtra(trainee: UnitEntity): UnitCreationExtra {
  const extra: UnitCreationExtra = {}
  if (trainee.name) extra.name = trainee.name
  if (trainee.gender) extra.gender = trainee.gender
  if (trainee.appearanceVariants) extra.appearanceVariants = { ...trainee.appearanceVariants }
  if (trainee.mountedOnHorse) extra.mountedOnHorse = true
  if (trainee.horseColor) extra.horseColor = trainee.horseColor
  if (trainee.experience) extra.experience = { ...trainee.experience }
  if (Number.isFinite(Number(trainee.speed))) extra.speed = Number(trainee.speed)
  return extra
}

function restoreCancelledTrainee(host: TrainingCancellationHost, trainee: UnitEntity): void {
  host.placeUnit(trainee.type, createRestoredTraineeExtra(trainee), { consumePopulationSlot: false })
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
  for (const entry of building.trainingQueue ?? []) {
    entry.trainingDayChangeUnsubscribe?.()
    const unit = building.owner.config.units[entry.type]
    if (unit) refundCost(building.owner, entry.cost ?? unit.cost)
    restoreCancelledTrainee(host, entry.trainee)
    typeCounts.set(entry.type, (typeCounts.get(entry.type) ?? 0) + 1)
    cancelled = true
  }
  building.trainingQueue = []
  return { cancelled, typeCounts }
}

function cancelClassicActiveTraining(building: BuildingControllerHost, host: TrainingCancellationHost): boolean {
  const activeType = building.loading !== null ? building.queue[0] : null
  if (!activeType || host.activeTrainingTrainee) return false
  const unit = building.owner.config.units[activeType]
  refundCost(building.owner, unit.cost)
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

function refundRemainingQueue(
  building: BuildingControllerHost,
  trainingEntryTypeCounts: Map<string, number>
): boolean {
  let cancelled = false
  for (const type of building.queue) {
    const traineeCount = trainingEntryTypeCounts.get(type) ?? 0
    if (traineeCount > 0) {
      trainingEntryTypeCounts.set(type, traineeCount - 1)
      continue
    }
    const unit = building.owner.config.units[type]
    if (unit) refundCost(building.owner, unit.cost)
    cancelled = true
  }
  return cancelled
}

function refreshCancelledTrainingUi(building: BuildingControllerHost): void {
  if (!building.owner.isPlayed) return
  building.context.menu.updateTopbar?.()
  for (const type of building.units ?? []) {
    building.context.menu.updateButtonContent(type, '')
  }
  building.updateTrainingPreview?.()
  refreshOpenBuildingMenu(building)
}

export function cancelAllUnitTraining(building: BuildingControllerHost, host: TrainingCancellationHost): boolean {
  let cancelled = cancelPendingTraineeOrders(building)
  const concurrent = cancelConcurrentTrainingEntries(building, host)
  cancelled = concurrent.cancelled || cancelled
  cancelled = cancelClassicActiveTraining(building, host) || cancelled
  cancelled = refundRemainingQueue(building, concurrent.typeCounts) || cancelled

  building.queue = []
  host.syncPrimaryTrainingState()
  if (cancelled) refreshCancelledTrainingUi(building)
  return cancelled
}
