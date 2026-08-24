import { SHEET_TYPES } from '../constants'
import type { RuntimeEntity, UnitEntity } from '../types/entities'
import { degreeToDirection, getInstanceDegree } from './maths'

export function syncMovedActionTarget(unit: UnitEntity, dest: RuntimeEntity | null): void {
  if (!unit.destHasMoved?.() || !dest || !unit.realDest) return
  unit.realDest.i = dest.i
  unit.realDest.j = dest.j
  unit.realDest.x = dest.x
  unit.realDest.y = dest.y
  const oldDeg = unit.degree
  unit.degree = getInstanceDegree(unit, dest.x, dest.y)
  if (degreeToDirection(oldDeg ?? 0) !== degreeToDirection(unit.degree ?? 0)) {
    unit.setTextures?.(SHEET_TYPES.action)
  }
}
