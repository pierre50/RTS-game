import { CELL_HEIGHT, FAMILY_TYPES, PASSABLE_RESOURCE_TYPES } from '../../../constants'
import { isBuildingTraversable } from '../../../lib/buildings/buildingTraversal'
import { getRoundedIsoFootprintPoints, pointIsInsidePolygon } from '../../../lib'
import type { RuntimeEntity } from '../../../types/entities'
import type { RuntimeMap } from '../../../types/map'

export type CollisionPoint = { x: number; y: number }
export type HeroTerrainCollisionKind = 'water' | 'wall'
export type HeroCollisionMap = Pick<RuntimeMap, 'grid' | 'mapType'>

export type HeroDirectMoveBlocker = Pick<
  RuntimeEntity,
  'family' | 'i' | 'isDead' | 'isDestroyed' | 'j' | 'label' | 'size' | 'type' | 'x' | 'y'
> & { collisionPoints?: CollisionPoint[]; terrainCollisionKind?: HeroTerrainCollisionKind }

const HERO_DIRECT_MOVE_COLLISION_PADDING = 14
const HERO_TERRAIN_COLLISION_PADDING_BY_KIND: Record<HeroTerrainCollisionKind, number> = {
  water: 24,
  wall: HERO_DIRECT_MOVE_COLLISION_PADDING,
}

export function blocksHeroDirectMove(entity: HeroDirectMoveBlocker | null | undefined): boolean {
  if (!entity || entity.isDestroyed) return false
  if (entity.family === FAMILY_TYPES.animal) return true
  if (entity.family === FAMILY_TYPES.unit) {
    return !entity.isDead
  }
  if (entity.family === FAMILY_TYPES.resource && PASSABLE_RESOURCE_TYPES.has(entity.type)) return false
  if (entity.family === FAMILY_TYPES.building) return !isBuildingTraversable(entity.type)
  return entity.family === FAMILY_TYPES.resource
}

export function blocksHeroDirectMoveWithRoundedFootprint(entity: HeroDirectMoveBlocker | null | undefined): boolean {
  if (!entity) return false
  if (entity.family === 'terrain') return (entity.collisionPoints?.length ?? 0) >= 3
  return (
    (entity.family === FAMILY_TYPES.building || entity.family === FAMILY_TYPES.resource) && blocksHeroDirectMove(entity)
  )
}

export function blocksHeroDirectMoveWithSoftBody(entity: HeroDirectMoveBlocker | null | undefined): boolean {
  return Boolean(entity && (entity.family === FAMILY_TYPES.unit || entity.family === FAMILY_TYPES.animal))
}

export function isHeroInsideRoundedFootprint(
  entity: HeroDirectMoveBlocker,
  x: number,
  y: number,
  map?: HeroCollisionMap | null
): boolean {
  const points = getHeroCollisionFootprintPoints(entity, map)
  return pointIsInsidePolygon(points, { x, y })
}

export function getHeroDirectMoveCollisionPadding(entity: HeroDirectMoveBlocker): number {
  if (entity.family === 'terrain' && entity.terrainCollisionKind) {
    return HERO_TERRAIN_COLLISION_PADDING_BY_KIND[entity.terrainCollisionKind]
  }
  if (
    entity.family === FAMILY_TYPES.building ||
    entity.family === FAMILY_TYPES.resource ||
    blocksHeroDirectMoveWithSoftBody(entity)
  ) {
    return HERO_DIRECT_MOVE_COLLISION_PADDING
  }
  return 0
}

export function getRawHeroCollisionFootprintPoints(
  entity: HeroDirectMoveBlocker,
  map?: HeroCollisionMap | null
): Array<{ x: number; y: number }> {
  if (entity.collisionPoints?.length) return entity.collisionPoints
  return getRoundedIsoFootprintPoints(entity, map?.grid)
}

export function getHeroCollisionFootprintPoints(
  entity: HeroDirectMoveBlocker,
  map?: HeroCollisionMap | null
): Array<{ x: number; y: number }> {
  let points = getRawHeroCollisionFootprintPoints(entity, map)
  const padding = getHeroDirectMoveCollisionPadding(entity)
  if (padding > 0) {
    points =
      entity.family === 'terrain'
        ? inflateIsoAlignedFootprintPoints(points, padding)
        : inflateFootprintPoints(points, padding)
  }
  return points
}

function getFootprintCenter(points: Array<{ x: number; y: number }>): { x: number; y: number } {
  let centerX = 0
  let centerY = 0
  for (const point of points) {
    centerX += point.x
    centerY += point.y
  }
  return { x: centerX / points.length, y: centerY / points.length }
}

function inflateIsoAlignedFootprintPoints(
  points: Array<{ x: number; y: number }>,
  padding: number
): Array<{ x: number; y: number }> {
  if (!points.length || padding <= 0) return points

  const { x: centerX, y: centerY } = getFootprintCenter(points)
  const scale = (CELL_HEIGHT / 2 + padding) / (CELL_HEIGHT / 2)
  return points.map(point => ({
    x: centerX + (point.x - centerX) * scale,
    y: centerY + (point.y - centerY) * scale,
  }))
}

function inflateFootprintPoints(
  points: Array<{ x: number; y: number }>,
  padding: number
): Array<{ x: number; y: number }> {
  if (!points.length || padding <= 0) return points

  const { x: centerX, y: centerY } = getFootprintCenter(points)

  return points.map(point => {
    const offsetX = point.x - centerX
    const offsetY = point.y - centerY
    const distance = Math.hypot(offsetX, offsetY)
    if (distance <= 0) return point

    const scale = 1 + padding / distance
    return {
      x: centerX + offsetX * scale,
      y: centerY + offsetY * scale,
    }
  })
}
