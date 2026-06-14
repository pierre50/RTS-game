import { Assets } from 'pixi.js'
import {
  ACTION_TYPES,
  BUILDING_TYPES,
  MENU_INFO_IDS,
  SHEET_TYPES,
  UNIT_TYPES,
  WORK_FOOD_TYPES,
  WORK_TYPES,
} from '../../constants'
import {
  getActionCondition,
  getClosestInstance,
  getInstanceDegree,
  getInstancePath,
  getWorkWithLoadingType,
} from '../../lib'

function getActionSheet(work, action, unit) {
  if (!work) {
    return
  }
  const actionSheet = action === ACTION_TYPES.takemeat ? SHEET_TYPES.harvest : SHEET_TYPES.action
  return Assets.cache.get(unit.allAssets[work][actionSheet])
}

export class UnitCommands {
  constructor(unit) {
    this.unit = unit
  }

  isRedundantOrder(target, work, action) {
    const unit = this.unit
    if (!target || unit.dest?.label !== target.label) return false
    if (unit.work !== work || unit.action !== action) return false
    return unit.path.length > 0 || unit.isUnitAtDest(action, target)
  }

  commonSendTo(target, work, action, keepPrevious, immediate = false, preserveBuildQueue = false) {
    const unit = this.unit
    const {
      context: { menu },
    } = unit
    if (!target || target.isDestroyed || unit.isDead) return false
    if (!preserveBuildQueue) unit.buildQueue = []
    if (action && !getActionCondition(unit, target, action)) return false
    if (unit.actionLocked) return unit.queueOrder(target, action)
    if (this.isRedundantOrder(target, work, action)) return false

    const shouldRememberPreviousTask =
      keepPrevious &&
      unit.type === UNIT_TYPES.villager &&
      unit.work !== WORK_TYPES.builder &&
      unit.action !== ACTION_TYPES.build &&
      unit.dest &&
      !unit.previousDest

    if (shouldRememberPreviousTask) {
      unit.previousDest = unit.dest
      unit.previousWork = unit.work
    } else if (!keepPrevious) {
      unit.previousWork = null
    }

    const workFromLoading = getWorkWithLoadingType(unit.loadingType)
    if (
      work !== WORK_TYPES.builder &&
      work !== workFromLoading &&
      !(WORK_FOOD_TYPES.includes(work) && WORK_FOOD_TYPES.includes(workFromLoading))
    ) {
      unit.loading = 0
      unit.loadingType = null
      unit.updateInterfaceLoading()
    }
    if (unit.work !== work || unit.action !== action) {
      unit.work = work
      unit.owner.isPlayed && unit.owner.selectedUnit === unit && menu.updateInfo(MENU_INFO_IDS.type, unit.work)
      if (unit.allAssets && unit.allAssets[work]) {
        unit.actionSheet = getActionSheet(work, action, unit)
        if (!unit.loading) {
          unit.standingSheet = Assets.cache.get(unit.allAssets[work][SHEET_TYPES.standing])
          unit.walkingSheet = Assets.cache.get(unit.allAssets[work][SHEET_TYPES.walking])
          unit.dyingSheet = Assets.cache.get(unit.allAssets[work][SHEET_TYPES.dying])
          unit.corpseSheet = Assets.cache.get(unit.allAssets[work][SHEET_TYPES.corpse])
        }
      }
      // If the unit is already moving when AI/job assignment changes its role,
      // refresh the walking animation immediately so the sprite matches the new work.
      if (unit.path.length) {
        unit.setTextures(SHEET_TYPES.walking)
      }
    }
    unit.previousDest = keepPrevious ? unit.previousDest : null

    // AI job switches must bypass the public command throttle, otherwise the villager
    // can change work/action while still keeping the old destination.
    if (immediate || !unit.owner.isPlayed) {
      return unit.sendToEvt(target, action)
    }
    return unit.sendTo(target, action)
  }

