import { SHEET_TYPES, UNIT_TYPES } from '../../../constants'
import { logStationaryVillager } from './villagerJobDiagnostics'
import { ACTION_TYPES } from '../../../constants'
import type { RuntimeEntity, UnitEntity } from '../../../types/entities'
export function workTarget(unit: UnitEntity): RuntimeEntity | null {
  const target = unit.blockedGatherApproach?.target ?? unit.dest
  return target && !('has' in target) ? target : null
}

export function progressSnapshot(unit: UnitEntity): unknown[] {
  const target = workTarget(unit)
  const moving = Boolean(unit.path?.length)
  return [
    unit.x,
    unit.y,
    unit.i,
    unit.j,
    unit.spaceId,
    unit.dest,
    unit.action,
    moving ? null : unit.gatherProgressState?.progress,
    moving ? null : target?.quantity,
    moving ? null : target?.hitPoints,
    target?.isDestroyed,
    target?.isDead,
    ...Object.entries(unit.inventory?.resources ?? {})
      .sort(([a], [b]) => a.localeCompare(b))
      .flat(),
  ]
}

export function hasInvalidTarget(unit: UnitEntity): boolean {
  const target = workTarget(unit)
  if (!target) return false
  const action = unit.blockedGatherApproach?.action ?? unit.action
  if (target.isDestroyed || (target.isDead && action !== ACTION_TYPES.takemeat)) return true
  if (target.quantity != null && target.quantity <= 0 && action !== ACTION_TYPES.build) return true
  return Boolean(action && unit.getActionCondition?.(target, action) === false)
}

export function observeWalking(
  unit: UnitEntity,
  now: number,
  observations: WeakMap<
    UnitEntity,
    { x: number; y: number; space: UnitEntity['spaceId']; since: number; logged: boolean }
  >
): void {
  if (
    unit.type !== UNIT_TYPES.villager ||
    unit.isDead ||
    unit.isDestroyed ||
    unit.currentSheet !== SHEET_TYPES.walking
  ) {
    observations.delete(unit)
    return
  }
  let state = observations.get(unit)
  if (!state || state.x !== unit.x || state.y !== unit.y || state.space !== unit.spaceId) {
    state = { x: unit.x, y: unit.y, space: unit.spaceId, since: now, logged: false }
    observations.set(unit, state)
  }
  if (!state.logged && now - state.since >= 5000) {
    state.logged = true
    logStationaryVillager(unit)
  }
}
