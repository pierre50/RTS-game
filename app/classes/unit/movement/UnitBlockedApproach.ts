import { UNIT_TYPES } from '../../../constants'
import { getCellsAroundPoint, getInstanceDegree, getInstancePath, markVillagerAutonomyTargetRejected } from '../../../lib'
import { canUnitWaitOnCell, createReservedPassageCellLookup } from '../../../lib/buildings/passageCells'
import { getEntitySpaceMapLike } from '../../../lib/mapSpaces'
import type { RuntimeEntity, UnitEntity } from '../../../types/entities'
import type { RuntimeCell } from '../../../types/map'
import {
  BLOCKED_GATHER_APPROACH_ACTIONS,
  MAX_BLOCKED_GATHER_APPROACH_DISTANCE,
  isRuntimeEntity,
  resumeAutonomyBeforeStopping,
} from './UnitMovementHelpers'
import { createPassagePathfindingOptions } from './UnitMovementPassage'

export type ReachableApproach = { cell: RuntimeCell; path: RuntimeCell[] }

/** Nearest waitable ring around the target with the shortest path, widening up to the unit's sight. */
export function findReachableApproachCell(
  unit: UnitEntity,
  target: RuntimeEntity | RuntimeCell,
  minDistance = 2,
  allowCurrentCell = false
): ReachableApproach | null {
  const map = getEntitySpaceMapLike(unit, unit.context?.map)
  if (!map) return null
  const maxDistance = Math.max(
    2,
    Math.min(unit.sight || MAX_BLOCKED_GATHER_APPROACH_DISTANCE, MAX_BLOCKED_GATHER_APPROACH_DISTANCE)
  )
  let best: ReachableApproach | null = null
  const passageLookup = createReservedPassageCellLookup(unit.context)
  const pathfinding = createPassagePathfindingOptions(passageLookup)

  for (let distance = minDistance; distance <= maxDistance; distance++) {
    const cells = getCellsAroundPoint(target.i, target.j, map.grid, distance, cell =>
      canUnitWaitOnCell(unit, cell, { passageLookup })
    )
    cells.sort(
      (a, b) =>
        Math.abs(a.i - target.i) + Math.abs(a.j - target.j) - (Math.abs(b.i - target.i) + Math.abs(b.j - target.j)) ||
        Math.abs(a.i - unit.i) + Math.abs(a.j - unit.j) - (Math.abs(b.i - unit.i) + Math.abs(b.j - unit.j))
    )

    for (const cell of cells) {
      if (allowCurrentCell && unit.i === cell.i && unit.j === cell.j) return { cell, path: [] }
      const path = getInstancePath(unit, cell.i, cell.j, map, pathfinding)
      if (path.length && (!best || path.length < best.path.length)) {
        best = { cell, path }
      }
    }
    if (best) return best
  }

  return null
}

export function startBlockedGatherApproach(
  unit: UnitEntity,
  dest: RuntimeEntity | null | undefined,
  action: string
): boolean {
  if (unit.type !== UNIT_TYPES.villager || !BLOCKED_GATHER_APPROACH_ACTIONS.has(action)) return false
  if (!dest || dest.isDestroyed || !unit.getActionCondition?.(dest, action)) return false
  if (unit.blockedGatherApproach?.target === dest && unit.blockedGatherApproach.action === action) return false

  const approach = findReachableApproachCell(unit, dest)
  if (!approach) return false

  unit.setDest?.(dest)
  unit.action = action
  unit.blockedGatherApproach = { target: dest, action }
  unit.setPath?.(approach.path)
  return true
}

export function retryBlockedGatherApproach(unit: UnitEntity): boolean {
  const blockedGatherApproach = unit.blockedGatherApproach
  if (!blockedGatherApproach) return false

  unit.blockedGatherApproach = null
  const { target, action } = blockedGatherApproach
  if (!target || target.isDestroyed || !unit.getActionCondition?.(target, action)) {
    markVillagerAutonomyTargetRejected?.(unit, target)
    unit.affectNewDest?.()
    return true
  }

  markVillagerAutonomyTargetRejected?.(unit, target)
  unit.sendToEvt?.(target, action, { forceRepath: true, allowBlockedGatherApproach: false })
  return true
}

export function handleBlockedApproachFailure(
  unit: UnitEntity,
  dest: RuntimeEntity | RuntimeCell,
  action: string | null,
  allowBlockedGatherApproach: boolean
): void {
  if (
    allowBlockedGatherApproach &&
    startBlockedGatherApproach(unit, isRuntimeEntity(dest) ? dest : null, action ?? '')
  ) {
    return
  }
  if (action) unit.affectNewDest?.()
  else if (!resumeAutonomyBeforeStopping(unit)) unit.stop?.()
}

export function routeToReachableWaterApproach(
  unit: UnitEntity,
  dest: RuntimeEntity | RuntimeCell,
  action: string | null,
  allowBlockedGatherApproach: boolean
): boolean {
  const approach = findReachableApproachCell(unit, dest, 1, true)
  if (!approach) {
    handleBlockedApproachFailure(unit, dest, action, allowBlockedGatherApproach)
    return true
  }
  if (!action) {
    // The original order already decided whether to clear the job; this is only a detour.
    unit.sendToEvt?.(approach.cell, null, { preserveAutonomy: true })
    return true
  }
  unit.setDest?.(dest)
  unit.action = action
  if (approach.path.length) {
    unit.setPath?.(approach.path)
  } else {
    unit.degree = getInstanceDegree(unit, dest.x, dest.y)
    unit.getAction?.(action)
  }
  return true
}
