import { canMoveForVillageSupply } from '../../../lib/units/village/villageSupplyTrips'
import { ACTION_TYPES, SHEET_TYPES } from '../../../constants'
import { campAnchor, canCampPursue } from '../../../lib/units/campBehavior'
import { isUnitSuspended, wakeUnitSimulation } from '../../../lib/units/unitSuspension'
import { withinVillageActivity } from '../../../lib/units/village/villageActivity'
import type { RuntimeEntity, UnitEntity } from '../../../types/entities'
import type { RuntimeCell } from '../../../types/map'
import { isRuntimeEntity } from './UnitMovementHelpers'

type MoveOrderDest = RuntimeEntity | RuntimeCell | null

/** Wakes units for orders that matter and keeps village workers within their activity range. */
export function admitMoveOrder(unit: UnitEntity, dest: MoveOrderDest, action: string | null): boolean {
  if (action === ACTION_TYPES.attack || unit.owner?.isPlayed) wakeUnitSimulation(unit)
  if (isUnitSuspended(unit)) return false
  if (
    dest &&
    action !== ACTION_TYPES.attack &&
    !withinVillageActivity(unit, dest) &&
    !canMoveForVillageSupply(unit, dest, action)
  )
    return false
  if (dest && canMoveForVillageSupply(unit, dest, action) && unit.campBehavior) unit.campBehavior.phase = 'guard'
  return true
}

/** Camp leashes and resting defenders settle attack orders first; `null` lets routing continue. */
export function resolveAttackOrder(unit: UnitEntity, dest: MoveOrderDest, action: string | null): boolean | null {
  if (action !== ACTION_TYPES.attack) return null
  const target = isRuntimeEntity(dest) ? dest : null
  if (target && !canCampPursue(unit, target)) return false
  if (campAnchor(unit)) {
    unit.campBehavior ??= { phase: 'guard' }
    unit.campBehavior.phase = 'pursue'
  }
  if (target && unit.context?.unitRest?.interruptRestForCombat?.(unit, target)) return true
  return null
}

/** The same entity order while already walking to it, or already acting on it, needs no new route. */
export function isRedundantMoveOrder(
  unit: UnitEntity,
  dest: MoveOrderDest,
  action: string | null,
  forceRepath: boolean
): boolean {
  const current = unit.dest
  if (forceRepath || !isRuntimeEntity(dest) || !isRuntimeEntity(current) || current.label !== dest.label) return false
  if (unit.action !== action) return false
  return (
    (unit.path?.length ?? 0) > 0 ||
    Boolean(!unit.inactif && unit.currentSheet !== SHEET_TYPES.walking && unit.isUnitAtDest?.(action, dest))
  )
}
