import { canUnitUseCellAsIdleDestination, canUnitWaitOnCell, type PassageStopOptions } from '../buildings/passageCells'
import { isGroundResourceType } from '../resources/groundResourceRegrowth'
import type { UnitEntity } from '../../types/entities'
import type { RuntimeCell } from '../../types/map'

/** A pickup occupies its cell visually, but does not block the unit coming to collect it. */
export function canUseResourceApproachCell(
  unit: UnitEntity,
  cell: RuntimeCell,
  target: { type?: string; label?: string },
  options: PassageStopOptions = {}
): boolean {
  if (Boolean(canUnitUseCellAsIdleDestination(unit, cell, options))) return true
  return Boolean(
    target.type &&
      isGroundResourceType(target.type) &&
      cell.has === target &&
      !cell.solid &&
      !cell.waterBorder &&
      canUnitWaitOnCell(unit, cell, options)
  )
}