  sendToWithCell(target, arrivalCell, action) {
    const unit = this.unit
    const {
      context: { map },
    } = unit
    if (unit.actionLocked) {
      return unit.queueOrder(() => this.sendToWithCell(target, arrivalCell, action))
    }
    unit.handleChangeDest()
    unit.stopInterval()
    if (!target || target.isDestroyed || unit.isDead || !arrivalCell) return
    if (action === ACTION_TYPES.attack && !getActionCondition(unit, target, ACTION_TYPES.attack)) return
    if (unit.isUnitAtDest(action, target)) {
      unit.setDest(target)
      unit.action = action
      unit.degree = getInstanceDegree(unit, target.x, target.y)
      unit.getAction(action)
      return
    }
    const path = getInstancePath(unit, arrivalCell.i, arrivalCell.j, map)
    if (path.length) {
      unit.setDest(target)
      unit.action = action
      unit.setPath(path)
    } else {
      unit.sendToEvt(target, action)
    }
  }

  sendToDelivery() {
    const unit = this.unit
    const {
      context: { map },
    } = unit
    let buildingTypes = []
    if (unit.category === 'Boat') {
      buildingTypes = [BUILDING_TYPES.dock]
    } else {
      buildingTypes = [BUILDING_TYPES.townCenter]
      const buildings = {
        Granary: unit.owner.config.buildings.Granary,
        StoragePit: unit.owner.config.buildings.StoragePit,
      }
      for (const [key, value] of Object.entries(buildings)) {
        if (value.accept && value.accept.includes(unit.loadingType)) {
          buildingTypes.push(key)
          break
        }
      }
    }

    const targets = unit.owner.buildings.filter(building =>
      getActionCondition(unit, building, ACTION_TYPES.delivery, { buildingTypes })
    )
    const target = getClosestInstance(unit, targets)
    if (!target) {
      unit.stop()
      return
    }
    if (unit.dest) {
      unit.previousDest = unit.dest
    } else {
      unit.previousDest = map.grid[unit.i][unit.j]
    }
    unit.sendTo(target, ACTION_TYPES.delivery)
  }

  sendToFish(target) {
    return this.commonSendTo(target, WORK_TYPES.fisher, ACTION_TYPES.fishing)
  }

  sendToAttack(target) {
    if (!getActionCondition(this.unit, target, ACTION_TYPES.attack)) return
    return this.commonSendTo(target, WORK_TYPES.attacker, ACTION_TYPES.attack, { resource: 'attack' })
  }

  sendToTakeMeat(target, immediate = false) {
    return this.commonSendTo(
      target,
      WORK_TYPES.hunter,
      ACTION_TYPES.takemeat,
      { actionSheet: SHEET_TYPES.harvest },
      immediate
    )
  }

  sendToHunt(target) {
    return this.commonSendTo(target, WORK_TYPES.hunter, ACTION_TYPES.hunt)
  }

  sendToBuilding(target, preserveBuildQueue = false) {
    if (!preserveBuildQueue) this.unit.buildQueue = []
    return this.commonSendTo(target, WORK_TYPES.builder, ACTION_TYPES.build, true, false, true)
  }

  sendToBuildingQueue(targets) {
    this.unit.buildQueue = targets.filter(target => getActionCondition(this.unit, target, ACTION_TYPES.build))
    return this.continueBuildingQueue()
  }

  continueBuildingQueue() {
    const unit = this.unit
    while (unit.buildQueue?.length) {
      const target = unit.buildQueue[0]
      if (getActionCondition(unit, target, ACTION_TYPES.build)) {
        unit.previousDest = null
        return this.sendToBuilding(target, true)
      }
      unit.buildQueue.shift()
    }
    unit.buildQueue = []
    return false
  }

  sendToFarm(target) {
    return this.commonSendTo(target, WORK_TYPES.farmer, ACTION_TYPES.farm)
  }

  sendToTree(target) {
    return this.commonSendTo(target, WORK_TYPES.woodcutter, ACTION_TYPES.chopwood)
  }

  sendToBerrybush(target) {
    return this.commonSendTo(target, WORK_TYPES.forager, ACTION_TYPES.forageberry)
  }

  sendToStone(target) {
    return this.commonSendTo(target, WORK_TYPES.stoneminer, ACTION_TYPES.minestone)
  }

  sendToGold(target) {
    return this.commonSendTo(target, WORK_TYPES.goldminer, ACTION_TYPES.minegold)
  }
}
