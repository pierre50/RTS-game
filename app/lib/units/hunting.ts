import { cartesianToIsometric, pointsDistance } from '../maths'
import { getEffectiveProjectileType } from '../projectiles'
import type { RuntimeEntity, UnitEntity } from '../../types/entities'
import type { Point } from '../../types/grid'

export const HUNTING_PROJECTILE = 'Arrow'

type MovingTargetLike = RuntimeEntity & {
  movementSheet?: string
  runningSpeed?: number
  flyingSpeed?: number
  path?: { i: number; j: number }[]
  speed?: number
}

function getTargetMoveSpeed(target: MovingTargetLike): number {
  if (target.movementSheet === 'flying' && typeof target.flyingSpeed === 'number') return target.flyingSpeed
  if (target.movementSheet === 'running' && typeof target.runningSpeed === 'number') return target.runningSpeed
  return target.speed ?? 0
}

// Arrows don't home in flight (Projectile flies straight to a fixed point), so the point aimed at
// the moment of release must already account for the prey's movement during the arrow's travel
// time, or fast-moving animals are consistently missed.
export function getHuntingAimPoint(unit: UnitEntity, dest: RuntimeEntity): Point {
  const target = dest as MovingTargetLike
  const speed = getTargetMoveSpeed(target)
  const path = target.path
  if (!speed || !path?.length) return { x: dest.x, y: dest.y }

  const player = unit.owner
  const arrowType = player ? getEffectiveProjectileType(HUNTING_PROJECTILE, player) : HUNTING_PROJECTILE
  const arrowSpeed = player?.config?.projectiles?.[arrowType]?.speed
  if (!arrowSpeed) return { x: dest.x, y: dest.y }

  const distanceToTarget = pointsDistance(unit.x, unit.y, dest.x, dest.y)
  const flightTicks = distanceToTarget / arrowSpeed
  // Walk the animal's own remaining path (soonest waypoint first, at the array's end) instead of
  // just the next cell, so a long flight time is led across several waypoints instead of stalling
  // once the first segment is used up. Never extrapolates past the animal's known destination.
  let remainingTravel = speed * flightTicks
  let x = dest.x
  let y = dest.y
  for (let i = path.length - 1; i >= 0 && remainingTravel > 0; i--) {
    const waypoint = path[i]
    if (!waypoint) continue
    const [nextX, nextY] = cartesianToIsometric(waypoint.i, waypoint.j)
    const dx = nextX - x
    const dy = nextY - y
    const segmentDistance = Math.hypot(dx, dy)
    if (segmentDistance <= 0) continue
    const travel = Math.min(remainingTravel, segmentDistance)
    const ratio = travel / segmentDistance
    x += dx * ratio
    y += dy * ratio
    remainingTravel -= travel
  }
  return { x, y }
}
