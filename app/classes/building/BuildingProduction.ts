import { Assets } from 'pixi.js'
import {
  ACTION_TYPES,
  BUILDING_TYPES,
  FAMILY_TYPES,
  LABEL_TYPES,
  MOUNTED_HORSE_SPEED_BONUS,
  PLAYER_TYPES,
  POPULATION_MAX,
  UNIT_TYPES,
} from '../../constants'
import {
  canAfford,
  changeSpriteColorDirectly,
  getActionCondition,
  getBuildingAsset,
  getFreeCellAroundPoint,
  getTexture,
  payCost,
  refundCost,
} from '../../lib'
import { canUnitTrainInto, getMissingResourceNames, isTraineeTrainingType } from '../../lib/buildingTraining'
import { hasLivingChief, playerNeedsChiefForCommand } from '../../lib/chief'
import { t } from '../../lib/lang'
import type { RuntimeEntity, UnitCreationExtra, UnitEntity } from '../../types/entities'
import type { ConfigValue } from '../../types/config'
import type { RuntimeCell } from '../../types/map'
import type { ResourceAmount } from '../../types/common'
import type { Building } from './index'

type DynamicUnitCommand = (target: RuntimeEntity) => void
type DynamicBuildingState = Building & Record<string, ConfigValue | object | undefined>
type UnitWithDynamicCommands = UnitEntity & Record<string, DynamicUnitCommand | undefined>
type TrainingBuilding = Building & {
  trainingUnit?: UnitEntity | null
  trainingType?: string | null
  mountingTime?: number
}

function getTrainingBuilding(building: Building): TrainingBuilding {
  return building as TrainingBuilding
}

function isAvailableTrainingUnit(unit: UnitEntity): boolean {
  return Boolean(
    !unit.isDead &&
      !unit.isDestroyed &&
      !unit.loadedInTransport &&
      !unit.actionLocked &&
      unit.controlMode !== 'hero' &&
      !unit.trainingTargetType
  )
}

function isExpectedTrainingUnit(unit: UnitEntity, type: string): boolean {
  return Boolean(
    unit.trainingTargetType === type &&
      !unit.isDead &&
      !unit.isDestroyed &&
      !unit.loadedInTransport &&
      unit.controlMode !== 'hero'
  )
}

function isStableMountTraining(building: Building, trainee: UnitEntity | null | undefined, type: string): boolean {
  return Boolean(building.type === BUILDING_TYPES.stable && trainee && trainee.type === type && !trainee.mountedOnHorse)
}

function getTrainingCost(
  building: Building,
  unit: { cost?: ResourceAmount },
  trainee: UnitEntity,
  type: string
): ResourceAmount {
  return isStableMountTraining(building, trainee, type) ? {} : (unit.cost ?? {})
}

function getProductionTime(
  building: TrainingBuilding,
  unit: { trainingTime?: number },
  trainee: UnitEntity | null | undefined,
  type: string
): number {
  return isStableMountTraining(building, trainee, type)
    ? (building.mountingTime ?? unit.trainingTime ?? 0)
    : (unit.trainingTime ?? 0)
}

function getTrainingExtra(building: Building, trainee: UnitEntity, type: string): UnitCreationExtra | undefined {
  const baseExtra: UnitCreationExtra = {}
  if (trainee.name) baseExtra.name = trainee.name
  if (trainee.mountedOnHorse) {
    baseExtra.mountedOnHorse = true
    const traineeSpeed = Number(trainee.speed)
    if (Number.isFinite(traineeSpeed)) baseExtra.speed = traineeSpeed
  }
  if (!isStableMountTraining(building, trainee, type)) return Object.keys(baseExtra).length ? baseExtra : undefined
  const traineeSpeed = Number(trainee.speed)
  return {
    ...baseExtra,
    mountedOnHorse: true,
    hitPoints: trainee.hitPoints,
    speed: Number.isFinite(traineeSpeed) ? traineeSpeed + MOUNTED_HORSE_SPEED_BONUS : undefined,
    experience: trainee.experience ? { ...trainee.experience } : undefined,
  }
}

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

function formatMissingResources(owner: Building['owner'], cost: ResourceAmount = {}): string {
  const missing = getMissingResourceNames(owner, cost)
  return missing.map(resource => t(resource)).join(', ')
}

function refreshOpenBuildingMenu(building: Building): void {
  const menu = building.context.menu
  if (menu.getHeroBuildingMenuTarget?.() === building) {
    menu.refreshHeroBuildingMenu?.()
  }
}

function isBlockedByMissingChief(building: Building, type: string): boolean {
  if (!playerNeedsChiefForCommand(building.owner)) return false
  if (type === UNIT_TYPES.villager) return !hasLivingChief(building.owner)
  if (isTraineeTrainingType(building, type)) return !hasLivingChief(building.owner)
  return false
}

export class BuildingProduction {
  building: Building

  constructor(building: Building) {
    this.building = building
  }

  placeUnit(type: string, extra?: UnitCreationExtra, options: { consumePopulationSlot?: boolean } = {}): boolean {
    const building = this.building
    const {
      context: { map },
    } = building
    let spawnCell
    const config = building.owner.config.units[type]
    if (config.category === 'Boat') {
      spawnCell = getFreeCellAroundPoint(
        building.i,
        building.j,
        building.size,
        map.grid,
        (cell: RuntimeCell) => cell.category === 'Water' && !cell.solid,
        (items: RuntimeCell[]) => map.randomItem(items)
      )
    } else {
      spawnCell = getFreeCellAroundPoint(
        building.i,
        building.j,
        building.size,
        map.grid,
        (cell: RuntimeCell) => cell.category !== 'Water' && !cell.solid,
        (items: RuntimeCell[]) => map.randomItem(items)
      )
    }
    const consumePopulationSlot = options.consumePopulationSlot ?? true
    if (
      !spawnCell ||
      (consumePopulationSlot && building.owner.population >= Math.min(POPULATION_MAX, building.owner.populationMax))
    )
      return false
    if (consumePopulationSlot) building.owner.population++

    const unitExtra = extra || building.owner.getUnitExtraOptions?.(type) || {}
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
    map?.removeChild?.(trainee)
    trainee.destroy?.({ children: true, texture: false })
  }

