import { FAMILY_TYPES, CELL_HEIGHT, CELL_WIDTH } from '../constants'
import { average, pointsDistance } from '../lib/maths'
import { isFriendlyTarget } from '../lib/combat'
import { canTargetBeAggressed } from '../lib/diplomaticAggression'
import { findTreeSegmentCollision } from '../lib/treeCollision'
import type { GameContextLike } from '../types/context'
import type { ResourceEntity, RuntimeEntity } from '../types/entities'
import { PROJECTILE_COLLISION_SCALE, getProjectileVisualOffset } from './ProjectileGeometry'

type CollisionProjectile = {
  context: GameContextLike
  currentAltitude: number
  owner: RuntimeEntity
  size: number
  target?: RuntimeEntity
  x: number
  y: number
}

export function canProjectileCollideWith(projectile: CollisionProjectile, instance: RuntimeEntity): boolean {
  if (
    instance === projectile.owner ||
    (isFriendlyTarget(projectile.owner, instance) && !canTargetBeAggressed(projectile.owner, instance)) ||
    instance.isDead ||
    instance.isDestroyed ||
    (instance.hitPoints ?? 0) <= 0
  ) {
    return false
  }
  return (
    instance.family === FAMILY_TYPES.building ||
    instance.family === FAMILY_TYPES.unit ||
    instance.family === FAMILY_TYPES.animal
  )
}

export function getProjectileCollisionCandidates(projectile: CollisionProjectile): RuntimeEntity[] {
  const candidates = new Set<RuntimeEntity>()
  if (projectile.target) candidates.add(projectile.target)
  for (const player of projectile.context.players ?? []) {
    for (const building of player.buildings ?? []) candidates.add(building)
    for (const unit of player.units ?? []) candidates.add(unit)
    for (const animal of player.animals ?? []) candidates.add(animal)
  }
  const gaia = projectile.context.map.gaia
  for (const animal of gaia?.animals ?? []) candidates.add(animal)
  return [...candidates].filter(instance => canProjectileCollideWith(projectile, instance))
}

export function findProjectileCollisionTarget(projectile: CollisionProjectile): RuntimeEntity | null {
  let closest: RuntimeEntity | null = null
  let closestDistance = Infinity
  for (const candidate of getProjectileCollisionCandidates(projectile)) {
    const collisionRadius = Math.max(
      projectile.size,
      average(candidate.width || CELL_WIDTH, candidate.height || CELL_HEIGHT) * PROJECTILE_COLLISION_SCALE
    )
    const distance = pointsDistance(
      projectile.x,
      projectile.y,
      candidate.x,
      candidate.y + getProjectileVisualOffset(candidate)
    )
    if (distance > collisionRadius || distance >= closestDistance) continue
    closest = candidate
    closestDistance = distance
  }
  return closest
}

export function findProjectileTreeCollision(
  projectile: CollisionProjectile,
  previousX: number,
  previousY: number
): ResourceEntity | null {
  return findTreeSegmentCollision(
    projectile.context.map,
    { x: previousX, y: previousY },
    { x: projectile.x, y: projectile.y },
    { currentAltitude: projectile.currentAltitude }
  )
}
