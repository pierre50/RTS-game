import { Text } from 'pixi.js'
import { CELL_HEIGHT, CELL_WIDTH, FAMILY_TYPES } from '../../constants'
import {
  drawRoundedIsoShape,
  getReliefOffset,
  getRoundedIsoFootprintPoints,
  parseTextureRef,
  pointIsInsidePolygon,
} from '../../lib'
import type { TerrainSourceCell } from '../../classes/map/TerrainChunkManager'
import type { DevConsoleContext, DevEntity } from '../types'
import {
  DEBUG_COORDS_LAYER,
  DEBUG_GRID_LAYER,
  DEBUG_HERO_AIM_LAYER,
  DEBUG_HERO_COLLISION_LAYER,
  DEBUG_OVERLAY_Z,
  DEBUG_PATH_LAYER,
  DEBUG_SOLID_LAYER,
  DEBUG_TERRAIN_FRAME_LAYER,
  DEBUG_VISION_LAYER,
  drawCellDiamond,
  drawCellStroke,
  getCameraCells,
  getDebugContainerForCamera,
  getDebugLayerForCamera,
  getDebugMapSpace,
  getSolidDebugColor,
} from './shared'
import { ensureDebugOverlay } from './DebugOverlayRenderers'
import {
  createHeroTerrainCollisionBlocker,
  getHeroCollisionFootprintPoints,
  isHeroTerrainCollisionCell,
} from '../../classes/unit/movement/UnitHeroDirectMovementCollision'
import { getLastDirectMoveDebugSnapshot } from '../../classes/unit/movement/UnitMovementDebug'
import type { UnitEntity } from '../../types/entities'
import type { RuntimeMap } from '../../types/map'

const HERO_COLLISION_SCAN_RADIUS = 8
const HERO_TERRAIN_COLLISION_DEBUG_RADIUS = 2
const HERO_AIM_DEBUG_RADIUS = 120
const HERO_AIM_DEBUG_SEGMENTS = 10
const HERO_AIM_DEBUG_Y_SCALE = CELL_HEIGHT / CELL_WIDTH
const HERO_AIM_DEBUG_BOUNDARIES = [22.5, 67.5, 112.5, 157.5, 202.5, 247.5, 292.5, 337.5]
const HERO_AIM_DEBUG_CARDINALS = [0, 90, 180, 270]
const HERO_AIM_DEBUG_SECTORS = [
  { start: 337.5, end: 382.5, color: 0x2dd4bf },
  { start: 22.5, end: 67.5, color: 0x38bdf8 },
  { start: 67.5, end: 112.5, color: 0xfacc15 },
  { start: 112.5, end: 157.5, color: 0x38bdf8 },
  { start: 157.5, end: 202.5, color: 0x2dd4bf },
  { start: 202.5, end: 247.5, color: 0xfb7185 },
  { start: 247.5, end: 292.5, color: 0xf97316 },
  { start: 292.5, end: 337.5, color: 0xfb7185 },
] as const
const HERO_COLLISION_FAMILY_COLORS: Record<string, number> = {
  terrain: 0x35a7ff,
  [FAMILY_TYPES.resource]: 0xffa500,
  [FAMILY_TYPES.unit]: 0xb46bff,
  [FAMILY_TYPES.animal]: 0xd4ff35,
}

export function drawSolidDebug(context: DevConsoleContext): void {
  const layer = getDebugLayerForCamera(context, DEBUG_SOLID_LAYER, DEBUG_OVERLAY_Z + 1)
  layer.clear()
  const hero = context.controls?.heroUnit

  for (const cell of getCameraCells(context)) {
    if (!cell) continue
    if (!cell.solid && !cell.border && !cell.inclined && !cell.waterBorder && cell.category !== 'Water') continue

    const isHeroOccupancyOnly =
      hero &&
      cell.has === hero &&
      cell.solid &&
      !cell.border &&
      !cell.inclined &&
      !cell.waterBorder &&
      cell.category !== 'Water'
    if (isHeroOccupancyOnly) {
      drawCellStroke(layer, cell, getSolidDebugColor(cell), 0.55, 2)
      continue
    }

    if (cell.waterBorder) {
      drawCellStroke(layer, cell, getSolidDebugColor(cell), 0.55, 2)
      continue
    }

    drawCellDiamond(layer, cell, getSolidDebugColor(cell))
  }
}

