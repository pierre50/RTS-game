import { RELIEF_CLIMB_SPEED_MULTIPLIER, RELIEF_LIFT_SMOOTHING } from '../../../constants'
import { isometricToCartesian } from '../../../lib'
import { getEntitySpaceMapLike } from '../../../lib/mapSpaces'
import { isHeroControlled } from '../../../lib/units/unitControl'
import { getEnergyMoveSpeedMultiplier } from '../../../lib/units/unitEnergy'
import {
  createHeroTerrainCollisionBlocker,
  getHeroDirectMoveBlockerAtPoint,
  getHeroTerrainCollisionBlockerNearPoint,
  isHeroTerrainCollisionCell,
} from './UnitHeroDirectMovementCollision'
import { debugBlockedDirectMove, debugCombatMove } from './UnitMovementDebug'
import { isCellBlockedForUnit } from './UnitMovementHelpers'

import { commitDirectMove } from './UnitDirectMovementCommit'
import { reportBorderAttempt, reportTerrainCollision } from './UnitDirectMovementDiagnostics'
import type { DirectMoveAttempt, DirectMoveState } from './UnitDirectMovementTypes'

function prepareDirectMove(
  state: DirectMoveState,
  dirX: number,
  dirY: number,
  distance: number
): DirectMoveAttempt | null {
  const unit = state.unit
  const contextMap = unit.context?.map
  const map = getEntitySpaceMapLike(unit, contextMap)
  if (!map || !unit.sprite || (dirX === 0 && dirY === 0) || distance <= 0) return null

  const targetClimbFactor = unit.currentCell?.inclined ? RELIEF_CLIMB_SPEED_MULTIPLIER : 1
  state.directMoveClimbFactor += (targetClimbFactor - state.directMoveClimbFactor) * RELIEF_LIFT_SMOOTHING
  const effectiveDistance = distance * state.directMoveClimbFactor * getEnergyMoveSpeedMultiplier(unit)

  const candidateX = unit.x + dirX * effectiveDistance
  const candidateY = unit.y + dirY * effectiveDistance
  const [rawI, rawJ] = isometricToCartesian(candidateX, candidateY)
  if (rawI < 0 || rawJ < 0 || rawI > map.size || rawJ > map.size) {
    debugBlockedDirectMove(unit, 'target-out-of-map', { rawI, rawJ, mapSize: map.size }, dirX, dirY)
    return null
  }
  const newI = Math.min(Math.max(rawI, 0), map.size)
  const newJ = Math.min(Math.max(rawJ, 0), map.size)
  const crossingCell = newI !== unit.i || newJ !== unit.j
  const targetCell = crossingCell ? map.grid[newI]?.[newJ] : unit.currentCell
  const heroControlled = isHeroControlled(unit)

  return {
    unit,
    contextMap,
    map,
    dirX,
    dirY,
    candidateX,
    candidateY,
    rawI,
    rawJ,
    newI,
    newJ,
    crossingCell,
    targetCell,
    heroControlled,
    effectiveDistance,
  }
}

function canCrossCell(state: DirectMoveState, attempt: DirectMoveAttempt): boolean {
  const { unit, dirX, dirY, rawI, rawJ, newI, newJ, crossingCell, targetCell, heroControlled } = attempt
  if (crossingCell) {
    if (!targetCell) {
      debugBlockedDirectMove(unit, 'missing-target-cell', { rawI, rawJ, newI, newJ }, dirX, dirY)
      return false
    }
    if (targetCell.border && (!targetCell.waterBorder || targetCell.solid) && !heroControlled) {
      debugBlockedDirectMove(unit, 'target-border', { rawI, rawJ, newI, newJ, targetCell }, dirX, dirY)
      return false
    }
    if (!heroControlled && isCellBlockedForUnit(unit, targetCell)) {
      debugCombatMove(unit, 'direct-target-solid', targetCell, { stage: 'direct-move', rawI, rawJ, newI, newJ })
      return false
    }
    return canCrossTerrain(state, attempt, targetCell)
  }

  return true
}

function isCollisionFree(state: DirectMoveState, attempt: DirectMoveAttempt): boolean {
  const { unit, dirX, dirY, candidateX, candidateY, rawI, rawJ, newI, newJ, targetCell, heroControlled } = attempt
  const terrainBlocker = heroControlled
    ? getHeroTerrainCollisionBlockerNearPoint(unit, targetCell, candidateX, candidateY)
    : null
  if (terrainBlocker) {
    state.directMoveBlocker = terrainBlocker
    reportTerrainCollision(attempt, terrainBlocker)
    return false
  }
  if (heroControlled) {
    const blocker = getHeroDirectMoveBlockerAtPoint(unit, targetCell, candidateX, candidateY)
    if (blocker) {
      state.directMoveBlocker = blocker
      debugBlockedDirectMove(
        unit,
        'target-occupied',
        {
          rawI,
          rawJ,
          newI,
          newJ,
          target: {
            solid: targetCell?.solid,
            waterBorder: targetCell?.waterBorder,
            category: targetCell?.category,
            has: { type: blocker.type, family: blocker.family, label: blocker.label },
          },
        },
        dirX,
        dirY
      )
      return false
    }
  }

  return true
}

export function attemptDirectMove(
  state: DirectMoveState,
  dirX: number,
  dirY: number,
  distance: number,
  facingDirX: number,
  facingDirY: number
): boolean {
  const attempt = prepareDirectMove(state, dirX, dirY, distance)
  if (!attempt) return false
  reportBorderAttempt(attempt)
  if (!canCrossCell(state, attempt) || !isCollisionFree(state, attempt)) return false
  return commitDirectMove(attempt, facingDirX, facingDirY)
}

function canCrossTerrain(
  state: DirectMoveState,
  attempt: DirectMoveAttempt,
  targetCell: NonNullable<DirectMoveAttempt['targetCell']>
): boolean {
  const { unit, map, dirX, dirY, candidateX, candidateY, rawI, rawJ, newI, newJ, heroControlled } = attempt
  if (heroControlled && targetCell.solid && !targetCell.has) {
    state.directMoveBlocker = createHeroTerrainCollisionBlocker(targetCell, map)
    debugBlockedDirectMove(
      unit,
      'target-solid-terrain',
      { rawI, rawJ, newI, newJ, category: targetCell.category, waterBorder: targetCell.waterBorder },
      dirX,
      dirY
    )
    return false
  }
  const nearbyTerrainBlocker = heroControlled
    ? getHeroTerrainCollisionBlockerNearPoint(unit, targetCell, candidateX, candidateY)
    : null
  if (nearbyTerrainBlocker) {
    state.directMoveBlocker = nearbyTerrainBlocker
    debugBlockedDirectMove(
      unit,
      'target-nearby-terrain-footprint',
      { rawI, rawJ, newI, newJ, category: targetCell.category, waterBorder: targetCell.waterBorder },
      dirX,
      dirY
    )
    return false
  }
  const categoryAllowed = targetCell.category !== 'Water' && (!targetCell.waterBorder || !targetCell.solid)
  if (!categoryAllowed) {
    if (isHeroTerrainCollisionCell(unit, targetCell))
      state.directMoveBlocker = createHeroTerrainCollisionBlocker(targetCell, map)
    debugBlockedDirectMove(
      unit,
      'target-category',
      { rawI, rawJ, newI, newJ, category: targetCell.category, waterBorder: targetCell.waterBorder },
      dirX,
      dirY
    )
    return false
  }
  return true
}
