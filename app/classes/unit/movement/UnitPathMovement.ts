import { updateTargetPursuit } from '../../../lib/units/targetPursuit'
import { tryStartUnitContactApproach } from './UnitContactApproach'
import { ACTION_TYPES, SHEET_TYPES } from '../../../constants'
import {
  canUpdateMinimap,
  cartesianToIsometric,
  degreeToDirection,
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
import { routeUnitAwayFromPassageCell, unitHasActivePassageStopIntent } from '../../../lib/buildings/passageCells'
import { getEntitySpaceMapLike, isOutsideSpaceId } from '../../../lib/mapSpaces'
import { syncEntityRelief } from '../../../lib/terrain/reliefSurface'
import { getReliefMovementDistance } from '../../../lib/terrain/reliefMovement'
import type { UnitEntity } from '../../../types/entities'

export function moveUnitToPath(unit: UnitEntity, retryBlockedGatherApproach: () => boolean): void {
  if (updateTargetPursuit(unit)) return
  const contextMap = unit.context?.map
  const map = getEntitySpaceMapLike(unit, contextMap)
  if (!map || !unit.path?.length) {
    resetUnitCrouchPose(unit)
    return
  }
  const next = unit.path[unit.path.length - 1]
  const nextCell = map.grid[next.i]?.[next.j]
  if (!nextCell) {
    unit.path = []
    unit.stopInterval?.()
    resetUnitCrouchPose(unit)
    unit.affectNewDest?.()
    return
  }
  const [nextFlatX, nextFlatY] = cartesianToIsometric(nextCell.i, nextCell.j)
  const nextFlatPoint = { i: nextCell.i, j: nextCell.j, x: nextFlatX, y: nextFlatY }

  const dest = unit.dest
  if (!dest || isDestroyedEntity(dest)) {
    unit.affectNewDest?.()
    return
  }
  updateCautiousAnimalApproachSpeed(unit)
  applyUnitCrouchPose(unit, isUnitWalkSpeedFactor(getRequestedMoveSpeedFactor(unit)))
  if ('family' in dest && tryStartUnitContactApproach(unit, dest, unit.action)) return
  if (shouldWaitForMovingBlocker(unit, nextCell)) return
  if (handleBlockedPathCell(unit, nextCell, dest)) return

  const sprite = unit.sprite
  if (!sprite) return
  if (!sprite.playing) sprite.play()

  const moveSpeed = getReliefMovementDistance(map, unit, nextFlatPoint, getPathMoveSpeed(unit), unit.currentCell)
  const remaining = Math.hypot(nextFlatX - unit.x, nextFlatY - unit.y)
  if (remaining <= moveSpeed + 1e-6) {
    if (remaining > 0) advanceTowardPathCell(unit, nextCell, nextFlatX, nextFlatY, remaining, false)
    finishPathCellStep(unit, nextCell, dest, retryBlockedGatherApproach)
  } else {
    advanceTowardPathCell(unit, nextCell, nextFlatX, nextFlatY, moveSpeed)
  }
}

function applyPathReliefLift(unit: UnitEntity): void {
  const map = getEntitySpaceMapLike(unit, unit.context?.map)
  syncEntityRelief(map, unit)
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
  unit.sendToEvt?.(dest, unit.action ?? null, {
    forceRepath: true,
    preserveAutonomy: true,
    allowPassageStop:
      unit.action === ACTION_TYPES.train || unitHasActivePassageStopIntent(unit, 'has' in dest ? dest : null),
  })
  return true
}

function finishPathCellStep(
  unit: UnitEntity,
  nextCell: NonNullable<UnitEntity['currentCell']>,
  dest: NonNullable<UnitEntity['dest']>,
  retryBlockedGatherApproach: () => boolean
): void {
  const contextMap = unit.context?.map
  const map = getEntitySpaceMapLike(unit, contextMap)
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
  unit.currentCell = nextCell
  placeUnitOnCell(unit, unit.currentCell)
  applyPathReliefLift(unit)
  contextMap?.updateInstanceBucket(unit, oldI, oldJ)
  updateInstanceVisibility(unit)
  unit.path?.pop()
  if (unit.destHasMoved?.()) {
    unit.sendToEvt?.(dest, unit.action ?? null, {
      forceRepath: true,
      preserveAutonomy: true,
      allowPassageStop:
        unit.action === ACTION_TYPES.train || unitHasActivePassageStopIntent(unit, 'has' in dest ? dest : null),
    })
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
    if (
      !unit.action &&
      !unitHasActivePassageStopIntent(unit, unit.currentCell) &&
      routeUnitAwayFromPassageCell(unit, unit.currentCell)
    ) {
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
  moveSpeed: number,
  syncRelief = true
): void {
  const menu = unit.context?.menu
  const player = unit.owner
  const oldDeg = unit.degree
  const wasWalking = unit.currentSheet === SHEET_TYPES.walking
  const beforeX = unit.x
  const beforeY = unit.y
  moveTowardPoint(unit, nextFlatX, nextFlatY, moveSpeed)
  if (syncRelief) applyPathReliefLift(unit)
  unit.zIndex = getInstanceZIndex(unit)
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
  canUpdateMinimap(unit, player) &&
    isOutsideSpaceId(unit.spaceId) &&
    menu?.isMiniMapActive?.() !== false &&
    menu?.updatePlayerMiniMap?.(unit.owner!)
  if (!wasWalking || degreeToDirection(oldDeg ?? 0) !== degreeToDirection(unit.degree ?? 0)) {
    unit.setTextures?.(SHEET_TYPES.walking)
  }
  applyUnitWalkingAnimationSpeed(unit, getRequestedMoveSpeedFactor(unit))
}
