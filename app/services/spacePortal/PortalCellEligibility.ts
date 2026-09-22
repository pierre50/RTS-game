import type { UnitEntity } from '../../types/entities'
import type { RuntimeCell } from '../../types/map'

export function isPortalCell(cell: RuntimeCell | null | undefined): cell is RuntimeCell {
  return Boolean(cell && !cell.terrainHidden && !cell.border && !cell.waterBorder && cell.category !== 'Water')
}

export function canOccupyPortalCell(cell: RuntimeCell | null | undefined, unit: UnitEntity): cell is RuntimeCell {
  if (!isPortalCell(cell)) return false
  return !cell.solid || cell.has === unit || cell.has?.label === unit.label
}
