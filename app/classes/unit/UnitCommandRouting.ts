import { ACTION_TYPES, RESOURCE_TYPES, UNIT_TYPES, WORK_TYPES } from '../../constants'
import { getAutonomyJobForWork, getInstanceDegree, getInstancePath, isWheatMature, setVillagerAutonomy } from '../../lib'
import type { ActionProps } from '../../lib/combat'
import { t } from '../../lib/lang'
import { workToolBlockedMessageKey } from '../../lib/equipment/workTools'
import { knownTarget, playerSeesTarget } from '../../lib/units/playerTargetKnowledge'
import { routeToRememberedTarget } from '../../lib/units/combat/targetPursuit'
import { isHeroControlled } from '../../lib/units/unitControl'
import type { RuntimeEntity, UnitCommandOptions, UnitEntity } from '../../types/entities'
import type { RuntimeCell } from '../../types/map'
import { canShowTargetAlert, checkActionCondition } from './UnitCommandConditions'
import { applyWorkForAction } from './UnitResourceDeliveryCommands'

/** A direct order takes ownership even when it repeats the current automatic task. */
export function releaseCollectiveTask(unit: UnitEntity, immediate: boolean) {
  if (immediate || unit.assigningAutonomousJob) return
  unit.collectiveTask = null
  unit.collectiveHome = undefined
}

export function applyOrderWork(unit: UnitEntity, work: string, action: string | null) {
  applyWorkForAction(unit, work, action)
  setVillagerAutonomy?.(unit, getAutonomyJobForWork?.(work) ?? null)
}

/** Routes toward a target the player no longer sees but still remembers. */
export function routeToKnownUnseenTarget(
  unit: UnitEntity,
  target: RuntimeEntity,
  work: string,
  action: string | null,
  immediate: boolean
): boolean {
  if (playerSeesTarget(unit.owner, target) || !knownTarget(unit.owner, target, unit)) return false
  releaseCollectiveTask(unit, immediate)
  applyOrderWork(unit, work, action)
  return Boolean(routeToRememberedTarget(unit, target, action))
}

/** Returns true when the order is rejected by its action condition (and warns the player). */
export function rejectBlockedOrder(
  unit: UnitEntity,
  target: RuntimeEntity,
  action: string | null,
  immediate: boolean,
  actionProps?: ActionProps
): boolean {
  if (!action || checkActionCondition(unit, target, action, actionProps)) return false
  const toolBlockedMessage = workToolBlockedMessageKey(unit, action, target.type)
  if (toolBlockedMessage && unit.owner?.isPlayed && !immediate)
    unit.context?.menu?.showMessage(t(toolBlockedMessage), 'warning')
  if (
    action === ACTION_TYPES.farm &&
    target.type === RESOURCE_TYPES.wheat &&
    !isWheatMature(target) &&
    canShowTargetAlert(unit, target)
  ) {
    unit.context?.menu?.showMessage(t('wheatNotReady'), 'warning')
  }
  return true
}

export function interruptRestForAttack(unit: UnitEntity, target: RuntimeEntity, action: string | null): boolean {
  return action === ACTION_TYPES.attack && Boolean(unit.context?.unitRest?.interruptRestForCombat?.(unit, target))
}

/**
 * The hero never auto-resumes a previous job — it's player-controlled, not AI, and
 * silently walking it back to a gather spot would be the same unwanted autonomy as
 * pathing it there in the first place.
 */
export function rememberPreviousTask(unit: UnitEntity, keepPrevious: boolean | UnitCommandOptions) {
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
}

/**
 * AI job switches must bypass the public command throttle, otherwise the villager
 * can change work/action while still keeping the old destination.
 */
export function dispatchOrder(unit: UnitEntity, target: RuntimeEntity, action: string | null, immediate: boolean) {
  if (immediate || action === ACTION_TYPES.attack || !unit.owner?.isPlayed) {
    return unit.sendToEvt?.(target, action ?? undefined)
  }
  return unit.sendTo?.(target, action ?? undefined)
}

/** Body of UnitCommands.sendToWithCell once the rest/lock guards have passed. */
export function sendUnitToArrivalCell(
  unit: UnitEntity,
  target: RuntimeEntity,
  arrivalCell: RuntimeCell,
  action: string
): boolean {
  const map = unit.context?.map
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
  }
  unit.sendToEvt?.(target, action)
  return true
}
