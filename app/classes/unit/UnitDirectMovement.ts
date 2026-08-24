import { RELIEF_CLIMB_SPEED_MULTIPLIER, RELIEF_LIFT_SMOOTHING, SHEET_TYPES } from '../../constants'
import {
  degreeToDirection,
  getGroundReliefLevel,
  getInstanceDegree,
  getInstanceZIndex,
  isometricToCartesian,
  playMovementSurfaceAudio,
  updateInstanceRenderVisibility,
  updateInstanceVisibility,
} from '../../lib'
import { isHeroControlled } from '../../lib/unitControl'
import { getEnergyMoveSpeedMultiplier } from '../../lib/unitEnergy'
import { debugBlockedDirectMove, debugCombatMove } from './UnitMovementDebug'
import {
  SLIDE_PROBE_ANGLES,
  clearCellForUnit,
  isCellBlockedForUnit,
  placeUnitOnCell,
  type DirectMoveOptions,
} from './UnitMovementHelpers'
import {
  blocksHeroDirectMoveWithRoundedFootprint,
  blocksHeroDirectMoveWithSoftBody,
  createHeroTerrainMoveBlocker,
  getHeroCollisionFootprintPoints,
  getHeroDirectMoveBlockerAtPoint,
  isHeroLandTerrainBlockedCell,
  type HeroDirectMoveBlocker,
} from './UnitHeroDirectMovementCollision'
import type { UnitEntity } from '../../types/entities'

export class UnitDirectMovement {
  unit: UnitEntity
  slideBias: number
  directMoveBlocker: HeroDirectMoveBlocker | null
  directMoveClimbFactor: number

  constructor(unit: UnitEntity) {
    this.unit = unit
    this.slideBias = 0
    this.directMoveBlocker = null
    this.directMoveClimbFactor = 1
  }

  moveDirect(dirX: number, dirY: number, distance: number, options: DirectMoveOptions = {}): boolean {
    const unit = this.unit
    const map = unit.context?.map
    if (!map || !unit.sprite || (dirX === 0 && dirY === 0) || distance <= 0) {
      debugBlockedDirectMove(
        unit,
        'precondition',
        { hasMap: Boolean(map), hasSprite: Boolean(unit.sprite), distance },
        dirX,
        dirY
      )
      return false
    }

    this.directMoveBlocker = null
    const facingDirX = options.facingDirX ?? dirX
    const facingDirY = options.facingDirY ?? dirY
    if (this.attemptMoveDirect(dirX, dirY, distance, facingDirX, facingDirY)) {
      this.slideBias = 0
      return true
    }
    const blocker = this.directMoveBlocker
    if (
      blocker &&
      blocksHeroDirectMoveWithRoundedFootprint(blocker) &&
      this.attemptSlideAlongRoundedFootprint(blocker, dirX, dirY, distance, facingDirX, facingDirY)
    ) {
      return true
    }
    if (
      blocker &&
      blocksHeroDirectMoveWithSoftBody(blocker) &&
      this.attemptSlideAroundSoftBody(blocker, dirX, dirY, distance, facingDirX, facingDirY)
    ) {
      return true
    }
    if (blocker && !blocksHeroDirectMoveWithSoftBody(blocker)) return false

    const baseAngle = Math.atan2(dirY, dirX)
    const probeSigns = this.slideBias ? [this.slideBias, -this.slideBias] : [1, -1]
    for (const step of SLIDE_PROBE_ANGLES) {
      const slideDistance = distance * Math.cos(step)
      for (const sign of probeSigns) {
        const angle = baseAngle + sign * step
        if (this.attemptMoveDirect(Math.cos(angle), Math.sin(angle), slideDistance, facingDirX, facingDirY)) {
          this.slideBias = sign
          return true
        }
      }
    }
    return false
  }

  attemptSlideAlongRoundedFootprint(
    blocker: HeroDirectMoveBlocker,
    dirX: number,
    dirY: number,
    distance: number,
    facingDirX: number = dirX,
    facingDirY: number = dirY
  ): boolean {
    const unit = this.unit
    const points = getHeroCollisionFootprintPoints(blocker, unit.context?.map)
    let tangentX = 0
    let tangentY = 0
    let closestDistanceSq = Infinity

    for (let index = 0; index < points.length; index++) {
      const a = points[index]
      const b = points[(index + 1) % points.length]
      const segmentX = b.x - a.x
      const segmentY = b.y - a.y
      const segmentLengthSq = segmentX * segmentX + segmentY * segmentY
      if (segmentLengthSq <= 0) continue
      const t = Math.max(0, Math.min(1, ((unit.x - a.x) * segmentX + (unit.y - a.y) * segmentY) / segmentLengthSq))
      const closestX = a.x + segmentX * t
      const closestY = a.y + segmentY * t
      const distanceSq = (unit.x - closestX) ** 2 + (unit.y - closestY) ** 2
      if (distanceSq < closestDistanceSq) {
        closestDistanceSq = distanceSq
        const segmentLength = Math.sqrt(segmentLengthSq)
        tangentX = segmentX / segmentLength
        tangentY = segmentY / segmentLength
      }
    }

    if (!Number.isFinite(closestDistanceSq)) return false
    const alignment = dirX * tangentX + dirY * tangentY
    const sign = alignment >= 0 ? 1 : -1
    const slideX = tangentX * sign
    const slideY = tangentY * sign
    const slideDistance = distance * Math.max(0.2, Math.abs(alignment))
    if (!this.attemptMoveDirect(slideX, slideY, slideDistance, facingDirX, facingDirY)) return false
    this.slideBias = sign
    return true
  }