export function drawPathDebug(context: DevConsoleContext): void {
  const { players } = context
  const layer = getDebugLayerForCamera(context, DEBUG_PATH_LAYER, DEBUG_OVERLAY_Z + 2)
  layer.clear()

  const allUnits = players.flatMap(p => p.units).filter(unit => Boolean((unit as DevEntity).path?.length))
  allUnits.forEach((unit, index: number) => {
    const color = index % 2 ? 0x35a7ff : 0xfff04a
    const cells = [...((unit as DevEntity).path ?? [])].reverse()
    layer.moveTo(unit.x, unit.y)
    cells.forEach(cell => {
      layer.lineTo(cell.x, cell.y)
    })
    layer.stroke({ color, alpha: 0.95, width: 3 })

    cells.forEach(cell => drawCellDiamond(layer, cell, color, 0.18))
  })
}

export function drawGridDebug(context: DevConsoleContext): void {
  const layer = getDebugLayerForCamera(context, DEBUG_GRID_LAYER, DEBUG_OVERLAY_Z + 3)
  layer.clear()

  for (const cell of getCameraCells(context)) {
    if (!cell) continue
    drawCellStroke(layer, cell, 0xffffff, 0.55, 1)
  }
}

export function drawCoordsDebug(context: DevConsoleContext): void {
  const layer = getDebugContainerForCamera(context, DEBUG_COORDS_LAYER, DEBUG_OVERLAY_Z + 4)
  layer.removeChildren().forEach(child => child.destroy())

  for (const cell of getCameraCells(context)) {
    if (!cell) continue
    const text = new Text({
      text: `${cell.i},${cell.j}\nz${cell.z}`,
      style: {
        fontFamily: 'monospace',
        fontSize: 10,
        fontWeight: '700',
        fill: 0xffff66,
        stroke: { color: 0x000000, width: 3 },
        align: 'center',
      },
    })
    text.anchor.set(0.5, 0.5)
    text.x = cell.x
    text.y = cell.y - 7
    text.eventMode = 'none'
    layer.addChild(text)
  }
}

export function drawVisionDebug(context: DevConsoleContext): void {
  const { player } = context
  const layer = getDebugLayerForCamera(context, DEBUG_VISION_LAYER, DEBUG_OVERLAY_Z)
  layer.clear()

  for (const cell of getCameraCells(context)) {
    if (!cell) continue
    if (player.views.isVisible(cell.i, cell.j)) {
      drawCellDiamond(layer, cell, 0x54ff7a, 0.38)
    } else if (player.views.isViewed(cell.i, cell.j)) {
      drawCellDiamond(layer, cell, 0x5da9ff, 0.24)
    }
  }
}

function getHeroDebugUnit(context: DevConsoleContext): DevEntity | null {
  const controlsHero =
    context.controls && 'heroUnit' in context.controls ? (context.controls.heroUnit as DevEntity | null) : null
  if (controlsHero) return controlsHero
  return (context.player.units.find(unit => unit.controlMode === 'hero') as DevEntity | undefined) ?? null
}

function getPointForDegree(
  origin: { x: number; y: number },
  degree: number,
  distance: number
): { x: number; y: number } {
  const radians = ((degree - 180) * Math.PI) / 180
  return {
    x: origin.x + Math.cos(radians) * distance,
    y: origin.y + (Math.sin(radians) * distance) / HERO_AIM_DEBUG_Y_SCALE,
  }
}

function drawHeroAimSector(
  layer: ReturnType<typeof getDebugLayerForCamera>,
  origin: { x: number; y: number },
  start: number,
  end: number,
  color: number
): void {
  layer.moveTo(origin.x, origin.y)
  for (let i = 0; i <= HERO_AIM_DEBUG_SEGMENTS; i += 1) {
    const degree = start + ((end - start) * i) / HERO_AIM_DEBUG_SEGMENTS
    const point = getPointForDegree(origin, degree, HERO_AIM_DEBUG_RADIUS)
    layer.lineTo(point.x, point.y)
  }
  layer.lineTo(origin.x, origin.y)
  layer.fill({ color, alpha: 0.12 })
}

