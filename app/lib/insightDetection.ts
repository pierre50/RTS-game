import { FAMILY_TYPES } from '../constants'
import { HERO_STEALTH_ANIMAL_DETECTION_FACTOR } from '../constants/heroControls'
import { getRequestedMoveSpeedFactor } from './unitLocomotion'
import type { UnitEntity } from '../types/entities'

export type InsightEntity = {
  i: number
  j: number
  sight?: number
  family?: string
  context?: {
    controls?: {
      heroUnit?: InsightEntity | null
      isHeroStealthMode?: () => boolean
    }
  }
  requestedMoveSpeedFactor?: number
}

export function getInsightDetectionRange(
  observer: InsightEntity,
  target: InsightEntity,
  range = observer.sight ?? 0
): number {
  const controls = observer.context?.controls ?? target.context?.controls
  const stealthFactor =
    controls?.isHeroStealthMode?.() === true && controls.heroUnit === target ? HERO_STEALTH_ANIMAL_DETECTION_FACTOR : 1
  const movementFactor =
    target.family === FAMILY_TYPES.unit ? getRequestedMoveSpeedFactor(target as UnitEntity) : 1

  return range * Math.min(stealthFactor, movementFactor)
}

export function instanceIsInInsightRange(observer: InsightEntity, target: InsightEntity, range?: number): boolean {
  const detectionRange = getInsightDetectionRange(observer, target, range)
  const dx = target.i - observer.i
  const dy = target.j - observer.j
  return dx * dx + dy * dy <= detectionRange * detectionRange
}