  findTrainingUnit(type: string): UnitEntity | null {
    const { owner } = this.building
    const isEligible = (unit: UnitEntity) =>
      isAvailableTrainingUnit(unit) && canUnitTrainInto(this.building, unit, type)
    const selectedUnit = owner.selectedUnits?.find(isEligible)
    if (selectedUnit) return selectedUnit
    return owner.units.find(unit => isEligible(unit) && unit.inactif) || owner.units.find(isEligible) || null
  }

  clearActiveTraining(trainee?: UnitEntity | null): void {
    const building = getTrainingBuilding(this.building)
    if (trainee && building.trainingUnit && building.trainingUnit !== trainee) return
    building.trainingUnit = null
    building.trainingType = null
    if (!trainee || building.isUsedBy === trainee) building.isUsedBy = null
  }

  cancelTrainingForUnit(trainee: UnitEntity): boolean {
    const building = getTrainingBuilding(this.building)
    const type = trainee.trainingTargetType
    if (!type || !canUnitTrainInto(building, trainee, type)) return false
    trainee.trainingTargetType = null
    if (building.trainingUnit === trainee) this.clearActiveTraining(trainee)
    if (building.owner.isPlayed) refreshOpenBuildingMenu(building)
    return true
  }

  cancelPendingTraining(type?: string): boolean {
    const building = getTrainingBuilding(this.building)
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

  ejectTrainee(): void {
    const building = this.building
    const {
      context: { map },
    } = building
    const spawnCell = getFreeCellAroundPoint(
      building.i,
      building.j,
      building.size,
      map.grid,
      (cell: RuntimeCell) => cell.category !== 'Water' && !cell.solid,
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

  startTrainingWithUnit(trainee: UnitEntity): boolean {
    const building = getTrainingBuilding(this.building)
    const type = trainee.trainingTargetType
    if (!type || !isTraineeTrainingType(building, type)) return false
    if (building.loading !== null || building.queue.length || building.technology) return false
    if (!isExpectedTrainingUnit(trainee, type) || !canUnitTrainInto(building, trainee, type)) return false
    const unit = building.owner.config.units[type]
    const cost = getTrainingCost(building, unit, trainee, type)
    if (!canAfford(building.owner, cost)) {
      if (building.owner.isPlayed) {
        building.context.menu.showMessage(
          t('needMore', { resource: formatMissingResources(building.owner, cost) }),
          'warning'
        )
        building.context.menu.updateTopbar()
      }
      trainee.trainingTargetType = null
      this.clearActiveTraining(trainee)
      return false
    }
    payCost(building.owner, cost)
    if (building.owner.isPlayed) building.context.menu.updateTopbar()
    building.trainingUnit = trainee
    building.trainingType = type
    building.isUsedBy = trainee
    this.removeTraineeForTraining(trainee)
    return Boolean(this.buyUnit(type, true, false, getTrainingExtra(building, trainee, type), trainee))
  }

  requestUnitTraining(type: string, extra?: UnitCreationExtra, traineeOverride?: UnitEntity | null): boolean {
    const building = getTrainingBuilding(this.building)
    const {
      context: { menu },
    } = building
    const unit = building.owner.config.units[type]
    if (!unit || !building.units?.includes(type)) return false
    if (!building.isBuilt || building.isDead) return false
    if (isBlockedByMissingChief(building, type)) {
      if (building.owner.isPlayed) menu.showMessage(t('requiresChief'), 'warning')
      return false
    }
    if (building.loading !== null || building.queue.length || building.technology) {
      if (building.owner.isPlayed)
        menu.showMessage(t('buildingAlreadyTraining', { building: t(building.type) }), 'warning')
      return false
    }
    const trainee = traineeOverride || this.findTrainingUnit(type)
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
    if (isBlockedByMissingChief(building, type)) {
      if (building.owner.isPlayed) menu.showMessage(t('requiresChief'), 'warning')
      return false
    }
    if (traineeTraining && !alreadyPaid && !force) {
      return this.requestUnitTraining(type, extra)
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
              if (building.owner.isPlayed) {
                const still = building.queue.filter((q: string) => q === type).length
                menu.updateButtonContent(type, still || '')
                if (still === 0) menu.toggleQueuedActionCancel(type, false)
                building.updateInterfaceLoading?.()
              }
            } else if ((building.loading ?? 0) >= 100 || map.instantMode) {
              if (!this.placeUnit(type, extra, { consumePopulationSlot: !trainee })) {
                building.stopInterval()
                building.loading = null
                if (building.queue[0] === type) building.queue.shift()
                if (trainee) this.clearActiveTraining(trainee)
                if (building.owner.isPlayed) {
                  const still = building.queue.filter((q: string) => q === type).length
                  menu.updateButtonContent(type, still || '')
                  if (still === 0) menu.toggleQueuedActionCancel(type, false)
                  building.updateInterfaceLoading?.()
                }
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
              if (building.owner.isPlayed) {
                const still = building.queue.filter((q: string) => q === type).length
                menu.updateButtonContent(type, still || '')
                if (still === 0) menu.toggleQueuedActionCancel(type, false)
                building.updateInterfaceLoading?.()
              }
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
