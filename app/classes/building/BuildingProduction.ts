import { Assets } from 'pixi.js'
import {
  ACTION_TYPES,
  FAMILY_TYPES,
  LABEL_TYPES,
  PLAYER_TYPES,
  POPULATION_MAX,
  UNIT_TYPES,
} from '../../constants'
import {
  canAfford,
  changeSpriteColorDirectly,
  getActionCondition,
  getBuildingAsset,
  getFreeLandCellAroundInstance,
  getTexture,
  payCost,
  refundCost,
} from '../../lib'
import { isTraineeTrainingType } from '../../lib/buildingTraining'
import { hasLivingChief, playerNeedsChiefForCommand } from '../../lib/chief'
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
import type { RuntimeEntity, UnitCreationExtra, UnitEntity } from '../../types/entities'
import type { ConfigValue } from '../../types/config'
import type { RuntimeCell } from '../../types/map'
import type { BuildingControllerHost } from './BuildingTypes'

type DynamicUnitCommand = (target: RuntimeEntity) => void
type DynamicBuildingState = BuildingControllerHost & Record<string, ConfigValue | object | undefined>
type UnitWithDynamicCommands = UnitEntity & Record<string, DynamicUnitCommand | undefined>

function sendUnitToEntity(unit: UnitEntity, target: RuntimeEntity): void {
  if (target.family === FAMILY_TYPES.resource) {
    const sendToFunc = `sendTo${target.category || target.type}`
    const command = (unit as UnitWithDynamicCommands)[sendToFunc]
    if (typeof command === 'function') return command.call(unit, target)
    return unit.sendTo(target)
  }
  if (target.family === FAMILY_TYPES.animal) {
    if (getActionCondition(unit, target, ACTION_TYPES.hunt)) return unit.sendToHunt(target)
    if (getActionCondition(unit, target, ACTION_TYPES.takemeat)) return unit.sendToTakeMeat(target)
    return unit.sendTo(target)
  }
  if (target.family === FAMILY_TYPES.building) {
    if (getActionCondition(unit, target, ACTION_TYPES.build)) return unit.sendToBuilding(target)
    if (getActionCondition(unit, target, ACTION_TYPES.farm)) return unit.sendToFarm(target)
    if (getActionCondition(unit, target, ACTION_TYPES.attack)) return unit.sendTo(target, ACTION_TYPES.attack)
  }
  if (target.family === FAMILY_TYPES.unit) {
    if (getActionCondition(unit, target, ACTION_TYPES.attack)) return unit.sendTo(target, ACTION_TYPES.attack)
  }
  unit.sendTo(target)
}

function refreshOpenBuildingMenu(building: BuildingControllerHost): void {
  const menu = building.context.menu
  if (menu.getHeroBuildingMenuTarget?.() === building) {
    menu.refreshHeroBuildingMenu?.()
  }
}

export class BuildingProduction {
  building: BuildingControllerHost

  constructor(building: BuildingControllerHost) {
    this.building = building
  }

  placeUnit(type: string, extra?: UnitCreationExtra, options: { consumePopulationSlot?: boolean } = {}): boolean {
    const building = this.building
    const {
      context: { map },
    } = building
    const spawnCell = getFreeLandCellAroundInstance(
      building,
      map.grid,
      (items: RuntimeCell[]) => map.randomItem(items)
    )
    const consumePopulationSlot = options.consumePopulationSlot ?? true
    if (
      !spawnCell ||
      (consumePopulationSlot && building.owner.population >= Math.min(POPULATION_MAX, building.owner.populationMax))
    )
      return false
    if (consumePopulationSlot) building.owner.population++

    const unitExtra = { ...(building.owner.getUnitExtraOptions?.(type) || {}), ...(extra || {}) }
    const unit = building.owner.createUnit?.({ i: spawnCell.i, j: spawnCell.j, type, ...unitExtra })
    if (!unit) return false
    const rallyPoint = building.rallyPoint
    const rallyCell = rallyPoint && map.grid[rallyPoint.i]?.[rallyPoint.j]
    if (rallyCell) {
      const rallyTarget = rallyCell.has && !rallyCell.has.isDestroyed ? rallyCell.has : null
      rallyTarget ? sendUnitToEntity(unit, rallyTarget) : unit.sendTo(rallyCell)
    }

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
    const building = this.building
    const {
      context: { map },
    } = building
    const spawnCell = getFreeLandCellAroundInstance(
      building,
      map.grid,
      (items: RuntimeCell[]) => map.randomItem(items)
    )
    if (!spawnCell) return
    const unitExtra = building.owner.getUnitExtraOptions?.(UNIT_TYPES.villager) || {}
    building.owner.createUnit?.({ i: spawnCell.i, j: spawnCell.j, type: UNIT_TYPES.villager, ...unitExtra })
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
    const building = this.building
    const { menu } = building.context
    if (!building.technology) return false

    building.stopInterval()
    refundCost(building.owner, building.technology.config.cost)
    building.technology = null
    building.loading = null
    if (building.owner.isPlayed) {
      menu.updateTopbar()
      refreshOpenBuildingMenu(building)
    }
    return true
  }

  upgrade(type: string): void {
    const building = this.building
    const data = building.owner.config.buildings[type]
    const nextTotalHitPoints = Number(data.totalHitPoints) || building.totalHitPoints
    building.type = type
    building.hitPoints = nextTotalHitPoints - (building.totalHitPoints - building.hitPoints)
    for (const [key, value] of Object.entries(data)) {
      ;(building as DynamicBuildingState)[key] = value
    }
    const assets = getBuildingAsset(building.type, building.owner, Assets)
    building.textureName = assets.images!.final as string
    building.sprite.texture = getTexture(assets.images!.final as string, Assets)
    building.sprite.anchor.set(building.sprite.texture.defaultAnchor!.x, building.sprite.texture.defaultAnchor!.y)
    const color = building.getChildByLabel(LABEL_TYPES.color)
    color?.destroy()
    changeSpriteColorDirectly(building.sprite, building.owner.color ?? '')
    building.updateShadow()
  }

  buyTechnology(type: string, alreadyPaid?: boolean, _force?: boolean): boolean {
    const building = this.building
    const {
      context: { menu },
    } = building
    let success = false
    const config = building.owner.techs[type]
    if (playerNeedsChiefForCommand(building.owner) && !hasLivingChief(building.owner)) {
      if (building.owner.isPlayed) menu.showMessage(t('requiresChief'), 'warning')
      return false
    }
    const hadQueuedTechnology = building.technology?.type === type
    if (
      building.isBuilt &&
      !building.isDead &&
      !building.isDestroyed &&
      !building.owner.technologies.includes(type) &&
      (alreadyPaid || canAfford(building.owner, config.cost))
    ) {
      !alreadyPaid && payCost(building.owner, config.cost)
      success = true
      if (hadQueuedTechnology) building.loading = null
      building.technology = null
      building.owner.unlockTechnology?.(type)
      if (building.owner.isPlayed) {
        menu.updateTopbar()
        refreshOpenBuildingMenu(building)
      }
    }
    return success
  }
}
