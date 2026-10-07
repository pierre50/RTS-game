import {
  blocksHeroDirectMove,
  isHeroInsideRoundedFootprint,
  getHeroDirectMoveCollisionPadding,
  getRawHeroCollisionFootprintPoints,
  type CollisionPoint,
  type HeroTerrainCollisionKind,
  type HeroCollisionMap,
  type HeroDirectMoveBlocker,
} from './HeroCollisionFootprint'
export {
  blocksHeroDirectMoveWithRoundedFootprint,
  blocksHeroDirectMoveWithSoftBody,
  getHeroCollisionFootprintPoints,
} from './HeroCollisionFootprint'
export type { HeroDirectMoveBlocker } from './HeroCollisionFootprint'
import { FAMILY_TYPES } from '../../../constants'
import { cartesianToIsometric, distanceToPolygon, getRoundedIsoShapePoints, pointIsInsidePolygon } from '../../../lib'
import { isHeroControlled } from '../../../lib/units/unitControl'
import { getEntitySpaceMapLike, sameMapSpace } from '../../../lib/mapSpaces'
import type { RuntimeEntity, UnitEntity } from '../../../types/entities'
import type { RuntimeCell } from '../../../types/map'

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

export function createHeroTerrainCollisionBlocker(
  cell: RuntimeCell,
  map?: HeroCollisionMap | null
): HeroDirectMoveBlocker {
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