export function drawHeroAimDebug(context: DevConsoleContext): void {
  const layer = getDebugLayerForCamera(context, DEBUG_HERO_AIM_LAYER, DEBUG_OVERLAY_Z + 7)
  layer.clear()

  const hero = getHeroDebugUnit(context)
  const aimPoint = context.controls?.getWorldPointUnderCursor?.()
  if (!hero || !aimPoint) return

  const origin = { x: hero.x, y: hero.y + getReliefOffset(hero) }
  for (const sector of HERO_AIM_DEBUG_SECTORS) {
    drawHeroAimSector(layer, origin, sector.start, sector.end, sector.color)
  }

  for (const degree of HERO_AIM_DEBUG_BOUNDARIES) {
    const point = getPointForDegree(origin, degree, HERO_AIM_DEBUG_RADIUS)
    layer.moveTo(origin.x, origin.y)
    layer.lineTo(point.x, point.y)
  }
  layer.stroke({ color: 0xffffff, alpha: 0.55, width: 1 })

  for (const degree of HERO_AIM_DEBUG_CARDINALS) {
    const point = getPointForDegree(origin, degree, HERO_AIM_DEBUG_RADIUS + 14)
    layer.moveTo(origin.x, origin.y)
    layer.lineTo(point.x, point.y)
  }
  layer.stroke({ color: 0xffffff, alpha: 0.85, width: 2 })

  const aimDx = aimPoint.x - hero.x
  const aimDy = aimPoint.y - hero.y
  const aimLength = Math.hypot(aimDx, aimDy)
  if (aimLength > 0) {
    layer.moveTo(origin.x, origin.y)
    layer.lineTo(
      origin.x + (aimDx / aimLength) * (HERO_AIM_DEBUG_RADIUS + 22),
      origin.y + (aimDy / aimLength) * (HERO_AIM_DEBUG_RADIUS + 22)
    )
    layer.stroke({ color: 0xffffff, alpha: 1, width: 4 })
  }

  layer.circle(origin.x, origin.y, 4)
  layer.fill({ color: 0xffffff, alpha: 0.95 })
}

function getNearbyHeroCollisionEntities(context: DevConsoleContext, hero: DevEntity): DevEntity[] {
  const entities = new Set<DevEntity>()
  const grid = getDebugMapSpace(context)?.grid ?? context.map.grid
  for (let i = hero.i - HERO_COLLISION_SCAN_RADIUS; i <= hero.i + HERO_COLLISION_SCAN_RADIUS; i++) {
    const row = grid[i]
    if (!row) continue
    for (let j = hero.j - HERO_COLLISION_SCAN_RADIUS; j <= hero.j + HERO_COLLISION_SCAN_RADIUS; j++) {
      const entity = row[j]?.has as DevEntity | null
      if (
        entity &&
        entity !== hero &&
        (entity.family === FAMILY_TYPES.building ||
          entity.family === FAMILY_TYPES.resource ||
          entity.family === FAMILY_TYPES.unit ||
          entity.family === FAMILY_TYPES.animal) &&
        !entity.isDestroyed
      )
        entities.add(entity)
    }
  }
  return [...entities]
}

function getNearbyHeroTerrainCollisionCells(context: DevConsoleContext, hero: DevEntity) {
  const cells = []
  const grid = getDebugMapSpace(context)?.grid ?? context.map.grid
  for (let i = hero.i - HERO_TERRAIN_COLLISION_DEBUG_RADIUS; i <= hero.i + HERO_TERRAIN_COLLISION_DEBUG_RADIUS; i++) {
    const row = grid[i]
    if (!row) continue
    for (let j = hero.j - HERO_TERRAIN_COLLISION_DEBUG_RADIUS; j <= hero.j + HERO_TERRAIN_COLLISION_DEBUG_RADIUS; j++) {
      const cell = row[j]
      if (cell && !cell.has && isHeroTerrainCollisionCell(hero as unknown as UnitEntity, cell)) cells.push(cell)
    }
  }
  return cells
}

function getEntityCollisionInfo(context: DevConsoleContext, hero: DevEntity, entity: DevEntity) {
  const grid = getDebugMapSpace(context)?.grid ?? context.map.grid
  const points = getRoundedIsoFootprintPoints(entity, grid)
  const inside = pointIsInsidePolygon(points, hero)
  const centerDistance = Math.hypot(hero.x - entity.x, hero.y - entity.y)
  return { points, value: centerDistance, inside }
}

