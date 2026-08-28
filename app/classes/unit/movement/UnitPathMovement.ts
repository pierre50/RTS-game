import { SHEET_TYPES } from '../../../constants'
import {
  canUpdateMinimap,
  cartesianToIsometric,
  degreeToDirection,
  getGroundReliefLevel,
  getInstanceDegree,
  getInstanceZIndex,
  instancesDistance,
  moveTowardPoint,
  playMovementSurfaceAudio,
  updateInstanceVisibility,
} from '../../../lib'
import { debugCombatMove } from './UnitMovementDebug'
import {
  cellOccupantIsDest,
  clearCellForUnit,
  getRequestedMoveSpeedFactor,
  getPathMoveSpeed,
  isCellBlockedForUnit,
  isDestroyedEntity,
  isMovingUnitEntity,
  isRecoveringAttack,
  isUnitCellOccupant,
  placeUnitOnCell,
  pauseCombatRecoveryMove,
  startActionIfAlreadyInRange,
  updateCautiousAnimalApproachSpeed,
} from './UnitMovementHelpers'
import { applyUnitWalkingAnimationSpeed } from '../../../lib/units/unitWalkingAnimation'
import { applyUnitCrouchPose, resetUnitCrouchPose } from '../../../lib/units/unitCrouchPose'
import { isUnitWalkSpeedFactor } from '../../../lib/units/unitLocomotion'
import type { UnitEntity } from '../../../types/entities'

export function moveUnitToPath(unit: UnitEntity, retryBlockedGatherApproach: () => boolean): void {
  const map = unit.context?.map
  if (!map || !unit.path?.length) {
    resetUnitCrouchPose(unit)
    return
  }
  const next = unit.path[unit.path.length - 1]
  const nextCell = map.grid[next.i][next.j]
  const [nextFlatX, nextFlatY] = cartesianToIsometric(nextCell.i, nextCell.j)
  const nextFlatPoint = { i: nextCell.i, j: nextCell.j, x: nextFlatX, y: nextFlatY }

  applyPathReliefLift(unit, nextCell, nextFlatPoint)
  const dest = unit.dest
  if (!dest || isDestroyedEntity(dest)) {
    unit.affectNewDest?.()
    return
  }
  updateCautiousAnimalApproachSpeed(unit)
  applyUnitCrouchPose(unit, isUnitWalkSpeedFactor(getRequestedMoveSpeedFactor(unit)))
  if (shouldWaitForMovingBlocker(unit, nextCell)) return
  if (handleBlockedPathCell(unit, nextCell, dest)) return

  const sprite = unit.sprite
  if (!sprite) return
  if (!sprite.playing) sprite.play()

  const moveSpeed = getPathMoveSpeed(unit, nextCell)
  if (instancesDistance(unit, nextFlatPoint, false) <= moveSpeed) {
    finishPathCellStep(unit, nextCell, dest, retryBlockedGatherApproach)
  } else {
    advanceTowardPathCell(unit, nextCell, nextFlatX, nextFlatY, moveSpeed)
  }
}

function applyPathReliefLift(
  unit: UnitEntity,
  nextCell: NonNullable<UnitEntity['currentCell']>,
  nextFlatPoint: { i: number; j: number; x: number; y: number }
): void {
  if (!unit.currentCell) return
  const from = getGroundReliefLevel(unit.currentCell)
  const to = getGroundReliefLevel(nextCell)
  const total = instancesDistance(unit.currentCell, nextCell, false) || 1
  const remaining = Math.min(instancesDistance(unit, nextFlatPoint, false), total)
  unit.applyReliefLift?.(to + (from - to) * (remaining / total))
}

function shouldWaitForMovingBlocker(unit: UnitEntity, nextCell: NonNullable<UnitEntity['currentCell']>): boolean {
  const nextCellHas = nextCell.has
  if (
    !nextCellHas ||
    !isMovingUnitEntity(nextCellHas) ||
    nextCellHas.label === unit.label ||
    !nextCellHas.hasPath?.() ||
    instancesDistance(unit, nextCellHas) > 1 ||
    !nextCellHas.sprite?.playing
  ) {
    return false
  }
  debugCombatMove(unit, 'waiting-moving-blocker', nextCell, {
    stage: 'path-step',
    blocker: {
      label: nextCellHas.label,
      type: nextCellHas.type,
      family: nextCellHas.family,
      i: nextCellHas.i,
      j: nextCellHas.j,
      pathLength: nextCellHas.path?.length ?? 0,
    },
  })
  unit.sprite?.stop()
  return true
}

