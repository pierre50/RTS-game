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
  getAutonomyJobForWork,
  setVillagerAutonomy,
} from '../../lib'
import { t } from '../../lib/lang'
import { isHeroControlled } from '../../lib/unitControl'
import type {
  BuildingEntity,
  RuntimeEntity,
  UnitCommandOptions,
  UnitCreationExtra,
  UnitEntity,
} from '../../types/entities'
import type { RuntimeCell } from '../../types/map'
import type { ActionProps } from '../../lib/combat'

function isRuntimeEntity(value: RuntimeEntity | RuntimeCell | null | undefined): value is RuntimeEntity {
  return Boolean(value && !('has' in value && 'corpses' in value))
}

function getActionSheet(work: string | null | undefined, action: string | null | undefined, unit: UnitEntity) {
  if (!work) {
    return
  }
  const actionSheet = action === ACTION_TYPES.takemeat ? SHEET_TYPES.harvest : SHEET_TYPES.action
  return Assets.cache.get(unit.allAssets?.[work]?.[actionSheet] ?? '')
}

function checkActionCondition(
  source: UnitEntity,
  target: object | null | undefined,
  action?: string,
  props?: ActionProps | UnitCreationExtra
): boolean {
  if (!target) return false
  const actionProps =
    action === ACTION_TYPES.train && !props ? { trainingType: source.trainingTargetType ?? '' } : props
  return getActionCondition(source, target as RuntimeEntity, action ?? '', actionProps as ActionProps)
}

// Applies the work/texture/cargo bookkeeping a work reassignment needs: drops mismatched
// cargo when switching to an incompatible gather type, and swaps in the right animation
// sheets. Extracted out of commonSendTo so hero-direct triggers (heroTools.ts) can reuse it
// without going through the pathing/command-queue machinery meant for AI-controlled units.
export function applyWorkForAction(unit: UnitEntity, work: string, action: string | null): void {
  const menu = unit.context?.menu
  const workFromLoading = getWorkWithLoadingType(unit.loadingType ?? '')
  if (
    work !== WORK_TYPES.builder &&
    work !== workFromLoading &&
    !(WORK_FOOD_TYPES.includes(work) && WORK_FOOD_TYPES.includes(workFromLoading ?? ''))
  ) {
    unit.loading = 0
    unit.loadingType = null
    unit.updateInterfaceLoading?.()
  }
  if (unit.work === work && unit.action === action) return
  unit.work = work
  if (unit.owner?.isPlayed && unit.owner.selectedUnit === unit) {
    menu?.updateInfo?.(MENU_INFO_IDS.type, t(unit.type === UNIT_TYPES.villager ? unit.work || unit.type : unit.type))
  }
  const workAssets = unit.allAssets?.[work]
  if (workAssets) {
    unit.actionSheet = getActionSheet(work, action, unit)
    if (!unit.loading) {
      unit.standingSheet = Assets.cache.get(workAssets[SHEET_TYPES.standing])
      unit.walkingSheet = Assets.cache.get(workAssets[SHEET_TYPES.walking])
      unit.dyingSheet = Assets.cache.get(workAssets[SHEET_TYPES.dying])
      unit.corpseSheet = Assets.cache.get(workAssets[SHEET_TYPES.corpse])
    }
  }
  // If the unit is already moving when AI/job assignment changes its role,
  // refresh the walking animation immediately so the sprite matches the new work.
  if (unit.path?.length) {
    unit.setTextures?.(SHEET_TYPES.walking)
  }
}

export class UnitCommands {
  unit: UnitEntity

  constructor(unit: UnitEntity) {
    this.unit = unit
  }

  getActionCondition(target: object | null | undefined, action?: string, props?: ActionProps | UnitCreationExtra) {
    return checkActionCondition(this.unit, target, action, props)
  }

  isRedundantOrder(
    target: RuntimeEntity | null | undefined,
    work: string | null | undefined,
    action: string | null | undefined
  ): boolean {
    const unit = this.unit
    const dest = isRuntimeEntity(unit.dest) ? unit.dest : null
    if (!target || dest?.label !== target.label) return false
    if (unit.work !== work || unit.action !== action) return false
    return (unit.path?.length ?? 0) > 0 || Boolean(unit.isUnitAtDest?.(action, target))
  }

  commonSendTo(
    target: RuntimeEntity,
    work: string,
    action: string | null,
    keepPrevious: boolean | UnitCommandOptions,
    immediate = false,
    preserveBuildQueue = false
  ) {
    const unit = this.unit
    if (!target || target.isDestroyed || unit.isDead) return false
    if (!preserveBuildQueue) unit.buildQueue = []
    if (action && !checkActionCondition(unit, target, action)) return false
    if (unit.actionLocked) return unit.queueOrder?.(target, action)
    if (this.isRedundantOrder(target, work, action)) return false

    // The hero never auto-resumes a previous job — it's player-controlled, not AI, and
    // silently walking it back to a gather spot would be the same unwanted autonomy as
    // pathing it there in the first place.
    const shouldRememberPreviousTask =
      keepPrevious &&
      unit.type === UNIT_TYPES.villager &&
      !isHeroControlled(unit) &&
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

    applyWorkForAction(unit, work, action)
    setVillagerAutonomy?.(unit, getAutonomyJobForWork?.(work) ?? null)
    unit.previousDest = keepPrevious ? unit.previousDest : null

    // AI job switches must bypass the public command throttle, otherwise the villager
    // can change work/action while still keeping the old destination.
    if (immediate || !unit.owner?.isPlayed) {
      return unit.sendToEvt?.(target, action ?? undefined)
    }
    return unit.sendTo?.(target, action ?? undefined)
  }

