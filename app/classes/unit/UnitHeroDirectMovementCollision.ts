import { FAMILY_TYPES, SHEET_TYPES } from '../../constants'
import { cartesianToIsometric, getRoundedIsoFootprintPoints, pointIsInsidePolygon } from '../../lib'
import { isHeroControlled } from '../../lib/unitControl'
import type { RuntimeEntity, UnitEntity } from '../../types/entities'
import type { RuntimeCell, RuntimeMap } from '../../types/map'

export type HeroDirectMoveBlocker = Pick<
  RuntimeEntity,
  'family' | 'i' | 'isDead' | 'isDestroyed' | 'j' | 'label' | 'size' | 'type' | 'x' | 'y'
>

const HERO_BUILDING_COLLISION_PADDING = 0
const PORTAL_RESOURCE_TYPE = 'Portal'

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
  return Boolean(
    entity &&
      (entity.family === FAMILY_TYPES.building ||
        entity.family === FAMILY_TYPES.resource ||
        entity.family === 'terrain')
  )
}

export function blocksHeroDirectMoveWithSoftBody(entity: HeroDirectMoveBlocker | null | undefined): boolean {
  return Boolean(entity && (entity.family === FAMILY_TYPES.unit || entity.family === FAMILY_TYPES.animal))
}

function isHeroInsideRoundedFootprint(
  entity: HeroDirectMoveBlocker,
  x: number,
  y: number,
  map?: RuntimeMap | null
): boolean {
  const points = getHeroCollisionFootprintPoints(entity, map)
  return pointIsInsidePolygon(points, { x, y })
}

function getHeroCollisionFootprintPadding(entity: HeroDirectMoveBlocker): number {
  if (entity.family === FAMILY_TYPES.building) return HERO_BUILDING_COLLISION_PADDING
  if (entity.type === PORTAL_RESOURCE_TYPE) return HERO_BUILDING_COLLISION_PADDING
  return 0
}

export function getHeroCollisionFootprintPoints(
  entity: HeroDirectMoveBlocker,
  map?: RuntimeMap | null
): Array<{ x: number; y: number }> {
  let points = getRoundedIsoFootprintPoints(entity, map?.grid)
  const padding = getHeroCollisionFootprintPadding(entity)
  if (padding > 0) points = inflateFootprintPoints(points, padding)
  return points
}

function inflateFootprintPoints(points: Array<{ x: number; y: number }>, padding: number): Array<{ x: number; y: number }> {
  if (!points.length || padding <= 0) return points

  let centerX = 0
  let centerY = 0
  for (const point of points) {
    centerX += point.x
    centerY += point.y
  }
  centerX /= points.length
  centerY /= points.length

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
  map?: RuntimeMap | null
): boolean {
  if (!entity || !blocksHeroDirectMove(entity)) return false
  if (entity.family === FAMILY_TYPES.unit || entity.family === FAMILY_TYPES.animal) {
    const collisionRadius = Math.max(8, Math.min(14, ((entity.size ?? 1) * 12) / 2))
    const currentDistance = Math.hypot((entity.x ?? 0) - x, (entity.y ?? 0) - y)
    return currentDistance < collisionRadius
  }
  return isHeroInsideRoundedFootprint(entity, x, y, map)
}

function blocksHeroMobileDirectMoveAtPoint(unit: UnitEntity, entity: RuntimeEntity, x: number, y: number): boolean {
  const collisionRadius = Math.max(8, Math.min(14, ((entity.size ?? 1) * 12) / 2))
  const currentDistance = Math.hypot((entity.x ?? 0) - unit.x, (entity.y ?? 0) - unit.y)
  const nextDistance = Math.hypot((entity.x ?? 0) - x, (entity.y ?? 0) - y)
  if (nextDistance >= currentDistance) return false
  return nextDistance < collisionRadius
}

function getNearbyHeroCollisionEntities(
  cell: RuntimeCell | null | undefined,
  map: RuntimeMap | null | undefined
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
      if (entity && blocksHeroDirectMove(entity)) entities.add(entity)
      for (const corpse of scanCell?.corpses ?? []) {
        if (blocksHeroDirectMove(corpse)) entities.add(corpse)
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
  const map = unit.context?.map
  for (const entity of getNearbyHeroCollisionEntities(cell, map)) {
    if (entity === unit) continue
    if (entity.family === FAMILY_TYPES.unit || entity.family === FAMILY_TYPES.animal) {
      if (blocksHeroMobileDirectMoveAtPoint(unit, entity, x, y)) return entity
      continue
    }
    if (blocksHeroDirectMoveAtPoint(entity, x, y, map)) return entity
  }
  return null
}

export function isHeroLandTerrainBlockedCell(unit: UnitEntity, cell: RuntimeCell | null | undefined): boolean {
  return Boolean(isHeroControlled(unit) && cell && (cell.category === 'Water' || cell.waterBorder))
}

export function createHeroTerrainMoveBlocker(cell: RuntimeCell): HeroDirectMoveBlocker {
  const [x, y] = cartesianToIsometric(cell.i, cell.j)
  return {
    family: 'terrain',
    i: cell.i,
    isDestroyed: false,
    j: cell.j,
    label: `terrain-${cell.i}-${cell.j}`,
    size: 1,
    type: cell.waterBorder ? 'WaterBorder' : 'Water',
    x,
    y,
  }
}
