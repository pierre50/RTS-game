import {
  ACTION_TYPES,
  MENU_INFO_IDS,
  MINING_RESOURCE_CONFIG,
  RESOURCE_TYPES,
  SHEET_TYPES,
  UNIT_TYPES,
  WORK_TYPES,
} from '../../constants'
import {
  getActionCondition,
  getInstanceDegree,
  getInstancePath,
  getAutonomyJobForWork,
  isWheatMature,
  setVillagerAutonomy,
} from '../../lib'
import { getNearestAvailableStableForUnit } from '../../lib/horses/horseCapture'
import { t } from '../../lib/lang'
import { applyDiplomaticAggression } from '../../lib/combat/diplomaticAggression'
import { isHeroControlled } from '../../lib/units/unitControl'
import { applyUnitWorkAssets } from '../../lib/units/unitWorkAppearance'
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

function checkActionCondition(
  source: UnitEntity,
  target: object | null | undefined,
  action?: string,
  props?: ActionProps | UnitCreationExtra
): boolean {
  if (!target) return false
  const actionProps = action === ACTION_TYPES.train && !props ? { trainingType: source.trainingTargetType ?? '' } : props
  return getActionCondition(source, target as RuntimeEntity, action ?? '', actionProps as ActionProps)
}

function canShowTargetAlert(unit: UnitEntity, target: RuntimeEntity): boolean {
  return Boolean(unit.owner?.isPlayed && (unit.context?.controls?.instanceInCamera?.(target) ?? true))
}

// Applies the work/texture bookkeeping a work reassignment needs. Extracted out of
// commonSendTo so hero-direct triggers can reuse it without command-queue machinery.
export function applyWorkForAction(unit: UnitEntity, work: string, action: string | null): void {
  const menu = unit.context?.menu
  if (unit.work === work && unit.action === action) return
  unit.work = work
  if (unit.owner?.isPlayed && unit.owner.selectedUnit === unit) {
    menu?.updateInfo?.(MENU_INFO_IDS.type, t(unit.type === UNIT_TYPES.villager ? unit.work || unit.type : unit.type))
  }
  applyUnitWorkAssets(unit, work, { action, refreshEquipmentStats: true })
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
    preserveBuildQueue = false,
    actionProps?: ActionProps
  ) {
    const unit = this.unit
    if (!target || target.isDestroyed || unit.isDead) return false
    if (!preserveBuildQueue) unit.buildQueue = []
    if (action && !checkActionCondition(unit, target, action, actionProps)) {
      if (
        action === ACTION_TYPES.farm &&
        target.type === RESOURCE_TYPES.wheat &&
        !isWheatMature(target) &&
        canShowTargetAlert(unit, target)
      ) {
        unit.context?.menu?.showMessage(t('wheatNotReady'), 'warning')
      } else if (
        action === ACTION_TYPES.forageberry &&
        target.type === RESOURCE_TYPES.berrybush &&
        (target.quantity ?? 0) <= 0 &&
        canShowTargetAlert(unit, target)
      ) {
        unit.context?.menu?.showMessage(t('berrybushDepleted'), 'warning')
      }
      return false
    }
    if (unit.actionLocked) {
      return unit.queueOrder?.(() => this.commonSendTo(target, work, action, keepPrevious, immediate, preserveBuildQueue, actionProps))
    }
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

  sendToAttack(target: RuntimeEntity, options: UnitCommandOptions = {}) {
    if (!checkActionCondition(this.unit, target, ACTION_TYPES.attack)) {
      if (!applyDiplomaticAggression(this.unit, target).hostileNow) return
      if (!checkActionCondition(this.unit, target, ACTION_TYPES.attack)) return
    }
    return this.commonSendTo(
      target,
      WORK_TYPES.attacker,
      ACTION_TYPES.attack,
      { resource: 'attack', keepPrevious: options.keepPrevious },
      false,
      false
    )
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

  sendToCaptureHorse(target: RuntimeEntity, immediate = false) {
    const unit = this.unit
    const nearestStable = getNearestAvailableStableForUnit(unit, target)
    const hasAvailableStable = Boolean(nearestStable)
    const canCaptureTarget = this.getActionCondition(target, ACTION_TYPES.captureHorse)
    if (!hasAvailableStable) {
      return false
    }
    if (!canCaptureTarget) {
      return false
    }
    const commandSent = this.commonSendTo(target, WORK_TYPES.horseCapture, ACTION_TYPES.captureHorse, false, immediate) !== false
    const currentDest = isRuntimeEntity(unit.dest) ? unit.dest : null
    if (!commandSent && unit.action === ACTION_TYPES.captureHorse && currentDest?.label === target.label) {
      unit.sendToEvt?.(target, ACTION_TYPES.captureHorse, { forceRepath: true })
      return true
    }
    return commandSent
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
    return this.sendToMineResource(target, immediate)
  }

  sendToGold(target: RuntimeEntity, immediate = false) {
    return this.sendToMineResource(target, immediate)
  }

  sendToCopper(target: RuntimeEntity, immediate = false) {
    return this.sendToMineResource(target, immediate)
  }

  sendToIron(target: RuntimeEntity, immediate = false) {
    return this.sendToMineResource(target, immediate)
  }

  sendToMineResource(target: RuntimeEntity, immediate = false) {
    const config = MINING_RESOURCE_CONFIG?.[target.type as keyof typeof MINING_RESOURCE_CONFIG]
    if (!config) return false
    return this.commonSendTo(target, config.work, config.action, false, immediate)
  }
}