  sendToWithCell(target: RuntimeEntity, arrivalCell: RuntimeCell, action: string) {
    const unit = this.unit
    const map = unit.context?.map
    if (unit.actionLocked) {
      return unit.queueOrder?.(() => this.sendToWithCell(target, arrivalCell, action))
    }
    unit.handleChangeDest?.()
    unit.stopInterval?.()
    if (!target || target.isDestroyed || unit.isDead || !arrivalCell) return false
    if (action && !checkActionCondition(unit, target, action)) return false
    if (unit.isUnitAtDest?.(action, target)) {
      unit.setDest?.(target)
      unit.action = action
      unit.degree = getInstanceDegree(unit, target.x, target.y)
      unit.getAction?.(action)
      return true
    }
    if (!map) return false
    const path = getInstancePath(unit, arrivalCell.i, arrivalCell.j, map)
    if (path.length) {
      unit.setDest?.(target)
      unit.action = action
      unit.setPath?.(path)
      return true
    } else {
      unit.sendToEvt?.(target, action)
      return true
    }
  }

  sendToDelivery() {
    const unit = this.unit
    const map = unit.context?.map
    let buildingTypes: string[] = [BUILDING_TYPES.townCenter]
    const buildings = {
      Granary: unit.owner?.config.buildings.Granary,
      StoragePit: unit.owner?.config.buildings.StoragePit,
    }
    for (const [key, value] of Object.entries(buildings)) {
      const accept = (value as { accept?: string[] } | undefined)?.accept
      if (accept && accept.includes(unit.loadingType ?? '')) {
        buildingTypes.push(key)
        break
      }
    }

    const targets = (unit.owner?.buildings ?? []).filter(building =>
      checkActionCondition(unit, building, ACTION_TYPES.delivery, { buildingTypes })
    )
    const target = getClosestInstance(unit, targets)
    if (!target) {
      unit.stop?.()
      return
    }
    if (unit.dest) {
      unit.previousDest = unit.dest
    } else if (map) {
      unit.previousDest = map.grid[unit.i][unit.j]
    }
    unit.sendToEvt?.(target, ACTION_TYPES.delivery)
  }

  sendToAttack(target: RuntimeEntity) {
    if (!checkActionCondition(this.unit, target, ACTION_TYPES.attack)) return
    return this.commonSendTo(target, WORK_TYPES.attacker, ACTION_TYPES.attack, { resource: 'attack' })
  }

  sendToConvert(target: RuntimeEntity) {
    return this.commonSendTo(target, WORK_TYPES.healer, ACTION_TYPES.convert, false)
  }

  sendToTakeMeat(target: RuntimeEntity, immediate = false) {
    return this.commonSendTo(
      target,
      WORK_TYPES.hunter,
      ACTION_TYPES.takemeat,
      { actionSheet: SHEET_TYPES.harvest },
      immediate
    )
  }

  sendToHunt(target: RuntimeEntity, immediate = false) {
    return this.commonSendTo(target, WORK_TYPES.hunter, ACTION_TYPES.hunt, false, immediate)
  }

  sendToBuilding(target: BuildingEntity, preserveBuildQueue = false) {
    if (!preserveBuildQueue) this.unit.buildQueue = []
    return this.commonSendTo(target, WORK_TYPES.builder, ACTION_TYPES.build, true, false, true)
  }

  sendToBuildingQueue(targets: BuildingEntity[]) {
    this.unit.buildQueue = targets.filter(target => checkActionCondition(this.unit, target, ACTION_TYPES.build))
    return this.continueBuildingQueue()
  }

  continueBuildingQueue(): boolean {
    const unit = this.unit
    while (unit.buildQueue?.length) {
      const target = unit.buildQueue[0]
      if (checkActionCondition(unit, target, ACTION_TYPES.build)) {
        unit.previousDest = null
        this.sendToBuilding(target, true)
        return true
      }
      unit.buildQueue.shift()
    }
    unit.buildQueue = []
    return false
  }

  sendToFarm(target: RuntimeEntity, immediate = false) {
    return this.commonSendTo(target, WORK_TYPES.farmer, ACTION_TYPES.farm, false, immediate)
  }

  sendToTree(target: RuntimeEntity, immediate = false) {
    return this.commonSendTo(target, WORK_TYPES.woodcutter, ACTION_TYPES.chopwood, false, immediate)
  }

  sendToBerrybush(target: RuntimeEntity, immediate = false) {
    return this.commonSendTo(target, WORK_TYPES.forager, ACTION_TYPES.forageberry, false, immediate)
  }

  sendToStone(target: RuntimeEntity, immediate = false) {
    return this.commonSendTo(target, WORK_TYPES.stoneminer, ACTION_TYPES.minestone, false, immediate)
  }

  sendToGold(target: RuntimeEntity, immediate = false) {
    return this.commonSendTo(target, WORK_TYPES.goldminer, ACTION_TYPES.minegold, false, immediate)
  }
}
