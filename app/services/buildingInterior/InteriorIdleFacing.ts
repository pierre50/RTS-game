import { SHEET_TYPES } from '../../constants'
import type { UnitEntity } from '../../types/entities'
import type { RuntimeCell } from '../../types/map'

export type BuildingInteriorIdleFacingSpace = {
  entryCell?: RuntimeCell | null
  grid: RuntimeCell[][]
  size: number
}

function stableHash(value: string): number {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0
  }
  return hash
}

function stableSignedJitter(value: string, maxDegrees: number): number {
  return ((stableHash(value) % 1000) / 999) * maxDegrees * 2 - maxDegrees
}

export function applyBuildingInteriorIdleFacing(
  unit: UnitEntity,
  space: BuildingInteriorIdleFacingSpace,
  cell: RuntimeCell | null | undefined = unit.currentCell
): void {
  if (!cell) return
  const centerCell = space.grid[Math.round(space.size / 2)]?.[Math.round(space.size / 2)] ?? space.entryCell
  if (!centerCell) return
  const dx = centerCell.x - cell.x
  const dy = centerCell.y - cell.y
  const baseDegree = (Math.atan2(dy, dx) * 180) / Math.PI
  unit.degree = baseDegree + stableSignedJitter(unit.label || `${unit.i}:${unit.j}`, 42)
  unit.setTextures?.(SHEET_TYPES.standing)
}
