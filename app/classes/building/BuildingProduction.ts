import { definedProperties } from '../../lib/definedProperties'
import { UNIT_TYPES } from '../../constants'
import { canAfford, isAIControlledPlayer, payCost, refundCost } from '../../lib'
import { hasBuildingTrainingCapacity, isTraineeTrainingType } from '../../lib/buildings/buildingTraining'
import { t } from '../../lib/lang'
import { getUnitTrainingCost } from '../../lib/training/unitTrainingCost'
import type { UnitCreationExtra, UnitEntity } from '../../types/entities'
import { ejectTrainingVillager, placeProducedUnit } from './BuildingProductionPlacement'
import {
  buyBuildingTechnology,
  cancelBuildingTechnology,
  refreshOpenBuildingMenu,
  upgradeBuilding,
} from './BuildingTechnologyProduction'
import {
  clearActiveTraining,
  failTraineeEntry,
  getTrainingBuilding,
  getTrainingDays,
  isBlockedByMissingChief,
  removeTraineeForTraining as removeTrainingUnitFromMap,
  startTrainingWithUnit,
} from './BuildingTraineeTraining'
import {
  currentTrainingDay as trainingCurrentTrainingDay,
  finishTrainingEntry as trainingFinishTrainingEntry,
  finishTrainingEntryPlacementFailed as trainingFinishTrainingEntryPlacementFailed,
  finishUnitTraining as trainingFinishUnitTraining,
  syncPrimaryTrainingState as trainingSyncPrimaryTrainingState,
  updatePlayedQueueInterface as trainingUpdatePlayedQueueInterface,
  updateTrainingEntryProgress as trainingUpdateTrainingEntryProgress,
  updateTrainingProgress as trainingUpdateTrainingProgress,
  wakeNextWaitingTrainee as trainingWakeNextWaitingTrainee,
} from './BuildingTrainingProgress'
import type { BuildingControllerHost, QueuedTrainingTrainee } from './BuildingTypes'
import { cancelAllUnitTraining as cancelAllBuildingUnitTraining } from './BuildingUnitTrainingCancellation'

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
    return trainingCurrentTrainingDay(this)
  }

  updateTrainingProgress(): void {
    return trainingUpdateTrainingProgress(this)
  }

  updateTrainingEntryProgress(entry: QueuedTrainingTrainee): void {
    return trainingUpdateTrainingEntryProgress(this, entry)
  }

  syncPrimaryTrainingState(): void {
    return trainingSyncPrimaryTrainingState(this)
  }

  wakeNextWaitingTrainee(): void {
    return trainingWakeNextWaitingTrainee(this)
  }

  finishUnitTraining(type: string, extra?: UnitCreationExtra, trainee?: UnitEntity | null): boolean {
    return trainingFinishUnitTraining(this, type, extra, trainee)
  }

  finishTrainingEntry(trainee: UnitEntity): void {
    return trainingFinishTrainingEntry(this, trainee)
  }

  finishTrainingEntryPlacementFailed(trainee: UnitEntity): void {
    return trainingFinishTrainingEntryPlacementFailed(this, trainee)
  }

  updatePlayedQueueInterface(type: string): void {
    return trainingUpdatePlayedQueueInterface(this, type)
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
    const entry: QueuedTrainingTrainee = definedProperties({
      type,
      trainee,
      extra,
      loading: 0,
      trainingStartedDay: startDay,
      trainingCompleteDay: startDay + durationDays,
    })
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
    if (type === UNIT_TYPES.villager) return false
    const building = this.building
    let success = false
    const unit = building.owner.config.units[type]
    if (!unit) return false
    const cost = getUnitTrainingCost(building.owner, type)
    const traineeTraining = isTraineeTrainingType(building, type)
    if (!this.canRequestUnitTraining(type, traineeTraining, alreadyPaid, force, trainee)) return false
    if (building.isBuilt && !building.isDead && (canAfford(building.owner, cost) || alreadyPaid)) {
      if (!alreadyPaid) {
        success = this.enqueueUnitPurchase(type, cost)
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

  private canRequestUnitTraining(
    type: string,
    traineeTraining: boolean,
    alreadyPaid: boolean,
    force: boolean,
    trainee?: UnitEntity | null
  ): boolean {
    const building = this.building
    const { menu } = building.context
    if (traineeTraining && !alreadyPaid && !force) {
      return false
    }
    if (isBlockedByMissingChief(building, type)) {
      if (building.owner.isPlayed) menu.showMessage(t('requiresChief'), 'warning')
      return false
    }
    if (!alreadyPaid && !hasBuildingTrainingCapacity(building, { excludeUnit: trainee ?? null })) return false
    return true
  }

  private enqueueUnitPurchase(type: string, cost: ReturnType<typeof getUnitTrainingCost>): boolean {
    const building = this.building
    const { menu } = building.context
    if (isAIControlledPlayer(building.owner)) {
      if (!building.queue.length && building.loading === null) {
        payCost(building.owner, cost)
        building.queue.push(type)
        return true
      }
    } else {
      payCost(building.owner, cost)
      building.queue.push(type)
      if (building.selected && building.owner.isPlayed) {
        menu.updateButtonContent(type, building.queue.filter((q: string) => q === type).length)
      }
      building.owner.isPlayed && menu.updateTopbar()
      return true
    }
    return false
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
