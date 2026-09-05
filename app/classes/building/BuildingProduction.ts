import { ACTION_TYPES, POPULATION_MAX } from '../../constants'
import { canAfford, isAIControlledPlayer, payCost, refundCost } from '../../lib'
import { hasBuildingTrainingCapacity, isTraineeTrainingType } from '../../lib/buildings/buildingTraining'
import { t } from '../../lib/lang'
import { getUnitTrainingCost } from '../../lib/training/unitTrainingCost'
import {
  clearActiveTraining,
  failTraineeEntry,
  getTrainingDays,
  getTrainingBuilding,
  isBlockedByMissingChief,
  removeTraineeForTraining as removeTrainingUnitFromMap,
  startTrainingWithUnit,
} from './BuildingTraineeTraining'
import { ejectTrainingVillager, placeProducedUnit } from './BuildingProductionPlacement'
import { cancelAllUnitTraining as cancelAllBuildingUnitTraining } from './BuildingUnitTrainingCancellation'
import {
  buyBuildingTechnology,
  cancelBuildingTechnology,
  refreshOpenBuildingMenu,
  upgradeBuilding,
} from './BuildingTechnologyProduction'
import type { UnitCreationExtra, UnitEntity } from '../../types/entities'
import type { BuildingControllerHost, QueuedTrainingTrainee } from './BuildingTypes'

export class BuildingProduction {
  building: BuildingControllerHost
  activeTrainingExtra: UnitCreationExtra | undefined
  activeTrainingTrainee: UnitEntity | null

  constructor(building: BuildingControllerHost) {
    this.building = building
    this.activeTrainingExtra = undefined
    this.activeTrainingTrainee = null
  }

  placeUnit(type: string, extra?: UnitCreationExtra, options: { consumePopulationSlot?: boolean } = {}): boolean {
    const building = this.building
    const placed = placeProducedUnit(building, type, extra, options)
    if (!placed) return false
    if (building.owner.isPlayed) refreshOpenBuildingMenu(building)
    return true
  }

  removeTraineeForTraining(trainee: UnitEntity): void {
    removeTrainingUnitFromMap(trainee)
  }

  clearActiveTraining(trainee?: UnitEntity | null): void {
    clearActiveTraining(this.building, trainee)
  }

  ejectTrainee(): void {
    ejectTrainingVillager(this.building)
  }

  cancelActiveTraining(type: string): boolean {
    const building = getTrainingBuilding(this.building)
    if (building.loading === null || building.queue[0] !== type) return false
    building.trainingDayChangeUnsubscribe?.()
    building.trainingDayChangeUnsubscribe = null
    building.loading = null
    building.trainingStartedDay = null
    building.trainingCompleteDay = null
    building.queue.shift()
    refundCost(building.owner, getUnitTrainingCost(building.owner, type))
    this.activeTrainingExtra = undefined
    this.activeTrainingTrainee = null
    this.ejectTrainee()
    this.clearActiveTraining()
    if (building.owner.isPlayed) {
      const { menu } = building.context
      menu.updateTopbar()
      menu.updateButtonContent(type, '')
      building.updateTrainingPreview?.()
      refreshOpenBuildingMenu(building)
    }
    return true
  }

  cancelAllUnitTraining(): boolean {
    return cancelAllBuildingUnitTraining(getTrainingBuilding(this.building), this)
  }

  currentTrainingDay(): number {
    return Math.max(1, Math.floor(this.building.context.dayNight?.state?.day ?? 1))
  }

  updateTrainingProgress(): void {
    const building = getTrainingBuilding(this.building)
    if (building.trainingQueue?.length) {
      for (const entry of building.trainingQueue) this.updateTrainingEntryProgress(entry)
      this.syncPrimaryTrainingState()
      if (building.owner.isPlayed) {
        building.updateTrainingPreview?.()
        refreshOpenBuildingMenu(building)
      }
      return
    }
    if (building.loading === null || building.trainingStartedDay == null || building.trainingCompleteDay == null) return
    const totalDays = Math.max(1, building.trainingCompleteDay - building.trainingStartedDay)
    const elapsedDays = Math.max(0, this.currentTrainingDay() - building.trainingStartedDay)
    building.loading = Math.min(100, Math.floor((elapsedDays / totalDays) * 100))
    if (building.owner.isPlayed) {
      building.updateTrainingPreview?.()
      refreshOpenBuildingMenu(building)
    }
  }

  updateTrainingEntryProgress(entry: QueuedTrainingTrainee): void {
    const totalDays = Math.max(1, (entry.trainingCompleteDay ?? 1) - (entry.trainingStartedDay ?? 0))
    const elapsedDays = Math.max(0, this.currentTrainingDay() - (entry.trainingStartedDay ?? this.currentTrainingDay()))
    entry.loading = Math.min(100, Math.floor((elapsedDays / totalDays) * 100))
  }

