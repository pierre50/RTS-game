import type { UnitEntity } from '../../types/entities'
import type { TimedUnitRestState } from './UnitRestLifecycle'
import {
canUseUnitRest,
getRestTransitionCell,
getRestTransitionDurationMs,
isSleepTime,
REST_ORDER_GRACE_MS,
} from './UnitRestRules'

export function hasPendingRestOrder(
  unit: UnitEntity,
  targetCell: UnitEntity['currentCell'] | null | undefined
): boolean {
  const pending = unit.pendingOrder
  if (!pending || !targetCell) return false
  if (pending.execute) return true
  return pending.dest === targetCell || (pending.dest?.i === targetCell.i && pending.dest?.j === targetCell.j)
}

function moveUnitToRestSite(unit: UnitEntity, state: TimedUnitRestState): void {
  state.status = 'movingToRest'
  state.transitionTargetCell = null
  state.transitionUntilMs = undefined
  state.startedAtMs = unit.context?.scheduler?.elapsedMs ?? state.startedAtMs ?? 0
  state.retryCount = 0
  unit.sendToEvt?.(state.targetCell ?? null, null, {
    forceRepath: true,
    preserveAutonomy: true,
    allowPassageStop: state.location === 'shelter',
  })
}

export function hasFailedTransitionPath(
  unit: UnitEntity,
  transitionCell: UnitEntity['currentCell'] | null | undefined,
  arrived: boolean,
  startedAtMs: number | null | undefined
): boolean {
  const elapsed = (unit.context?.scheduler?.elapsedMs ?? 0) - (startedAtMs ?? 0)
  return Boolean(
    !arrived &&
      !hasPendingRestOrder(unit, transitionCell) &&
      elapsed >= REST_ORDER_GRACE_MS &&
      !unit.path?.length &&
      unit.dest !== transitionCell
  )
}

export function updateWindingDownRestUnit(unit: UnitEntity, state: TimedUnitRestState): boolean {
  if (state.status !== 'windingDown') return false
  if (!isSleepTime(unit.context!) || !canUseUnitRest(unit)) {
    unit.shelterState = null
    return true
  }

  const now = unit.context?.scheduler?.elapsedMs ?? 0
  const transitionCell = state.transitionTargetCell
  const arrived = Boolean(transitionCell && unit.i === transitionCell.i && unit.j === transitionCell.j)
  const failedPath = hasFailedTransitionPath(unit, transitionCell, arrived, state.startedAtMs)

  if (now < (state.transitionUntilMs ?? now) && !failedPath) return true

  const step = state.transitionStep ?? 0
  if (step < 1 && !failedPath) {
    const restSite = {
      location: state.location,
      shelter: state.shelter ?? null,
      targetCell: state.targetCell!,
    }
    const nextCell = getRestTransitionCell(unit, restSite)
    if (nextCell && nextCell !== transitionCell && !arrived) {
      state.transitionStep = step + 1
      state.transitionTargetCell = nextCell
      state.transitionUntilMs = now + Math.floor(getRestTransitionDurationMs(unit, 'windingDown') / 2)
      state.startedAtMs = now
      unit.sendToEvt?.(nextCell, null, { forceRepath: true, preserveAutonomy: true })
      return true
    }
  }

  moveUnitToRestSite(unit, state)
  return true
}
