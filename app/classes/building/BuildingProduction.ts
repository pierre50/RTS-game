import { PLAYER_TYPES, POPULATION_MAX } from '../../constants'
import {
  canAfford,
  payCost,
  refundCost,
} from '../../lib'
import { isTraineeTrainingType } from '../../lib/buildingTraining'
import { t } from '../../lib/lang'
import {
  cancelPendingTraining,
  cancelTrainingForUnit,
  clearActiveTraining,
  failTraineeEntry,
  findTrainingUnit,
  getProductionTime,
  getTrainingBuilding,
  isBlockedByMissingChief,
  removeTraineeForTraining as removeTrainingUnitFromMap,
  requestUnitTraining,
  startTrainingWithUnit,
} from './BuildingTraineeTraining'
import { ejectTrainingVillager, placeProducedUnit } from './BuildingProductionPlacement'
import {
  buyBuildingTechnology,
  cancelBuildingTechnology,
  refreshOpenBuildingMenu,
  upgradeBuilding,
} from './BuildingTechnologyProduction'
import type { UnitCreationExtra, UnitEntity } from '../../types/entities'
import type { BuildingControllerHost } from './BuildingTypes'

export class BuildingProduction {
  building: BuildingControllerHost

  constructor(building: BuildingControllerHost) {
    this.building = building
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

  findTrainingUnit(type: string): UnitEntity | null {
    return findTrainingUnit(this.building, type)
  }

  clearActiveTraining(trainee?: UnitEntity | null): void {
    clearActiveTraining(this.building, trainee)
  }

  cancelTrainingForUnit(trainee: UnitEntity): boolean {
    return cancelTrainingForUnit(this.building, trainee)
  }

  cancelPendingTraining(type?: string): boolean {
    return cancelPendingTraining(this.building, type)
  }

  ejectTrainee(): void {
    ejectTrainingVillager(this.building)
  }

  cancelActiveTraining(type: string): boolean {
    const building = getTrainingBuilding(this.building)
    if (building.loading === null || building.queue[0] !== type) return false
    const unit = building.owner.config.units[type]
    building.stopInterval()
    building.loading = null
    building.queue.shift()
    refundCost(building.owner, unit.cost)
    this.ejectTrainee()
    this.clearActiveTraining()
    if (building.owner.isPlayed) {
      const { menu } = building.context
      menu.updateTopbar()
      menu.updateButtonContent(type, '')
      menu.toggleQueuedActionCancel(type, false)
      building.updateInterfaceLoading?.()
      refreshOpenBuildingMenu(building)
    }
    return true
  }

  failTraineeEntry(trainee: UnitEntity, message?: string, updateTopbar = false): false {
    return failTraineeEntry(this.building, trainee, message, updateTopbar)
  }

  startTrainingWithUnit(trainee: UnitEntity): boolean {
    return startTrainingWithUnit(this.building, trainee, (type, alreadyPaid, force, extra, unit) =>
      this.buyUnit(type, alreadyPaid, force, extra, unit)
    )
  }

  requestUnitTraining(type: string, extra?: UnitCreationExtra, traineeOverride?: UnitEntity | null): boolean {
    void extra
    return requestUnitTraining(this.building, type, traineeOverride)
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
      context: { menu, map },
    } = building
    let success = false
    const unit = building.owner.config.units[type]
    const traineeTraining = isTraineeTrainingType(building, type)
    if (traineeTraining && !alreadyPaid && !force) {
      return this.requestUnitTraining(type, extra)
    }
    if (isBlockedByMissingChief(building, type)) {
      if (building.owner.isPlayed) menu.showMessage(t('requiresChief'), 'warning')
      return false
    }
    const updatePlayedQueueInterface = () => {
      if (!building.owner.isPlayed) return
      const still = building.queue.filter((q: string) => q === type).length
      menu.updateButtonContent(type, still || '')
      if (still === 0) menu.toggleQueuedActionCancel(type, false)
      building.updateInterfaceLoading?.()
    }
    if (building.isBuilt && !building.isDead && (canAfford(building.owner, unit.cost) || alreadyPaid)) {
      if (!alreadyPaid) {
        if (building.owner.type === PLAYER_TYPES.ai) {
          if (!building.queue.length && building.loading === null) {
            payCost(building.owner, unit.cost)
            building.queue.push(type)
            success = true
          }
        } else {
          payCost(building.owner, unit.cost)
          building.queue.push(type)
          if (building.selected && building.owner.isPlayed) {
            menu.updateButtonContent(type, building.queue.filter((q: string) => q === type).length)
          }
          building.owner.isPlayed && menu.updateTopbar()
          success = true
        }
      } else if (traineeTraining && trainee && !building.queue.length) {
        building.queue.push(type)
        success = true
      }
      if ((building.loading === null && building.queue[0]) || force) {
        let hasShowedMessage = false
        building.loading = force ? building.loading : 0
        if (building.owner.isPlayed) {
          building.updateInterfaceLoading?.()
        }
        building.startInterval(
          () => {
            if (building.queue[0] !== type) {
              building.stopInterval()
              building.loading = null
              if (building.queue.length) {
                building.buyUnit(building.queue[0], true)
              }
              hasShowedMessage = false
              updatePlayedQueueInterface()
            } else if ((building.loading ?? 0) >= 100 || map.instantMode) {
              if (!this.placeUnit(type, extra, { consumePopulationSlot: !trainee })) {
                building.stopInterval()
                building.loading = null
                if (building.queue[0] === type) building.queue.shift()
                if (trainee) this.clearActiveTraining(trainee)
                updatePlayedQueueInterface()
                return
              }
              building.stopInterval()
              building.loading = null
              building.queue.shift()
              if (trainee) this.clearActiveTraining(trainee)
              if (building.queue.length) {
                building.buyUnit(building.queue[0], true)
              }
              hasShowedMessage = false
              updatePlayedQueueInterface()
            } else if ((building.loading ?? 0) < 100) {
              if (trainee || building.owner.population < Math.min(POPULATION_MAX, building.owner.populationMax)) {
                building.loading = (building.loading ?? 0) + 1
              } else if (building.owner.isPlayed && !hasShowedMessage) {
                menu.showMessage(t('needHouses'), 'warning')
                hasShowedMessage = true
              }
              if (building.owner.isPlayed) {
                building.updateInterfaceLoading?.()
              }
            }
          },
          getProductionTime(building, unit, trainee, type),
          'building.production'
        )
      }
      return success
    }
  }

  cancelUnits(type: string): boolean {
    const building = this.building
    const unit = building.owner.config.units[type]
    if (!unit) return false
    if (isTraineeTrainingType(building, type)) {
      if (building.loading !== null && building.queue[0] === type) {
        return false
      }
      if (building.loading !== null || building.queue.length) return false
      return this.cancelPendingTraining(type)
    }

    const cancelled = building.queue.filter((queuedType: string) => queuedType === type).length
    if (!cancelled) return false

    for (let index = 0; index < cancelled; index++) {
      refundCost(building.owner, unit.cost)
    }
    building.queue = building.queue.filter((queuedType: string) => queuedType !== type)

    if (building.owner.isPlayed) {
      const { menu } = building.context
      menu.updateTopbar()
      menu.updateButtonContent(type, '')
      menu.toggleQueuedActionCancel(type, false)
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
