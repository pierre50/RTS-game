import { CELL_HEIGHT, FAMILY_TYPES, SHEET_TYPES } from '../../../constants'
import {
  cartesianToIsometric,
  distanceToPolygon,
  getRoundedIsoFootprintPoints,
  getRoundedIsoShapePoints,
  pointIsInsidePolygon,
} from '../../../lib'
import { isHeroControlled } from '../../../lib/units/unitControl'
import { getEntitySpaceMapLike, sameMapSpace } from '../../../lib/mapSpaces'
import type { RuntimeEntity, UnitEntity } from '../../../types/entities'
import type { RuntimeCell, RuntimeMap } from '../../../types/map'

type CollisionPoint = { x: number; y: number }
type HeroTerrainCollisionKind = 'water' | 'wall'
type HeroCollisionMap = Pick<RuntimeMap, 'grid' | 'mapType'>

export type HeroDirectMoveBlocker = Pick<
  RuntimeEntity,
  'family' | 'i' | 'isDead' | 'isDestroyed' | 'j' | 'label' | 'size' | 'type' | 'x' | 'y'
> & { collisionPoints?: CollisionPoint[]; terrainCollisionKind?: HeroTerrainCollisionKind }

const HERO_DIRECT_MOVE_COLLISION_PADDING = 14
const HERO_TERRAIN_COLLISION_PADDING_BY_KIND: Record<HeroTerrainCollisionKind, number> = {
  water: 24,
  wall: HERO_DIRECT_MOVE_COLLISION_PADDING,
}

function blocksHeroDirectMove(entity: RuntimeEntity | null | undefined): boolean {
  if (!entity || entity.isDestroyed) return false
  // Corpses stay tangible until clear() destroys them. Animals usually remain in cell.has
  // while units move to cell.corpses, so both families share the same soft-body blocker here.
  if (entity.family === FAMILY_TYPES.animal) return true
  if (entity.family === FAMILY_TYPES.unit) {
    return !entity.isDead || (entity as UnitEntity).currentSheet === SHEET_TYPES.corpse
  }
  return entity.family === FAMILY_TYPES.building || entity.family === FAMILY_TYPES.resource
}

export function blocksHeroDirectMoveWithRoundedFootprint(
  entity: HeroDirectMoveBlocker | null | undefined
): boolean {
  if (!entity) return false
  if (entity.family === FAMILY_TYPES.building || entity.family === FAMILY_TYPES.resource) return true
  if (entity.family === 'terrain') return (entity.collisionPoints?.length ?? 0) >= 3
  return false
}

export function blocksHeroDirectMoveWithSoftBody(entity: HeroDirectMoveBlocker | null | undefined): boolean {
  return Boolean(entity && (entity.family === FAMILY_TYPES.unit || entity.family === FAMILY_TYPES.animal))
}

function isHeroInsideRoundedFootprint(
  entity: HeroDirectMoveBlocker,
  x: number,
  y: number,
  map?: HeroCollisionMap | null
): boolean {
  const points = getHeroCollisionFootprintPoints(entity, map)
  return pointIsInsidePolygon(points, { x, y })
}

