import { ACTION_TYPES, POPULATION_MAX } from '../../constants'
import { t } from '../../lib/lang'
import type { UnitCreationExtra, UnitEntity } from '../../types/entities'
import { refreshOpenBuildingMenu } from './BuildingTechnologyProduction'
import { getTrainingBuilding } from './BuildingTraineeTraining'
import type { QueuedTrainingTrainee } from './BuildingTypes'

import type { BuildingProduction } from './BuildingProduction'

export function currentTrainingDay(runtime: BuildingProduction): number {
  return Math.max(1, Math.floor(runtime.building.context.dayNight?.state?.day ?? 1))
}

export function updateTrainingProgress(runtime: BuildingProduction): void {
  const building = getTrainingBuilding(runtime.building)
  if (building.trainingQueue?.length) {
    for (const entry of building.trainingQueue) runtime.updateTrainingEntryProgress(entry)
    runtime.syncPrimaryTrainingState()
    if (building.owner.isPlayed) {
      building.updateTrainingPreview?.()
      refreshOpenBuildingMenu(building)
    }
    return
  }
  if (building.loading === null || building.trainingStartedDay == null || building.trainingCompleteDay == null) return
  const totalDays = Math.max(1, building.trainingCompleteDay - building.trainingStartedDay)
  const elapsedDays = Math.max(0, runtime.currentTrainingDay() - building.trainingStartedDay)
  building.loading = Math.min(100, Math.floor((elapsedDays / totalDays) * 100))
  if (building.owner.isPlayed) {
    building.updateTrainingPreview?.()
    refreshOpenBuildingMenu(building)
  }
}

export function updateTrainingEntryProgress(runtime: BuildingProduction, entry: QueuedTrainingTrainee): void {
  const totalDays = Math.max(1, (entry.trainingCompleteDay ?? 1) - (entry.trainingStartedDay ?? 0))
  const elapsedDays = Math.max(
    0,
    runtime.currentTrainingDay() - (entry.trainingStartedDay ?? runtime.currentTrainingDay())
  )
  entry.loading = Math.min(100, Math.floor((elapsedDays / totalDays) * 100))
}

export function syncPrimaryTrainingState(runtime: BuildingProduction): void {
  const building = getTrainingBuilding(runtime.building)
  const first = building.trainingQueue?.[0]
  if (!first) {
    if (runtime.activeTrainingTrainee) return
    building.trainingUnit = null
    building.trainingType = null
    building.isUsedBy = null
    if (!building.queue.length) {
      building.loading = null
      building.trainingStartedDay = null
      building.trainingCompleteDay = null
    }
    return
  }
  building.trainingUnit = first.trainee
  building.trainingType = first.type
  building.loading = first.loading ?? 0
  building.trainingStartedDay = first.trainingStartedDay ?? null
  building.trainingCompleteDay = first.trainingCompleteDay ?? null
}

export function wakeNextWaitingTrainee(runtime: BuildingProduction): void {
  const building = getTrainingBuilding(runtime.building)
  if (building.loading !== null || building.queue.length || building.technology || building.trainingUnit) return
  const trainee = building.owner.units?.find(
    unit =>
      unit.dest === building &&
      Boolean(unit.trainingTargetType) &&
      !unit.isDead &&
      !unit.isDestroyed &&
      unit.controlMode !== 'hero'
  )
  if (!trainee) return
  trainee.trainingRetryTaskId = null
  if (trainee.isUnitAtDest?.(ACTION_TYPES.train, building)) {
    trainee.getAction?.(ACTION_TYPES.train)
    return
  }
  trainee.sendToEvt?.(building, ACTION_TYPES.train, { forceRepath: true, allowPassageStop: true })
}

export function finishUnitTraining(
  runtime: BuildingProduction,
  type: string,
  extra?: UnitCreationExtra,
  trainee?: UnitEntity | null
): boolean {
  const building = getTrainingBuilding(runtime.building)
  const {
    context: { menu, map },
  } = building

  const trainingEntry = trainee ? building.trainingQueue?.find(entry => entry.trainee === trainee) : null
  const completeDay = trainingEntry?.trainingCompleteDay ?? building.trainingCompleteDay
  if (!trainee && building.queue[0] !== type) return false
  if (!map.instantMode && runtime.currentTrainingDay() < (completeDay ?? Number.POSITIVE_INFINITY)) {
    return false
  }
  if (!trainee && building.owner.population >= Math.min(POPULATION_MAX, building.owner.populationMax)) {
    building.loading = 100
    if (building.owner.isPlayed) {
      menu.showMessage(t('needHouses'), 'warning')
      building.updateTrainingPreview?.()
      refreshOpenBuildingMenu(building)
    }
    return false
  }
  if (!runtime.placeUnit(type, extra, { consumePopulationSlot: !trainee })) {
    if (trainee) {
      runtime.finishTrainingEntryPlacementFailed(trainee)
      runtime.updatePlayedQueueInterface(type)
      return false
    }
    building.trainingDayChangeUnsubscribe?.()
    building.trainingDayChangeUnsubscribe = null
    building.loading = null
    building.trainingStartedDay = null
    building.trainingCompleteDay = null
    if (building.queue[0] === type) building.queue.shift()
    runtime.clearActiveTraining()
    runtime.activeTrainingExtra = undefined
    runtime.activeTrainingTrainee = null
    runtime.updatePlayedQueueInterface(type)
    runtime.wakeNextWaitingTrainee()
    return false
  }

  if (trainee) {
    runtime.finishTrainingEntry(trainee)
  } else {
    building.trainingDayChangeUnsubscribe?.()
    building.trainingDayChangeUnsubscribe = null
    building.loading = null
    building.trainingStartedDay = null
    building.trainingCompleteDay = null
    building.queue.shift()
    runtime.clearActiveTraining()
  }
  runtime.activeTrainingExtra = undefined
  runtime.activeTrainingTrainee = null
  runtime.updatePlayedQueueInterface(type)
  runtime.wakeNextWaitingTrainee()
  return true
}

export function finishTrainingEntry(runtime: BuildingProduction, trainee: UnitEntity): void {
  const building = getTrainingBuilding(runtime.building)
  const index = building.trainingQueue?.findIndex(entry => entry.trainee === trainee) ?? -1
  if (index >= 0) {
    const [entry] = building.trainingQueue?.splice(index, 1) ?? []
    entry?.trainingDayChangeUnsubscribe?.()
    const queueIndex = building.queue.findIndex(type => type === entry?.type)
    if (queueIndex >= 0) building.queue.splice(queueIndex, 1)
  }
  runtime.syncPrimaryTrainingState()
}

export function finishTrainingEntryPlacementFailed(runtime: BuildingProduction, trainee: UnitEntity): void {
  const building = getTrainingBuilding(runtime.building)
  const index = building.trainingQueue?.findIndex(item => item.trainee === trainee) ?? -1
  if (index >= 0) {
    const [entry] = building.trainingQueue?.splice(index, 1) ?? []
    entry?.trainingDayChangeUnsubscribe?.()
    const queueIndex = building.queue.findIndex(type => type === entry?.type)
    if (queueIndex >= 0) building.queue.splice(queueIndex, 1)
    runtime.syncPrimaryTrainingState()
  }
}

export function updatePlayedQueueInterface(runtime: BuildingProduction, type: string): void {
  const building = runtime.building
  if (!building.owner.isPlayed) return
  const still = building.queue.filter((q: string) => q === type).length
  building.context.menu.updateButtonContent(type, still || '')
  building.updateTrainingPreview?.()
  refreshOpenBuildingMenu(building)
}
