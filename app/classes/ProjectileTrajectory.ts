import { getArcHeightForDistance, getArcProgressOffset, pointsDistance } from '../lib/maths'
import type { Point } from '../types/grid'

export type ProjectileTrajectorySource = {
  destinationPoint: Point
  groundOrigin: Point
  spawnOrigin: Point
  totalDistance: number
  trajectoryState: { kind: string; arcHeight: number } | null
  x: number
  y: number
}

export type ProjectileTrajectoryFrame = {
  progress: number
  spriteOffsetY: number
  altitude: number
}

export function createProjectileTrajectoryState(source: {
  totalDistance: number
  trajectory?: { kind: string; minArcHeight?: number; arcHeightFactor?: number; maxArcHeight?: number }
}): { kind: string; arcHeight: number } | null {
  if (source.trajectory?.kind !== 'arc') return null
  return { kind: 'arc', arcHeight: getArcHeightForDistance(source.totalDistance, source.trajectory) }
}

/** Flight height is simulation state so collision works without a Pixi sprite. */
export function sampleProjectileTrajectory(source: ProjectileTrajectorySource): ProjectileTrajectoryFrame {
  const traveled = pointsDistance(source.spawnOrigin.x, source.spawnOrigin.y, source.x, source.y)
  const progress = Math.max(0, Math.min(1, traveled / Math.max(source.totalDistance, 1)))
  const spriteOffsetY = source.trajectoryState
    ? -getArcProgressOffset(progress, source.trajectoryState.arcHeight)
    : 0
  const groundY = source.groundOrigin.y + (source.destinationPoint.y - source.groundOrigin.y) * progress
  return {
    progress,
    spriteOffsetY,
    altitude: Math.max(0, groundY - (source.y + spriteOffsetY)),
  }
}
