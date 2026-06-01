import { Assets } from 'pixi.js'
import { ACTION_TYPES, BUILDING_TYPES, MENU_INFO_IDS, SHEET_TYPES, WORK_FOOD_TYPES, WORK_TYPES } from '../../constants'
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

  commonSendTo(target, work, action, keepPrevious, immediate = false) {
    const unit = this.unit
    const {
      context: { menu },
    } = unit
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
    }
    unit.previousDest = keepPrevious ? unit.previousDest : null
    return immediate ? unit.sendToEvt(target, action) : unit.sendTo(target, action)
  }

  sendToWithCell(target, arrivalCell, action) {
    const unit = this.unit
    const {
      context: { map },
    } = unit
    unit.handleChangeDest()
    unit.stopInterval()
    if (!target || target.isDestroyed || unit.isDead || !arrivalCell) return
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

  sendToBuilding(target) {
    return this.commonSendTo(target, WORK_TYPES.builder, ACTION_TYPES.build)
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