  syncPrimaryTrainingState(): void {
    const building = getTrainingBuilding(this.building)
    const first = building.trainingQueue?.[0]
    if (!first) {
      if (this.activeTrainingTrainee) return
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

  wakeNextWaitingTrainee(): void {
    const building = getTrainingBuilding(this.building)
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

  finishUnitTraining(type: string, extra?: UnitCreationExtra, trainee?: UnitEntity | null): boolean {
    const building = getTrainingBuilding(this.building)
    const {
      context: { menu, map },
    } = building

    const trainingEntry = trainee ? building.trainingQueue?.find(entry => entry.trainee === trainee) : null
    const completeDay = trainingEntry?.trainingCompleteDay ?? building.trainingCompleteDay
    if (!trainee && building.queue[0] !== type) return false
    if (!map.instantMode && this.currentTrainingDay() < (completeDay ?? Number.POSITIVE_INFINITY)) {
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
    if (!this.placeUnit(type, extra, { consumePopulationSlot: !trainee })) {
      if (trainee) {
        this.finishTrainingEntryPlacementFailed(trainee)
        this.updatePlayedQueueInterface(type)
        return false
      }
      building.trainingDayChangeUnsubscribe?.()
      building.trainingDayChangeUnsubscribe = null
      building.loading = null
      building.trainingStartedDay = null
      building.trainingCompleteDay = null
      if (building.queue[0] === type) building.queue.shift()
      this.clearActiveTraining()
      this.activeTrainingExtra = undefined
      this.activeTrainingTrainee = null
      this.updatePlayedQueueInterface(type)
      this.wakeNextWaitingTrainee()
      return false
    }

    if (trainee) {
      this.finishTrainingEntry(trainee)
    } else {
      building.trainingDayChangeUnsubscribe?.()
      building.trainingDayChangeUnsubscribe = null
      building.loading = null
      building.trainingStartedDay = null
      building.trainingCompleteDay = null
      building.queue.shift()
      this.clearActiveTraining()
    }
    this.activeTrainingExtra = undefined
    this.activeTrainingTrainee = null
    this.updatePlayedQueueInterface(type)
    this.wakeNextWaitingTrainee()
    return true
  }

  finishTrainingEntry(trainee: UnitEntity): void {
    const building = getTrainingBuilding(this.building)
    const index = building.trainingQueue?.findIndex(entry => entry.trainee === trainee) ?? -1
    if (index >= 0) {
      const [entry] = building.trainingQueue?.splice(index, 1) ?? []
      entry?.trainingDayChangeUnsubscribe?.()
      const queueIndex = building.queue.findIndex(type => type === entry?.type)
      if (queueIndex >= 0) building.queue.splice(queueIndex, 1)
    }
    this.syncPrimaryTrainingState()
  }

  finishTrainingEntryPlacementFailed(trainee: UnitEntity): void {
    const building = getTrainingBuilding(this.building)
    const index = building.trainingQueue?.findIndex(item => item.trainee === trainee) ?? -1
    if (index >= 0) {
      const [entry] = building.trainingQueue?.splice(index, 1) ?? []
      entry?.trainingDayChangeUnsubscribe?.()
      const queueIndex = building.queue.findIndex(type => type === entry?.type)
      if (queueIndex >= 0) building.queue.splice(queueIndex, 1)
      this.syncPrimaryTrainingState()
    }
  }

  updatePlayedQueueInterface(type: string): void {
    const building = this.building
    if (!building.owner.isPlayed) return
    const still = building.queue.filter((q: string) => q === type).length
    building.context.menu.updateButtonContent(type, still || '')
    building.updateTrainingPreview?.()
    refreshOpenBuildingMenu(building)
  }

  startUnitTraining(
    type: string,
    unit: { trainingDays?: number },
    force: boolean,
    extra?: UnitCreationExtra,
    trainee?: UnitEntity | null
  ): void {
    const building = getTrainingBuilding(this.building)
    if (trainee) {
      this.startConcurrentTraineeTraining(type, unit, extra, trainee)
      return
    }
    this.activeTrainingExtra = extra
    this.activeTrainingTrainee = trainee ?? null

    if (!force || building.trainingStartedDay == null || building.trainingCompleteDay == null) {
      const startDay = this.currentTrainingDay()
      const durationDays = Math.max(0, Math.ceil(getTrainingDays(building, unit, trainee, type)))
      building.trainingStartedDay = startDay
      building.trainingCompleteDay = startDay + durationDays
    }

    building.loading = 0
    this.updateTrainingProgress()
    building.trainingDayChangeUnsubscribe?.()
    building.trainingDayChangeUnsubscribe =
      building.context.dayNight?.onDayChange?.(() => {
        this.updateTrainingProgress()
        this.finishUnitTraining(type, this.activeTrainingExtra, this.activeTrainingTrainee)
      }) ?? null

    this.finishUnitTraining(type, extra, trainee)
  }

  startConcurrentTraineeTraining(
    type: string,
    unit: { trainingDays?: number },
    extra: UnitCreationExtra | undefined,
    trainee: UnitEntity
  ): void {
    const building = getTrainingBuilding(this.building)
    const startDay = this.currentTrainingDay()
    const durationDays = Math.max(0, Math.ceil(getTrainingDays(building, unit, trainee, type)))
    const entry: QueuedTrainingTrainee = {
      type,
      trainee,
      extra,
      loading: 0,
      trainingStartedDay: startDay,
      trainingCompleteDay: startDay + durationDays,
    }
    building.trainingQueue = building.trainingQueue ?? []
    building.trainingQueue.push(entry)
    building.queue.push(type)
    this.updateTrainingEntryProgress(entry)
    this.syncPrimaryTrainingState()
    entry.trainingDayChangeUnsubscribe =
      building.context.dayNight?.onDayChange?.(() => {
        this.updateTrainingEntryProgress(entry)
        this.syncPrimaryTrainingState()
        this.finishUnitTraining(type, extra, trainee)
        if (building.owner.isPlayed) {
          building.updateTrainingPreview?.()
          refreshOpenBuildingMenu(building)
        }
      }) ?? null
    if (building.owner.isPlayed) {
      building.context.menu.updateButtonContent(
        type,
        building.queue.filter((queuedType: string) => queuedType === type).length
      )
      building.updateTrainingPreview?.()
      refreshOpenBuildingMenu(building)
    }
    this.finishUnitTraining(type, extra, trainee)
  }

  failTraineeEntry(trainee: UnitEntity, message?: string, updateTopbar = false): false {
    return failTraineeEntry(this.building, trainee, message, updateTopbar)
  }

  startTrainingWithUnit(trainee: UnitEntity): boolean {
    return startTrainingWithUnit(this.building, trainee, (type, alreadyPaid, force, extra, unit) =>
      this.buyUnit(type, alreadyPaid, force, extra, unit)
    )
  }

  buyUnit(
    type: string,
    alreadyPaid = false,
    force = false,
    extra?: UnitCreationExtra,
    trainee?: UnitEntity | null
  ): boolean | undefined {
    const building = this.building
    const {
      context: { menu },
    } = building
    let success = false
    const unit = building.owner.config.units[type]
    const cost = getUnitTrainingCost(building.owner, type)
    const traineeTraining = isTraineeTrainingType(building, type)
    if (traineeTraining && !alreadyPaid && !force) {
      return false
    }
    if (isBlockedByMissingChief(building, type)) {
      if (building.owner.isPlayed) menu.showMessage(t('requiresChief'), 'warning')
      return false
    }
    if (!alreadyPaid && !hasBuildingTrainingCapacity(building, { excludeUnit: trainee ?? null })) return false
    if (building.isBuilt && !building.isDead && (canAfford(building.owner, cost) || alreadyPaid)) {
      if (!alreadyPaid) {
        if (isAIControlledPlayer(building.owner)) {
          if (!building.queue.length && building.loading === null) {
            payCost(building.owner, cost)
            building.queue.push(type)
            success = true
          }
        } else {
          payCost(building.owner, cost)
          building.queue.push(type)
          if (building.selected && building.owner.isPlayed) {
            menu.updateButtonContent(type, building.queue.filter((q: string) => q === type).length)
          }
          building.owner.isPlayed && menu.updateTopbar()
          success = true
        }
      } else if (traineeTraining && trainee) {
        this.startUnitTraining(type, unit, force, extra, trainee)
        return true
      } else if (alreadyPaid) {
        success = true
      }
      if ((building.loading === null && building.queue[0]) || force) {
        this.startUnitTraining(type, unit, force, extra, trainee)
      }
      return success
    }
  }

  cancelUnits(type: string): boolean {
    const building = this.building
    const unit = building.owner.config.units[type]
    if (!unit) return false
    if (isTraineeTrainingType(building, type)) {
      return false
    }

    const cancelled = building.queue.filter((queuedType: string) => queuedType === type).length
    if (!cancelled) return false

    const cost = getUnitTrainingCost(building.owner, type)
    for (let index = 0; index < cancelled; index++) {
      refundCost(building.owner, cost)
    }
    building.queue = building.queue.filter((queuedType: string) => queuedType !== type)

    if (building.owner.isPlayed) {
      const { menu } = building.context
      menu.updateTopbar()
      menu.updateButtonContent(type, '')
    }
    return true
  }

  cancelTechnology(): boolean {
    return cancelBuildingTechnology(this.building)
  }

  upgrade(type: string): void {
    upgradeBuilding(this.building, type)
  }

  buyTechnology(type: string, alreadyPaid?: boolean, _force?: boolean): boolean {
    void _force
    return buyBuildingTechnology(this.building, type, alreadyPaid)
  }
}
