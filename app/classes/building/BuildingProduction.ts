import { Assets } from 'pixi.js'
import {
  ACTION_TYPES,
  FAMILY_TYPES,
  LABEL_TYPES,
  MENU_INFO_IDS,
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
import type { RuntimeEntity, UnitCreationExtra, UnitEntity } from '../../types/entities'
import type { ConfigValue } from '../../types/config'
import type { RuntimeCell } from '../../types/map'
import type { Building } from './index'

type DynamicUnitCommand = (target: RuntimeEntity) => void
type DynamicBuildingState = Building & Record<string, ConfigValue | object | undefined>
type UnitWithDynamicCommands = UnitEntity & Record<string, DynamicUnitCommand | undefined>
type TrainingBuilding = Building & {
  trainingUnit?: UnitEntity | null
  trainingType?: string | null
  trainingExtra?: UnitCreationExtra | null
}

const DIRECT_TRAINING_CATEGORIES = new Set(['Civilian', 'Boat'])

function requiresVillagerTraining(building: Building, type: string): boolean {
  const unit = building.owner.config.units[type]
  return Boolean(unit && !DIRECT_TRAINING_CATEGORIES.has(String(unit.category ?? '')))
}

function getTrainingBuilding(building: Building): TrainingBuilding {
  return building as TrainingBuilding
}

function isAvailableVillager(unit: UnitEntity): boolean {
  return Boolean(
    unit.type === UNIT_TYPES.villager &&
      !unit.isDead &&
      !unit.isDestroyed &&
      !unit.loadedInTransport &&
      !unit.actionLocked &&
      unit.controlMode !== 'hero' &&
      !unit.trainingTargetType
  )
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
import { t } from '../../lib/lang'

export class BuildingProduction {
  building: Building

  constructor(building: Building) {
    this.building = building
  }

  placeUnit(type: string, extra?: UnitCreationExtra, options: { consumePopulationSlot?: boolean } = {}): boolean {
    const building = this.building
    const {
      context: { map, menu },
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

    if (
      building.owner.isPlayed &&
      building.owner.selectedBuilding &&
      building.owner.selectedBuilding.displayPopulation
    ) {
      menu.updateInfo(
        MENU_INFO_IDS.populationText,
        building.owner.population + '/' + Math.min(POPULATION_MAX, building.owner.populationMax)
      )
    }
    return true
  }

  removeVillagerForTraining(villager: UnitEntity): void {
    const map = villager.context?.map
    const owner = villager.owner
    villager.stopInterval?.()
    villager.stopTimeout?.()
    villager.path = []
    villager.dest = null
    villager.realDest = null
    villager.previousDest = null
    villager.previousWork = null
    villager.pendingOrder = null
    villager.blockedGatherApproach = null
    villager.inactif = false
    villager.trainingTargetType = null
    if (villager.selected && owner?.isPlayed) owner.unselectUnit?.(villager)
    villager.unselect?.()
    if (villager.currentCell?.has === villager) {
      villager.currentCell.has = null
      villager.currentCell.solid = false
    }
    map?.removeFromInstanceBucket?.(villager)
    const index = owner?.units.indexOf(villager) ?? -1
    if (index >= 0) owner?.units.splice(index, 1)
    map?.removeChild?.(villager)
    villager.destroy?.({ children: true, texture: false })
  }

  findTrainingVillager(): UnitEntity | null {
    const { owner } = this.building
    const selectedVillager = owner.selectedUnits?.find(isAvailableVillager)
    if (selectedVillager) return selectedVillager
    return (
      owner.units.find(unit => isAvailableVillager(unit) && unit.inactif) ||
      owner.units.find(isAvailableVillager) ||
      null
    )
  }

  clearTrainingReservation(villager?: UnitEntity | null): void {
    const building = getTrainingBuilding(this.building)
    if (villager && building.trainingUnit && building.trainingUnit !== villager) return
    building.trainingUnit = null
    building.trainingType = null
    building.trainingExtra = null
    if (!villager || building.isUsedBy === villager) building.isUsedBy = null
  }

  cancelTrainingForVillager(villager: UnitEntity): boolean {
    const building = getTrainingBuilding(this.building)
    if (building.trainingUnit !== villager || !building.trainingType) return false
    const unit = building.owner.config.units[building.trainingType]
    refundCost(building.owner, unit.cost)
    villager.trainingTargetType = null
    this.clearTrainingReservation(villager)
    if (building.owner.isPlayed) {
      building.context.menu.updateTopbar()
      building.context.menu.updateBottombar()
    }
    return true
  }

  startTrainingWithVillager(villager: UnitEntity): boolean {
    const building = getTrainingBuilding(this.building)
    const type = building.trainingUnit === villager ? building.trainingType : villager.trainingTargetType
    if (!type || !requiresVillagerTraining(building, type)) return false
    if (building.trainingUnit && building.trainingUnit !== villager) return false
    if (building.loading !== null || building.queue.length || building.technology) return false
    building.trainingUnit = villager
    building.trainingType = type
    building.isUsedBy = villager
    this.removeVillagerForTraining(villager)
    return Boolean(this.buyUnit(type, true, false, building.trainingExtra || undefined, villager))
  }

  requestVillagerTraining(type: string, extra?: UnitCreationExtra, villagerOverride?: UnitEntity | null): boolean {
    const building = getTrainingBuilding(this.building)
    const {
      context: { menu },
    } = building
    const unit = building.owner.config.units[type]
    if (!unit || !building.units?.includes(type)) return false
    if (!building.isBuilt || building.isDead) return false
    if (building.loading !== null || building.queue.length || building.technology || building.trainingUnit) {
      if (building.owner.isPlayed)
        menu.showMessage(t('buildingAlreadyTraining', { building: t(building.type) }), 'warning')
      return false
    }
    if (!canAfford(building.owner, unit.cost)) {
      if (building.owner.isPlayed) menu.showMessage(t('needMore', { resource: '' }), 'warning')
      return false
    }
    const selectedUnits = building.owner.selectedUnits || []
    if (!villagerOverride && selectedUnits.length && !selectedUnits.some(isAvailableVillager)) {
      if (building.owner.isPlayed) menu.showMessage(t('onlyVillagersCanTrain'), 'warning')
      return false
    }
    const villager = villagerOverride || this.findTrainingVillager()
    if (!villager) {
      if (building.owner.isPlayed) menu.showMessage(t('noVillagerToTrain'), 'warning')
      return false
    }
    if (!isAvailableVillager(villager)) {
      if (building.owner.isPlayed) menu.showMessage(t('onlyVillagersCanTrain'), 'warning')
      return false
    }
    payCost(building.owner, unit.cost)
    building.trainingUnit = villager
    building.trainingType = type
    building.trainingExtra = extra || null
    building.isUsedBy = villager
    villager.trainingTargetType = type
    if (building.owner.isPlayed) menu.updateTopbar()
    villager.sendToEvt?.(building, ACTION_TYPES.train, { forceRepath: true })
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
    const villagerTraining = requiresVillagerTraining(building, type)
    if (villagerTraining && !alreadyPaid && !force) {
      return this.requestVillagerTraining(type, extra)
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
      } else if (villagerTraining && trainee && !building.queue.length) {
        building.queue.push(type)
        success = true
      }
      if ((building.loading === null && building.queue[0]) || force) {
        let hasShowedMessage = false
        building.loading = force ? building.loading : 0
        if (building.selected && building.owner.isPlayed) {
          building.updateInterfaceLoading()
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
              if (building.selected && building.owner.isPlayed) {
                const still = building.queue.filter((q: string) => q === type).length
                menu.updateButtonContent(type, still || '')
                if (still === 0) menu.toggleQueuedActionCancel(type, false)
                building.updateInterfaceLoading()
              }
            } else if ((building.loading ?? 0) >= 100 || map.instantMode) {
              if (!this.placeUnit(type, extra, { consumePopulationSlot: !trainee })) {
                if (trainee) this.clearTrainingReservation(trainee)
                return
              }
              building.stopInterval()
              building.loading = null
              building.queue.shift()
              if (trainee) this.clearTrainingReservation(trainee)
              if (building.queue.length) {
                building.buyUnit(building.queue[0], true)
              }
              hasShowedMessage = false
              if (building.selected && building.owner.isPlayed) {
                const still = building.queue.filter((q: string) => q === type).length
                menu.updateButtonContent(type, still || '')
                if (still === 0) menu.toggleQueuedActionCancel(type, false)
                building.updateInterfaceLoading()
              }
            } else if ((building.loading ?? 0) < 100) {
              if (building.owner.population < Math.min(POPULATION_MAX, building.owner.populationMax)) {
                building.loading = (building.loading ?? 0) + 1
              } else if (building.owner.isPlayed && !hasShowedMessage) {
                menu.showMessage(t('needHouses'), 'warning')
                hasShowedMessage = true
              }
              if (building.selected && building.owner.isPlayed) {
                building.updateInterfaceLoading()
              }
            }
          },
          unit.trainingTime ?? 0,
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
    if (requiresVillagerTraining(building, type) && getTrainingBuilding(building).trainingUnit) return false

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
      menu.updateBottombar()
      menu.updateTopbar()
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
    building.sprite.texture = getTexture(assets.images!.final as string, Assets)
    building.sprite.anchor.set(building.sprite.texture.defaultAnchor!.x, building.sprite.texture.defaultAnchor!.y)
    const color = building.getChildByLabel(LABEL_TYPES.color)
    color?.destroy()
    changeSpriteColorDirectly(building.sprite, building.owner.color ?? '')
  }

  buyTechnology(type: string, alreadyPaid?: boolean, force?: boolean): boolean {
    const building = this.building
    const {
      context: { menu, map },
    } = building
    let success = false
    const config = building.owner.techs[type]
    if (
      !building.queue.length &&
      building.isBuilt &&
      (force || building.loading === null) &&
      !building.isDead &&
      (alreadyPaid || canAfford(building.owner, config.cost))
    ) {
      !alreadyPaid && payCost(building.owner, config.cost)
      success = true
      if (building.owner.isPlayed) {
        menu.updateTopbar()
      }
      building.loading = force ? building.loading : 0

      building.technology = { config, type }
      if (building.selected && building.owner.selectedBuilding === building) {
        menu.setBottombar(building)
      }
      building.startInterval(
        () => {
          const technology = building.technology
          if (!technology) return
          const { type } = technology
          if ((building.loading ?? 0) >= 100 || map.instantMode) {
            building.stopInterval()
            building.loading = null
            building.technology = null
            building.owner.unlockTechnology?.(type)
            if (building.owner.isPlayed) {
              menu.updateBottombar()
              menu.updateTopbar()
            }
          } else if ((building.loading ?? 0) < 100) {
            building.loading = (building.loading ?? 0) + 1
            if (building.owner.isPlayed && building.owner.selectedBuilding === building) {
              building.updateInterfaceLoading()
            }
          }
        },
        config.researchTime ?? 0,
        'building.research'
      )
    }
    return success
  }
}
