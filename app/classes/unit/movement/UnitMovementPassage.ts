import {
  canUseReservedPassageCellForTransit,
  findNearestPassageWaitingCell,
  shouldUnitAvoidPassageStop,
  unitHasActivePassageStopIntent,
  type ReservedPassageCellLookup,
} from '../../../lib/buildings/passageCells'
import type { PathfindingOptions } from '../../../services/Pathfinding'
import type { RuntimeEntity, UnitEntity } from '../../../types/entities'
import type { RuntimeCell } from '../../../types/map'
import { isRuntimeEntity } from './UnitMovementHelpers'

export type PassageLookup = ReservedPassageCellLookup

export function createPassagePathfindingOptions(passageLookup: PassageLookup): PathfindingOptions<RuntimeCell> {
  return {
    canPassThroughSolidCell: cell => canUseReservedPassageCellForTransit(cell, passageLookup),
  }
}

export function allowsUnitPassageStop(
  unit: UnitEntity,
  dest: RuntimeEntity | RuntimeCell,
  allowPassageStop: boolean
): boolean {
  return allowPassageStop || (!isRuntimeEntity(dest) && unitHasActivePassageStopIntent(unit, dest))
}

/** Plain moves onto a reserved passage cell stop at the nearest waiting cell; `null` when there is none. */
export function resolvePassageDestination(
  unit: UnitEntity,
  dest: RuntimeEntity | RuntimeCell,
  action: string | null,
  passageStopAllowed: boolean,
  passageLookup: PassageLookup
): RuntimeEntity | RuntimeCell | null {
  if (
    !action &&
    !isRuntimeEntity(dest) &&
    shouldUnitAvoidPassageStop(unit, dest, { allowPassageStop: passageStopAllowed, passageLookup })
  ) {
    const waitingCell = findNearestPassageWaitingCell(unit, dest, { passageLookup })
    if (!waitingCell) {
      return null
    }
    dest = waitingCell.cell
  }
  return dest
}