function getHeroDirectMoveCollisionPadding(entity: HeroDirectMoveBlocker): number {
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

function getRawHeroCollisionFootprintPoints(
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
    points = entity.family === 'terrain' ? inflateIsoAlignedFootprintPoints(points, padding) : inflateFootprintPoints(points, padding)
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

function inflateIsoAlignedFootprintPoints(points: Array<{ x: number; y: number }>, padding: number): Array<{ x: number; y: number }> {
  if (!points.length || padding <= 0) return points

  const { x: centerX, y: centerY } = getFootprintCenter(points)
  const scale = (CELL_HEIGHT / 2 + padding) / (CELL_HEIGHT / 2)
  return points.map(point => ({
    x: centerX + (point.x - centerX) * scale,
    y: centerY + (point.y - centerY) * scale,
  }))
}

function inflateFootprintPoints(points: Array<{ x: number; y: number }>, padding: number): Array<{ x: number; y: number }> {
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

function blocksHeroDirectMoveAtPoint(
  entity: RuntimeEntity | null | undefined,
  x: number,
  y: number,
  map?: HeroCollisionMap | null,
  currentX?: number,
  currentY?: number
): boolean {
  if (!entity || !blocksHeroDirectMove(entity)) return false
  if (entity.family === FAMILY_TYPES.unit || entity.family === FAMILY_TYPES.animal) {
    const collisionRadius = getHeroSoftBodyCollisionRadius(entity)
    const currentDistance = Math.hypot((entity.x ?? 0) - x, (entity.y ?? 0) - y)
    return currentDistance < collisionRadius
  }
  if (!isHeroInsideRoundedFootprint(entity, x, y, map)) return false

  const padding = getHeroDirectMoveCollisionPadding(entity)
  if (padding > 0 && currentX !== undefined && currentY !== undefined) {
    const rawPoints = getRawHeroCollisionFootprintPoints(entity, map)
    const currentPoint = { x: currentX, y: currentY }
    const nextPoint = { x, y }
    const currentInsidePadded = isHeroInsideRoundedFootprint(entity, currentX, currentY, map)
    const nextInsideRaw = pointIsInsidePolygon(rawPoints, nextPoint)
    const currentRawDistance = distanceToPolygon(rawPoints, currentPoint)
    const nextRawDistance = distanceToPolygon(rawPoints, nextPoint)
    if (currentInsidePadded && !nextInsideRaw && nextRawDistance + 0.001 >= currentRawDistance) return false
  }

  return true
}

function blocksHeroMobileDirectMoveAtPoint(unit: UnitEntity, entity: RuntimeEntity, x: number, y: number): boolean {
  const collisionRadius = getHeroSoftBodyCollisionRadius(entity)
  const currentDistance = Math.hypot((entity.x ?? 0) - unit.x, (entity.y ?? 0) - unit.y)
  const nextDistance = Math.hypot((entity.x ?? 0) - x, (entity.y ?? 0) - y)
  if (nextDistance >= currentDistance) return false
  return nextDistance < collisionRadius
}

function getHeroSoftBodyCollisionRadius(entity: HeroDirectMoveBlocker): number {
  const baseRadius = Math.max(8, Math.min(14, ((entity.size ?? 1) * 12) / 2))
  return baseRadius + getHeroDirectMoveCollisionPadding(entity)
}

function getNearbyHeroCollisionEntities(
  cell: RuntimeCell | null | undefined,
  map: HeroCollisionMap | null | undefined,
  unit: UnitEntity
): RuntimeEntity[] {
  const entities = new Set<RuntimeEntity>()
  if (!cell || !map) return []

  const scanRadius = 4
  for (let i = cell.i - scanRadius; i <= cell.i + scanRadius; i++) {
    const row = map.grid[i]
    if (!row) continue
    for (let j = cell.j - scanRadius; j <= cell.j + scanRadius; j++) {
      const scanCell = row[j]
      const entity = scanCell?.has
      if (entity && sameMapSpace(unit, entity) && blocksHeroDirectMove(entity)) entities.add(entity)
      for (const corpse of scanCell?.corpses ?? []) {
        if (sameMapSpace(unit, corpse) && blocksHeroDirectMove(corpse)) entities.add(corpse)
      }
    }
  }

  return [...entities]
}

export function getHeroDirectMoveBlockerAtPoint(
  unit: UnitEntity,
  cell: RuntimeCell | null | undefined,
  x: number,
  y: number
): RuntimeEntity | null {
  if (!cell) return null
  const map = getEntitySpaceMapLike(unit, unit.context?.map)
  for (const entity of getNearbyHeroCollisionEntities(cell, map, unit)) {
    if (entity === unit) continue
    if (entity.family === FAMILY_TYPES.unit || entity.family === FAMILY_TYPES.animal) {
      if (blocksHeroMobileDirectMoveAtPoint(unit, entity, x, y)) return entity
      continue
    }
    if (blocksHeroDirectMoveAtPoint(entity, x, y, map, unit.x, unit.y)) return entity
  }
  return null
}

function getHeroTerrainCollisionBlockerAtPoint(
  unit: UnitEntity,
  cell: RuntimeCell | null | undefined,
  x: number,
  y: number
): HeroDirectMoveBlocker | null {
  if (!cell || !isHeroTerrainCollisionCell(unit, cell)) return null
  const map = getEntitySpaceMapLike(unit, unit.context?.map)
  const blocker = createHeroTerrainCollisionBlocker(cell, map)
  return isHeroInsideRoundedFootprint(blocker, x, y, map) ? blocker : null
}

export function getHeroTerrainCollisionBlockerNearPoint(
  unit: UnitEntity,
  cell: RuntimeCell | null | undefined,
  x: number,
  y: number
): HeroDirectMoveBlocker | null {
  const map = getEntitySpaceMapLike(unit, unit.context?.map)
  if (!cell || !map || !isHeroControlled(unit)) return null

  const scanRadius = 1
  for (let i = cell.i - scanRadius; i <= cell.i + scanRadius; i++) {
    const row = map.grid[i]
    if (!row) continue
    for (let j = cell.j - scanRadius; j <= cell.j + scanRadius; j++) {
      const blocker = getHeroTerrainCollisionBlockerAtPoint(unit, row[j], x, y)
      if (blocker) return blocker
    }
  }

  return null
}

export function isHeroTerrainCollisionCell(unit: UnitEntity, cell: RuntimeCell | null | undefined): boolean {
  if (!isHeroControlled(unit) || !cell) return false
  const map = getEntitySpaceMapLike(unit, unit.context?.map)
  if (map?.mapType === 'interior') return Boolean(cell.solid && !cell.has && touchesInteriorFloor(unit, cell))
  if (cell.category === 'Water') return true
  return false
}

function touchesInteriorFloor(unit: UnitEntity, cell: RuntimeCell): boolean {
  const grid = getEntitySpaceMapLike(unit, unit.context?.map)?.grid
  if (!grid) return false

  for (let i = cell.i - 1; i <= cell.i + 1; i++) {
    const row = grid[i]
    if (!row) continue
    for (let j = cell.j - 1; j <= cell.j + 1; j++) {
      if (i === cell.i && j === cell.j) continue
      const neighbor = row[j]
      if (!neighbor || neighbor.category === 'Water' || neighbor.terrainHidden) continue
      if (!neighbor.solid || neighbor.has) return true
    }
  }

  return false
}

function getHeroTerrainCollisionKind(cell: RuntimeCell, map?: HeroCollisionMap | null): HeroTerrainCollisionKind {
  if (map?.mapType === 'interior') return 'wall'
  return cell.category === 'Water' ? 'water' : 'wall'
}

function getCellTerrainCollisionPoints(cell: RuntimeCell): CollisionPoint[] {
  const [fallbackX, fallbackY] = cartesianToIsometric(cell.i, cell.j)
  const x = Number.isFinite(cell.x) ? cell.x : fallbackX
  const y = Number.isFinite(cell.y) ? cell.y : fallbackY
  return getRoundedIsoShapePoints({ x, y })
}

export function createHeroTerrainCollisionBlocker(cell: RuntimeCell, map?: HeroCollisionMap | null): HeroDirectMoveBlocker {
  const [x, y] = cartesianToIsometric(cell.i, cell.j)
  const terrainCollisionKind = getHeroTerrainCollisionKind(cell, map)
  return {
    collisionPoints: getCellTerrainCollisionPoints(cell),
    family: 'terrain',
    i: cell.i,
    isDestroyed: false,
    j: cell.j,
    label: `terrain-${cell.i}-${cell.j}`,
    size: 1,
    terrainCollisionKind,
    type: terrainCollisionKind === 'water' ? 'Water' : 'Wall',
    x,
    y,
  }
}
