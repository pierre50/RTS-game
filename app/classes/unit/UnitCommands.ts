import { ACTION_TYPES, MINING_RESOURCE_CONFIG, RESOURCE_TYPES, SHEET_TYPES, WORK_TYPES } from '../../constants'
import type { ActionProps } from '../../lib/combat'
import { applyDiplomaticAggression } from '../../lib/combat/diplomaticAggression'
import { getNearestAvailableStableForUnit } from '../../lib/horses/horseCapture'
import { workForToolUse } from '../../lib/equipment/workTools'
import { canCampPursue } from '../../lib/units/camps/campBehavior'
import { wakeUnitSimulation } from '../../lib/units/unitSuspension'
import type {
  BuildingEntity,
  ResourceEntity,
  RuntimeEntity,
  UnitCommandOptions,
  UnitCreationExtra,
  UnitEntity,
  UnitResourceDeliveryReturnTask,
} from '../../types/entities'
import type { RuntimeCell } from '../../types/map'
import { currentResourceRecord, isCompactResourceRecord, resolveResource } from '../resources/CompactResourceSet'
import { checkActionCondition, isRuntimeEntity } from './UnitCommandConditions'
import {
  applyOrderWork,
  dispatchOrder,
  interruptRestForAttack,
  rejectBlockedOrder,
  releaseCollectiveTask,
  rememberPreviousTask,
  routeToKnownUnseenTarget,
  sendUnitToArrivalCell,
} from './UnitCommandRouting'
import { getDeliveryBeforeGatherJobSwitch, sendUnitToDelivery } from './UnitResourceDeliveryCommands'

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
    if (unit.owner?.isPlayed) wakeUnitSimulation(unit)
    if (!target || unit.isDead) return false
    if (isCompactResourceRecord(target)) {
      const current = currentResourceRecord(target as ResourceEntity)
      if (!current || current.isDestroyed) return false
      target = resolveResource(current)
    }
    work = workForToolUse(unit, action, target.type, work)
    if (routeToKnownUnseenTarget(unit, target, work, action, immediate)) return true
    if (target.isDestroyed) return false
    if (!preserveBuildQueue) unit.buildQueue = []
    if (rejectBlockedOrder(unit, target, action, immediate, actionProps)) return false
    if (interruptRestForAttack(unit, target, action)) return true
    if (unit.actionLocked) {
      return unit.queueOrder?.(() =>
        this.commonSendTo(target, work, action, keepPrevious, immediate, preserveBuildQueue, actionProps)
      )
    }
    releaseCollectiveTask(unit, immediate)
    if (this.isRedundantOrder(target, work, action)) return false

    const deliveryTransition = getDeliveryBeforeGatherJobSwitch(unit, target, work, action)
    if (deliveryTransition) return this.sendToDelivery(deliveryTransition.target, deliveryTransition.returnTask)

    rememberPreviousTask(unit, keepPrevious)
    applyOrderWork(unit, work, action)
    unit.previousDest = keepPrevious ? unit.previousDest : null
    return dispatchOrder(unit, target, action, immediate)
  }

  sendToWithCell(target: RuntimeEntity, arrivalCell: RuntimeCell, action: string) {
    const unit = this.unit
    if (interruptRestForAttack(unit, target, action)) return true
    if (unit.actionLocked) {
      return unit.queueOrder?.(() => this.sendToWithCell(target, arrivalCell, action))
    }
    return sendUnitToArrivalCell(unit, target, arrivalCell, action)
  }

  sendToAttack(target: RuntimeEntity, options: UnitCommandOptions = {}) {
    if (!canCampPursue(this.unit, target)) return
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
    const commandSent =
      this.commonSendTo(target, WORK_TYPES.horseCapture, ACTION_TYPES.captureHorse, false, immediate) !== false
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

  sendToDelivery(
    target: BuildingEntity | null = null,
    returnTaskOverride: UnitResourceDeliveryReturnTask | null = null
  ): boolean {
    return sendUnitToDelivery(this.unit, checkActionCondition, target, returnTaskOverride)
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
    const result = this.commonSendTo(target, WORK_TYPES.forager, ACTION_TYPES.forageberry, false, immediate)
    if (result !== false) {
      if (target.type === RESOURCE_TYPES.groundWood) this.unit.autonomousJob = 'wood'
      if (target.type === RESOURCE_TYPES.groundStone) this.unit.autonomousJob = 'stone'
    }
    return result
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

  sendToTin(target: RuntimeEntity, immediate = false) {
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
