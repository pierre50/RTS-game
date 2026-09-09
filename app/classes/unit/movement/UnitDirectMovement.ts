import { isometricToCartesian } from '../../../lib'
import { getEntitySpaceMapLike } from '../../../lib/mapSpaces'
import { getEnergyMoveSpeedMultiplier } from '../../../lib/units/unitEnergy'
import type { UnitEntity } from '../../../types/entities'
import { attemptDirectMove } from './UnitDirectMovementStep'
import {
  blocksHeroDirectMoveWithRoundedFootprint,
  blocksHeroDirectMoveWithSoftBody,
  getHeroCollisionFootprintPoints,
  type HeroDirectMoveBlocker,
} from './UnitHeroDirectMovementCollision'
import { debugBlockedDirectMove, serializeDirectMoveDebugCell } from './UnitMovementDebug'
import { SLIDE_PROBE_ANGLES, type DirectMoveOptions } from './UnitMovementHelpers'

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
    const contextMap = unit.context?.map
    const map = getEntitySpaceMapLike(unit, contextMap)
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
    const directMoveBlocker = blocker as HeroDirectMoveBlocker | null
    if (
      directMoveBlocker &&
      directMoveBlocker.family !== 'terrain' &&
      !blocksHeroDirectMoveWithSoftBody(directMoveBlocker)
    ) {
      const slideFailedBlocker = this.directMoveBlocker as HeroDirectMoveBlocker | null
      debugBlockedDirectMove(
        unit,
        'direct-blocker-slide-failed',
        {
          distance,
          slideBias: this.slideBias,
          blocker: slideFailedBlocker
            ? {
                family: slideFailedBlocker.family,
                type: slideFailedBlocker.type,
                i: slideFailedBlocker.i,
                j: slideFailedBlocker.j,
                label: slideFailedBlocker.label,
                pointCount: slideFailedBlocker.collisionPoints?.length ?? 0,
              }
            : null,
          firstTarget: this.getDirectMoveCandidateDebug(dirX, dirY, distance),
        },
        dirX,
        dirY
      )
      return false
    }

    return this.probeAlternativeDirections(dirX, dirY, distance, facingDirX, facingDirY)
  }

  private probeAlternativeDirections(
    dirX: number,
    dirY: number,
    distance: number,
    facingDirX: number,
    facingDirY: number
  ): boolean {
    const unit = this.unit
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
    const failedBlocker = this.directMoveBlocker as HeroDirectMoveBlocker | null
    debugBlockedDirectMove(
      unit,
      'all-direct-probes-failed',
      {
        distance,
        slideBias: this.slideBias,
        blocker: failedBlocker
          ? {
              family: failedBlocker.family,
              type: failedBlocker.type,
              i: failedBlocker.i,
              j: failedBlocker.j,
              label: failedBlocker.label,
              pointCount: failedBlocker.collisionPoints?.length ?? 0,
            }
          : null,
        firstTarget: this.getDirectMoveCandidateDebug(dirX, dirY, distance),
        currentCell: serializeDirectMoveDebugCell(unit.currentCell, unit),
      },
      dirX,
      dirY
    )
    return false
  }

  getDirectMoveCandidateDebug(dirX: number, dirY: number, distance: number): Record<string, unknown> | null {
    const unit = this.unit
    const map = getEntitySpaceMapLike(unit, unit.context?.map)
    if (!map) return null
    const effectiveDistance = distance * this.directMoveClimbFactor * getEnergyMoveSpeedMultiplier(unit)
    const candidateX = unit.x + dirX * effectiveDistance
    const candidateY = unit.y + dirY * effectiveDistance
    const [rawI, rawJ] = isometricToCartesian(candidateX, candidateY)
    const newI = Math.min(Math.max(rawI, 0), map.size)
    const newJ = Math.min(Math.max(rawJ, 0), map.size)
    const cell = map.grid[newI]?.[newJ] ?? null
    return {
      candidateX: Math.round(candidateX * 100) / 100,
      candidateY: Math.round(candidateY * 100) / 100,
      rawI,
      rawJ,
      newI,
      newJ,
      crossingCell: newI !== unit.i || newJ !== unit.j,
      cell: cell
        ? {
            i: cell.i,
            j: cell.j,
            x: Math.round(cell.x * 100) / 100,
            y: Math.round(cell.y * 100) / 100,
            solid: cell.solid,
            waterBorder: cell.waterBorder,
            border: cell.border,
            category: cell.category,
            has: cell.has
              ? {
                  family: cell.has.family,
                  type: cell.has.type,
                  label: cell.has.label,
                  sameObject: cell.has === unit,
                }
              : null,
          }
        : null,
    }
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
      if (!a || !b) continue
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
    const awayDirX = awayX / awayLength
    const awayDirY = awayY / awayLength
    const alignment = dirX * tangentX + dirY * tangentY
    const firstSign = alignment >= 0 ? 1 : -1
    const probeSigns = this.slideBias ? [this.slideBias, -this.slideBias] : [firstSign, -firstSign]
    const movingTowardBlocker = dirX * awayDirX + dirY * awayDirY < 0

    for (const sign of probeSigns) {
      const blendX = movingTowardBlocker ? awayDirX : dirX
      const blendY = movingTowardBlocker ? awayDirY : dirY
      const slideX = tangentX * sign * 0.7 + blendX * 0.3
      const slideY = tangentY * sign * 0.7 + blendY * 0.3
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
    return attemptDirectMove(this, dirX, dirY, distance, facingDirX, facingDirY)
  }
}