function formatDirectMoveDebugDetails(details: Record<string, unknown>): string {
  const target = details.target as
    | { i?: unknown; j?: unknown; solid?: unknown; waterBorder?: unknown; border?: unknown; category?: unknown }
    | null
    | undefined
  const firstTarget = details.firstTarget as
    | { newI?: unknown; newJ?: unknown; crossingCell?: unknown; cell?: unknown }
    | null
    | undefined
  const firstTargetCell = firstTarget?.cell as
    | { i?: unknown; j?: unknown; solid?: unknown; waterBorder?: unknown; border?: unknown; category?: unknown }
    | null
    | undefined
  const terrainBlocker = details.terrainBlocker as { type?: unknown; pointCount?: unknown } | null | undefined
  const blocker = details.blocker as
    | { family?: unknown; type?: unknown; i?: unknown; j?: unknown; pointCount?: unknown }
    | null
    | undefined
  const cell = target ?? firstTargetCell
  const parts = [
    `raw=${String(details.rawI ?? '?')},${String(details.rawJ ?? '?')}`,
    `new=${String(details.newI ?? firstTarget?.newI ?? '?')},${String(details.newJ ?? firstTarget?.newJ ?? '?')}`,
    `cross=${String(details.crossingCell ?? firstTarget?.crossingCell ?? '?')}`,
  ]
  if (cell) {
    parts.push(
      `cell=${String(cell.i ?? '?')},${String(cell.j ?? '?')} ${String(cell.category ?? '?')} solid=${String(
        cell.solid ?? '?'
      )} wb=${String(cell.waterBorder ?? '?')} border=${String(cell.border ?? '?')}`
    )
  }
  if (terrainBlocker)
    parts.push(`terrain=${String(terrainBlocker.type ?? '?')} pts=${String(terrainBlocker.pointCount ?? '?')}`)
  if (blocker) {
    parts.push(
      `blocker=${String(blocker.family ?? '?')}:${String(blocker.type ?? '?')} ${String(blocker.i ?? '?')},${String(
        blocker.j ?? '?'
      )} pts=${String(blocker.pointCount ?? '?')}`
    )
  }
  return parts.join(' | ')
}