function handleBlockedPathCell(
  unit: UnitEntity,
  nextCell: NonNullable<UnitEntity['currentCell']>,
  dest: NonNullable<UnitEntity['dest']>
): boolean {
  if (nextCell.solid && isUnitCellOccupant(unit, nextCell)) {
    debugCombatMove(unit, 'self-solid-cell-allowed', nextCell, { stage: 'path-step' })
  }
  if (!isCellBlockedForUnit(unit, nextCell) || !unit.dest) return false

  unit.context?.performance?.record?.('unit.blockedPath', 0)
  debugCombatMove(unit, 'blocked-solid-cell', nextCell, { stage: 'path-step' })
  if (cellOccupantIsDest(nextCell, dest) && startActionIfAlreadyInRange(unit, dest, 'blocked-target-cell-in-range')) {
    return true
  }
  if (isRecoveringAttack(unit)) {
    pauseCombatRecoveryMove(unit)
    return true
  }
  unit.sendToEvt?.(dest, unit.action ?? null, { forceRepath: true })
  return true
}

function finishPathCellStep(
  unit: UnitEntity,
  nextCell: NonNullable<UnitEntity['currentCell']>,
  dest: NonNullable<UnitEntity['dest']>,
  retryBlockedGatherApproach: () => boolean
): void {
  const map = unit.context?.map
  if (!map) return
  const oldI = unit.i
  const oldJ = unit.j
  const beforeX = unit.x
  const beforeY = unit.y
  unit.z = nextCell.z
  unit.i = nextCell.i
  unit.j = nextCell.j
  unit.zIndex = getInstanceZIndex(unit)
  clearCellForUnit(unit, unit.currentCell)
  unit.currentCell = map.grid[unit.i][unit.j]
  placeUnitOnCell(unit, unit.currentCell)
  map.updateInstanceBucket(unit, oldI, oldJ)
  updateInstanceVisibility(unit)
  unit.path?.pop()
  if (unit.destHasMoved?.()) {
    unit.sendToEvt?.(dest, unit.action ?? null, { forceRepath: true })
    return
  }
  if (unit.isUnitAtDest?.(unit.action, dest)) {
    unit.path = []
    unit.stopInterval?.()
    resetUnitCrouchPose(unit)
    unit.degree = getInstanceDegree(unit, dest.x, dest.y)
    unit.getAction?.(unit.action ?? '')
    return
  }
  if (!unit.path?.length) {
    if (isRecoveringAttack(unit)) {
      pauseCombatRecoveryMove(unit)
      resetUnitCrouchPose(unit)
      return
    }
    if (retryBlockedGatherApproach()) return
    unit.affectNewDest?.()
  }
  playMovementSurfaceAudio(unit, Math.hypot(unit.x - beforeX, unit.y - beforeY), {
    previousX: beforeX,
    previousY: beforeY,
  })
}

function advanceTowardPathCell(
  unit: UnitEntity,
  nextCell: NonNullable<UnitEntity['currentCell']>,
  nextFlatX: number,
  nextFlatY: number,
  moveSpeed: number
): void {
  const menu = unit.context?.menu
  const player = unit.owner
  const oldDeg = unit.degree
  const wasWalking = unit.currentSheet === SHEET_TYPES.walking
  const beforeX = unit.x
  const beforeY = unit.y
  moveTowardPoint(unit, nextFlatX, nextFlatY, moveSpeed)
  if (unit.x === beforeX && unit.y === beforeY) {
    debugCombatMove(unit, 'no-position-progress', nextCell, {
      stage: 'path-step',
      moveSpeed,
      nextFlatX,
      nextFlatY,
    })
  }
  playMovementSurfaceAudio(unit, Math.hypot(unit.x - beforeX, unit.y - beforeY), {
    previousX: beforeX,
    previousY: beforeY,
  })
  canUpdateMinimap(unit, player) && menu?.isMiniMapActive?.() !== false && menu?.updatePlayerMiniMap?.(unit.owner!)
  if (!wasWalking || degreeToDirection(oldDeg ?? 0) !== degreeToDirection(unit.degree ?? 0)) {
    unit.setTextures?.(SHEET_TYPES.walking)
  }
  applyUnitWalkingAnimationSpeed(unit, getRequestedMoveSpeedFactor(unit))
}
