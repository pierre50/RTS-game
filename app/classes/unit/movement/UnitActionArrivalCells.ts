import { ACTION_TYPES, FAMILY_TYPES } from '../../../constants'
import { getBuildingEntryCell, getBuildingInteriorEntryCell } from '../../../lib/buildings/interiors'
import { getEntitySpaceMapLike } from '../../../lib/mapSpaces'
import type { RuntimeEntity, UnitEntity } from '../../../types/entities'
import type { RuntimeCell } from '../../../types/map'

function isRuntimeEntity(value: RuntimeEntity | RuntimeCell | null | undefined): value is RuntimeEntity {
  return Boolean(value && !('has' in value && 'corpses' in value))
}

export function getActionArrivalCell(
  unit: UnitEntity,
  dest: RuntimeEntity | RuntimeCell | null | undefined,
  action: string | null | undefined
): RuntimeCell | null {
  if (!isRuntimeEntity(dest) || dest.family !== FAMILY_TYPES.building) {
    return null
  }
  const grid = getEntitySpaceMapLike(unit, unit.context?.map)?.grid
  if (!action) return getBuildingEntryCell(dest, grid)
  if (![ACTION_TYPES.train, ACTION_TYPES.delivery].includes(action)) return null
  if (action === ACTION_TYPES.train) return getBuildingEntryCell(dest, grid)
  return getBuildingInteriorEntryCell(dest, grid)
}

export function isUnitOnActionArrivalCell(
  unit: UnitEntity,
  dest: RuntimeEntity | RuntimeCell | null | undefined,
  action: string | null | undefined
): boolean {
  const arrivalCell = getActionArrivalCell(unit, dest, action)
  return Boolean(arrivalCell && unit.i === arrivalCell.i && unit.j === arrivalCell.j)
}
