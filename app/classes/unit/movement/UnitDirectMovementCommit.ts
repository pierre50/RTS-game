import { SHEET_TYPES } from '../../../constants'
import {
  degreeToDirection,
  getGroundReliefLevel,
  getInstanceDegree,
  getInstanceZIndex,
  playMovementSurfaceAudio,
  updateInstanceRenderVisibility,
  updateInstanceVisibility,
} from '../../../lib'
import { clearCellForUnit, placeUnitOnCell } from './UnitMovementHelpers'

import type { DirectMoveAttempt } from './UnitDirectMovementTypes'

export function commitDirectMove(attempt: DirectMoveAttempt, facingDirX: number, facingDirY: number): boolean {
  const {
    unit,
    contextMap,
    candidateX,
    candidateY,
    newI,
    newJ,
    crossingCell,
    targetCell,
    heroControlled,
    effectiveDistance,
  } = attempt
  if (!unit.sprite) return false
  const oldI = unit.i
  const oldJ = unit.j
  const oldDeg = unit.degree ?? 0
  const wasWalking = unit.currentSheet === SHEET_TYPES.walking
  const beforeX = unit.x
  const beforeY = unit.y
  unit.degree = getInstanceDegree(unit, unit.x + facingDirX, unit.y + facingDirY)
  unit.x = candidateX
  unit.y = candidateY
  unit.zIndex = getInstanceZIndex(unit)

  if (crossingCell && targetCell) {
    unit.z = targetCell.z
    unit.i = newI
    unit.j = newJ
    unit.zIndex = getInstanceZIndex(unit)
    clearCellForUnit(unit, unit.currentCell)
    unit.currentCell = targetCell
    placeUnitOnCell(unit, targetCell)
    if (heroControlled) {
      updateInstanceRenderVisibility(unit)
      unit.visible = true
    }
    contextMap?.updateInstanceBucket(unit, oldI, oldJ)
  }
  updateInstanceVisibility(unit)
  unit.applyReliefLift?.(getGroundReliefLevel(unit.currentCell))
  playMovementSurfaceAudio(unit, effectiveDistance, { previousX: beforeX, previousY: beforeY })
  if (!unit.actionLocked) {
    if (!unit.sprite.playing) unit.sprite.play()
    if (!wasWalking || degreeToDirection(oldDeg) !== degreeToDirection(unit.degree ?? 0)) {
      unit.setTextures?.(SHEET_TYPES.walking)
    }
  }
  return true
}