export function drawHeroCollisionDebug(context: DevConsoleContext): void {
  const layer = getDebugLayerForCamera(context, DEBUG_HERO_COLLISION_LAYER, DEBUG_OVERLAY_Z + 6)
  layer.clear()

  const hero = getHeroDebugUnit(context)
  if (!hero) {
    document.getElementById('debug-hero-collision')?.remove()
    return
  }

  const entities = getNearbyHeroCollisionEntities(context, hero)
  const infos = entities
    .map(entity => ({ entity, ...getEntityCollisionInfo(context, hero, entity) }))
    .sort((a, b) => a.value - b.value)
  const terrainInfos = getNearbyHeroTerrainCollisionCells(context, hero)
    .map(cell => {
      const debugSpace = getDebugMapSpace(context)
      const collisionMap = {
        grid: debugSpace?.grid ?? context.map.grid,
        mapType: debugSpace?.mapType ?? context.map.mapType,
      } as unknown as RuntimeMap
      const blocker = createHeroTerrainCollisionBlocker(cell, collisionMap)
      const points = getHeroCollisionFootprintPoints(blocker, collisionMap)
      const value = Math.hypot((blocker.x ?? cell.x) - hero.x, (blocker.y ?? cell.y) - hero.y)
      return {
        blocker,
        inside: pointIsInsidePolygon(points, hero),
        points,
        rawPoints: blocker.collisionPoints ?? [],
        value,
      }
    })
    .sort((a, b) => a.value - b.value)

  for (const info of infos) {
    const color = info.inside ? 0xff3050 : (HERO_COLLISION_FAMILY_COLORS[info.entity.family] ?? 0x35e0ff)
    const lift = getReliefOffset(info.entity)
    const points = lift ? info.points.map(point => ({ x: point.x, y: point.y + lift })) : info.points
    drawRoundedIsoShape(layer, points)
    layer.stroke({ color, alpha: info.inside ? 0.95 : 0.75, width: info.inside ? 4 : 2 })
    layer.circle(info.entity.x, info.entity.y + lift, 3)
    layer.fill({ color, alpha: 0.85 })
  }

  for (const info of terrainInfos) {
    if (info.rawPoints.length) {
      drawRoundedIsoShape(layer, info.rawPoints)
      layer.stroke({ color: 0xffffff, alpha: 0.35, width: 1 })
    }
    drawRoundedIsoShape(layer, info.points)
    layer.stroke({
      color: info.inside ? 0xff3050 : HERO_COLLISION_FAMILY_COLORS.terrain,
      alpha: info.inside ? 0.95 : 0.75,
      width: info.inside ? 4 : 2,
    })
  }

  const grid = getDebugMapSpace(context)?.grid ?? context.map.grid
  const cell = grid[hero.i]?.[hero.j]
  if (cell) {
    drawCellStroke(layer, cell, 0xffffff, 0.9, 2)
  }
  const heroLift = getReliefOffset(hero)
  layer.circle(hero.x, hero.y + heroLift, 7)
  layer.fill({ color: infos[0]?.inside ? 0xff3050 : 0x54ff7a, alpha: 0.95 })
  layer.circle(hero.x, hero.y + heroLift, 11)
  layer.stroke({ color: 0xffffff, alpha: 0.95, width: 2 })

  const nearest = infos[0]
  const nearestTerrain = terrainInfos[0]
  const lastMoveBlock = getLastDirectMoveDebugSnapshot()
  const overlay = ensureDebugOverlay('debug-hero-collision')
  overlay.textContent = [
    `Hero collision`,
    `hero ${Math.round(hero.x)},${Math.round(hero.y)} cell ${hero.i},${hero.j}`,
    `cell solid=${Boolean(cell?.solid)} waterBorder=${Boolean(cell?.waterBorder)} has=${cell?.has?.family || 'none'}:${cell?.has?.type || ''}`,
    nearest
      ? `nearest ${nearest.entity.family}:${nearest.entity.type} ${nearest.entity.i},${nearest.entity.j} roundedIso=${nearest.value.toFixed(3)} ${
          nearest.inside ? 'INSIDE' : 'outside'
        }`
      : 'nearest none',
    nearestTerrain
      ? `nearest terrain ${nearestTerrain.blocker.i},${nearestTerrain.blocker.j} distance=${nearestTerrain.value.toFixed(3)} ${
          nearestTerrain.inside ? 'TOUCHING' : 'outside'
        }`
      : 'nearest terrain none',
    lastMoveBlock
      ? `last block ${lastMoveBlock.reason} dir=${lastMoveBlock.dir.x},${lastMoveBlock.dir.y} unit=${lastMoveBlock.unit.i},${lastMoveBlock.unit.j} ${formatDirectMoveDebugDetails(
          lastMoveBlock.details
        )}`
      : 'last block none',
    `blue=solid terrain orange=resource purple=unit lime=animal red=blocking white=current cell green/red=hero`,
  ].join('\n')
}

function resolveTerrainFrame(cell: TerrainSourceCell): { sheet: string; frame: number; source: string } {
  const appearance = cell._terrainAppearance
  if (appearance?.waterBorder) {
    return { sheet: appearance.waterBorder.resourceName, frame: appearance.waterBorder.index, source: 'water border' }
  }
  const base = parseTextureRef(cell.terrainTextureName || '')
  if (appearance?.relief) {
    return { sheet: base.sheet, frame: appearance.relief.index, source: 'relief' }
  }
  return { ...base, source: 'base' }
}

export function drawTerrainFrameDebug(context: DevConsoleContext): void {
  const layer = getDebugContainerForCamera(context, DEBUG_TERRAIN_FRAME_LAYER, DEBUG_OVERLAY_Z + 5)
  layer.removeChildren().forEach(child => child.destroy())

  for (const cell of getCameraCells(context)) {
    if (!cell) continue
    const { frame } = resolveTerrainFrame(cell as TerrainSourceCell)
    const text = new Text({
      text: Number.isNaN(frame) ? '?' : String(frame),
      style: {
        fontFamily: 'monospace',
        fontSize: 10,
        fontWeight: '700',
        fill: 0x66ffcc,
        stroke: { color: 0x000000, width: 3 },
        align: 'center',
      },
    })
    text.anchor.set(0.5, 0.5)
    text.x = cell.x
    text.y = cell.y
    text.eventMode = 'none'
    layer.addChild(text)
  }
}