  attemptSlideAroundSoftBody(
    blocker: HeroDirectMoveBlocker,
    dirX: number,
    dirY: number,
    distance: number,
    facingDirX: number = dirX,
    facingDirY: number = dirY
  ): boolean {
    const unit = this.unit
    const awayX = unit.x - (blocker.x ?? unit.x)
    const awayY = unit.y - (blocker.y ?? unit.y)
    const awayLength = Math.hypot(awayX, awayY)
    if (awayLength <= 0) return false

    const tangentX = -awayY / awayLength
    const tangentY = awayX / awayLength
    const alignment = dirX * tangentX + dirY * tangentY
    const firstSign = alignment >= 0 ? 1 : -1
    const probeSigns = this.slideBias ? [this.slideBias, -this.slideBias] : [firstSign, -firstSign]

    for (const sign of probeSigns) {
      const slideX = tangentX * sign * 0.7 + dirX * 0.3
      const slideY = tangentY * sign * 0.7 + dirY * 0.3
      const slideLength = Math.hypot(slideX, slideY)
      if (
        slideLength > 0 &&
        this.attemptMoveDirect(slideX / slideLength, slideY / slideLength, distance * 0.75, facingDirX, facingDirY)
      ) {
        this.slideBias = sign
        return true
      }
    }

    return false
  }

  attemptMoveDirect(
    dirX: number,
    dirY: number,
    distance: number,
    facingDirX: number = dirX,
    facingDirY: number = dirY
  ): boolean {
    const unit = this.unit
    const map = unit.context?.map
    if (!map || !unit.sprite || (dirX === 0 && dirY === 0) || distance <= 0) return false

    const targetClimbFactor = unit.currentCell?.inclined ? RELIEF_CLIMB_SPEED_MULTIPLIER : 1
    this.directMoveClimbFactor += (targetClimbFactor - this.directMoveClimbFactor) * RELIEF_LIFT_SMOOTHING
    const effectiveDistance = distance * this.directMoveClimbFactor * getEnergyMoveSpeedMultiplier(unit)

    const candidateX = unit.x + dirX * effectiveDistance
    const candidateY = unit.y + dirY * effectiveDistance
    const [rawI, rawJ] = isometricToCartesian(candidateX, candidateY)
    if (rawI < 0 || rawJ < 0 || rawI > map.size || rawJ > map.size) {
      debugBlockedDirectMove(unit, 'target-out-of-map', { rawI, rawJ, mapSize: map.size }, dirX, dirY)
      return false
    }
    const newI = Math.min(Math.max(rawI, 0), map.size)
    const newJ = Math.min(Math.max(rawJ, 0), map.size)
    const crossingCell = newI !== unit.i || newJ !== unit.j
    const targetCell = crossingCell ? map.grid[newI]?.[newJ] : unit.currentCell

    if (crossingCell) {
      if (!targetCell) {
        debugBlockedDirectMove(unit, 'missing-target-cell', { rawI, rawJ, newI, newJ }, dirX, dirY)
        return false
      }
      if (targetCell.border) {
        debugBlockedDirectMove(unit, 'target-border', { rawI, rawJ, newI, newJ, targetCell }, dirX, dirY)
        return false
      }
      if (!isHeroControlled(unit) && isCellBlockedForUnit(unit, targetCell)) {
        debugCombatMove(unit, 'direct-target-solid', targetCell, { stage: 'direct-move', rawI, rawJ, newI, newJ })
        return false
      }
      const categoryAllowed = targetCell.category !== 'Water' && !isHeroLandTerrainBlockedCell(unit, targetCell)
      if (!categoryAllowed) {
        if (isHeroLandTerrainBlockedCell(unit, targetCell)) this.directMoveBlocker = createHeroTerrainMoveBlocker(targetCell)
        debugBlockedDirectMove(
          unit,
          'target-category',
          { rawI, rawJ, newI, newJ, category: targetCell.category, waterBorder: targetCell.waterBorder },
          dirX,
          dirY
        )
        return false
      }
    }
    if (isHeroControlled(unit)) {
      const blocker = getHeroDirectMoveBlockerAtPoint(unit, targetCell, candidateX, candidateY)
      if (blocker) {
        this.directMoveBlocker = blocker
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

    const oldI = unit.i
    const oldJ = unit.j
    const oldDeg = unit.degree ?? 0
    const wasWalking = unit.currentSheet === SHEET_TYPES.walking
    const beforeX = unit.x
    const beforeY = unit.y
    unit.degree = getInstanceDegree(unit, unit.x + facingDirX, unit.y + facingDirY)
    unit.x = candidateX
    unit.y = candidateY

    if (crossingCell && targetCell) {
      unit.z = targetCell.z
      unit.i = newI
      unit.j = newJ
      unit.zIndex = getInstanceZIndex(unit)
      clearCellForUnit(unit, unit.currentCell)
      unit.currentCell = targetCell
      if (isHeroControlled(unit) && targetCell.solid && !targetCell.has) targetCell.solid = false
      placeUnitOnCell(unit, targetCell)
      if (isHeroControlled(unit)) {
        updateInstanceRenderVisibility(unit)
        unit.visible = true
      }
      map.updateInstanceBucket(unit, oldI, oldJ)
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
}
