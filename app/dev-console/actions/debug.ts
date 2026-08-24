import { Text } from 'pixi.js'
import { ACTION_TYPES, CELL_HEIGHT, CELL_WIDTH, FAMILY_TYPES, PLAYER_TYPES, UNIT_TYPES } from '../../constants'
import { classifyMilitaryUnits, isAliveUnit } from '../../ai/unitGroups'
import {
  canPlayerStillAct,
  drawRoundedIsoShape,
  getGaiaAnimals,
  getRoundedIsoFootprintPoints,
  getReliefOffset,
  isPlayerEliminated,
  parseTextureRef,
  pointIsInsidePolygon,
} from '../../lib'
import { syncEntityHealthDisplay } from '../../lib/entityHealthDisplay'
import type { TerrainSourceCell } from '../../classes/map/TerrainChunkManager'
import type { CommandResult } from '../DevCommandRegistry'
import type { DevConsoleContext, DevEntity, DevPerformanceMetric, DevPlayer } from '../types'
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
  addDebugTicker,
  drawCellDiamond,
  drawCellStroke,
  getCameraCells,
  getDebugContainer,
  getDebugLayer,
  getSolidDebugColor,
  normalizeToggle,
  removeDebugLayer,
  stopDebugTicker,
} from './shared'

const HERO_COLLISION_SCAN_RADIUS = 8
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
  [FAMILY_TYPES.resource]: 0xffa500,
  [FAMILY_TYPES.unit]: 0xb46bff,
  [FAMILY_TYPES.animal]: 0xd4ff35,
}

type AiDebugPlayer = DevPlayer & {
  difficulty?: string
  phase?: string
  population?: number
  populationMax?: number
  stepDelay?: number
  maxVillagerPerAge: Record<number, number>
  maxInfantryByAge: Record<number, number>
  maxArcherByAge: Record<number, number>
  maxCavalryByAge: Record<number, number>
  difficultyConfig: { popCapMultiplier: number; defenseRecallThreshold: number; defensePowerRatio: number }
  enemyUnitMemory: { size: number }
  enemyBuildingMemory: { size: number }
  strategy: {
    military: { getGroupCombatPower(units: DevEntity[]): number }
    getEconomicDemand(): Record<string, number>
  }
  economy: {
    getWorkerSnapshot(villagers: DevEntity[]): WorkerSnapshot
    getResourceTargets(villagerCount: number): WorkerTargets
  }
  scout?: DevEntity | null
  getLivingUnitsByType(type: string): DevEntity[]
  getActiveThreats(): Array<{ target: DevEntity }>
  getNow(): number
}

type WorkerSnapshot = {
  villagersOnFood: DevEntity[]
  villagersOnWood: DevEntity[]
  villagersOnGold: DevEntity[]
  villagersOnStone: DevEntity[]
  inactifVillagers: DevEntity[]
  villagersHunting: DevEntity[]
}

type WorkerTargets = {
  maxVillagersOnFood: number
  maxVillagersOnWood: number
  maxVillagersOnGold: number
  maxVillagersOnStone: number
}

function drawSolidDebug(context: DevConsoleContext): void {
  const { map } = context
  const layer = getDebugLayer(map, DEBUG_SOLID_LAYER, DEBUG_OVERLAY_Z + 1)
  layer.clear()

  for (const cell of getCameraCells(context)) {
    if (!cell || (!cell.solid && !cell.border && !cell.inclined)) continue
    drawCellDiamond(layer, cell, getSolidDebugColor(cell))
  }
}

function drawPathDebug(context: DevConsoleContext): void {
  const { map, players } = context
  const layer = getDebugLayer(map, DEBUG_PATH_LAYER, DEBUG_OVERLAY_Z + 2)
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

function drawGridDebug(context: DevConsoleContext): void {
  const { map } = context
  const layer = getDebugLayer(map, DEBUG_GRID_LAYER, DEBUG_OVERLAY_Z + 3)
  layer.clear()

  for (const cell of getCameraCells(context)) {
    if (!cell) continue
    drawCellStroke(layer, cell, 0xffffff, 0.55, 1)
  }
}

function drawCoordsDebug(context: DevConsoleContext): void {
  const { map } = context
  const layer = getDebugContainer(map, DEBUG_COORDS_LAYER, DEBUG_OVERLAY_Z + 4)
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

function drawVisionDebug(context: DevConsoleContext): void {
  const { map, player } = context
  const layer = getDebugLayer(map, DEBUG_VISION_LAYER, DEBUG_OVERLAY_Z)
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
  const controlsHero = context.controls && 'heroUnit' in context.controls ? (context.controls.heroUnit as DevEntity | null) : null
  if (controlsHero) return controlsHero
  return (context.player.units.find(unit => unit.controlMode === 'hero') as DevEntity | undefined) ?? null
}

function getPointForDegree(origin: { x: number; y: number }, degree: number, distance: number): { x: number; y: number } {
  const radians = ((degree - 180) * Math.PI) / 180
  return {
    x: origin.x + Math.cos(radians) * distance,
    y: origin.y + (Math.sin(radians) * distance) / HERO_AIM_DEBUG_Y_SCALE,
  }
}

function drawHeroAimSector(
  layer: ReturnType<typeof getDebugLayer>,
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

function drawHeroAimDebug(context: DevConsoleContext): void {
  const { map } = context
  const layer = getDebugLayer(map, DEBUG_HERO_AIM_LAYER, DEBUG_OVERLAY_Z + 7)
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
  const { map } = context
  for (let i = hero.i - HERO_COLLISION_SCAN_RADIUS; i <= hero.i + HERO_COLLISION_SCAN_RADIUS; i++) {
    const row = map.grid[i]
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

function getEntityCollisionInfo(context: DevConsoleContext, hero: DevEntity, entity: DevEntity) {
  const points = getRoundedIsoFootprintPoints(entity, context.map.grid)
  const inside = pointIsInsidePolygon(points, hero)
  const centerDistance = Math.hypot(hero.x - entity.x, hero.y - entity.y)
  return { points, value: centerDistance, inside }
}

function drawHeroCollisionDebug(context: DevConsoleContext): void {
  const { map } = context
  const layer = getDebugLayer(map, DEBUG_HERO_COLLISION_LAYER, DEBUG_OVERLAY_Z + 6)
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

  for (const info of infos) {
    const color = info.inside ? 0xff3050 : HERO_COLLISION_FAMILY_COLORS[info.entity.family] ?? 0x35e0ff
    const lift = getReliefOffset(info.entity)
    const points = lift ? info.points.map(point => ({ x: point.x, y: point.y + lift })) : info.points
    drawRoundedIsoShape(layer, points)
    layer.stroke({ color, alpha: info.inside ? 0.95 : 0.75, width: info.inside ? 4 : 2 })
    layer.circle(info.entity.x, info.entity.y + lift, 3)
    layer.fill({ color, alpha: 0.85 })
  }

  const cell = context.map.grid[hero.i]?.[hero.j]
  if (cell) {
    drawCellStroke(layer, cell, 0xffffff, 0.9, 2)
  }
  const heroLift = getReliefOffset(hero)
  layer.circle(hero.x, hero.y + heroLift, 7)
  layer.fill({ color: infos[0]?.inside ? 0xff3050 : 0x54ff7a, alpha: 0.95 })
  layer.circle(hero.x, hero.y + heroLift, 11)
  layer.stroke({ color: 0xffffff, alpha: 0.95, width: 2 })

  const nearest = infos[0]
  const overlay = ensureDebugOverlay('debug-hero-collision')
  overlay.textContent = [
    `Hero collision`,
    `hero ${Math.round(hero.x)},${Math.round(hero.y)} cell ${hero.i},${hero.j}`,
    `cell solid=${Boolean(cell?.solid)} has=${cell?.has?.family || 'none'}:${cell?.has?.type || ''}`,
    nearest
      ? `nearest ${nearest.entity.family}:${nearest.entity.type} ${nearest.entity.i},${nearest.entity.j} roundedIso=${nearest.value.toFixed(3)} ${
          nearest.inside ? 'INSIDE' : 'outside'
        }`
      : 'nearest none',
    `cyan=building orange=resource purple=unit lime=animal red=blocking white=current cell green/red=hero`,
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

function drawTerrainFrameDebug(context: DevConsoleContext): void {
  const { map } = context
  const layer = getDebugContainer(map, DEBUG_TERRAIN_FRAME_LAYER, DEBUG_OVERLAY_Z + 5)
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

function ensureDebugOverlay(id: string): HTMLElement {
  let overlay = document.getElementById(id)
  if (!overlay) {
    overlay = document.createElement('div')
    overlay.id = id
    overlay.classList.add('debug-overlay')
    document.body.appendChild(overlay)
  } else if (!overlay.classList.contains('debug-overlay')) {
    overlay.classList.add('debug-overlay')
  }
  return overlay
}

function ensurePerfOverlay(context: DevConsoleContext): void {
  const overlay = ensureDebugOverlay('debug-perf')
  const { app, map, players } = context
  const units = players.reduce((sum: number, player) => sum + player.units.length, 0) + getGaiaAnimals(map.gaia).length
  const buildings = players.reduce((sum: number, player) => sum + player.buildings.length, 0)
  const schedulerTasks = context.scheduler?._tasks?.size ?? 0
  const speed = context.app?.ticker?.speed ?? context.scheduler?.timeScale ?? 1
  const perf = context.performance?.snapshot?.()
  const metric = (name: string) => perf?.metrics[`runtime.${name}`] || perf?.metrics[name]
  const pathfinding = metric('pathfinding')
  const aiStep = metric('ai.step') || metric('aiStep')
  const schedulerTick = metric('scheduler.tick')
  const unitMove = metric('unit.move')
  const visibility = metric('visibility.update')
  const camera = metric('camera.visibleCells')
  const viewportFog = metric('fog.viewport')
  overlay.textContent = [
    `FPS ${Math.round(app?.ticker.FPS ?? 0)}`,
    `Frame interval ${perf?.frames.averageMs.toFixed(2) || '0.00'}ms | p95 ${perf?.frames.p95Ms.toFixed(2) || '0.00'}ms`,
    `Units ${units}`,
    `Buildings ${buildings}`,
    `Resources ${map.resources.size}`,
    `Tasks ${schedulerTasks}`,
    `Speed ${speed}x`,
    `Scheduler ${schedulerTick?.averageMs.toFixed(2) || '0.00'}ms avg | ${schedulerTick?.maxMs.toFixed(2) || '0.00'}ms max`,
    `Move ${unitMove?.averageMs.toFixed(2) || '0.00'}ms avg | ${unitMove?.maxMs.toFixed(2) || '0.00'}ms max`,
    `Vision ${visibility?.averageMs.toFixed(2) || '0.00'}ms avg | ${visibility?.maxMs.toFixed(2) || '0.00'}ms max`,
    `Camera ${camera?.averageMs.toFixed(2) || '0.00'}ms avg | ${camera?.maxMs.toFixed(2) || '0.00'}ms max`,
    `Path ${pathfinding?.averageMs.toFixed(2) || '0.00'}ms avg | ${pathfinding?.maxMs.toFixed(2) || '0.00'}ms max`,
    `AI step ${aiStep?.averageMs.toFixed(2) || '0.00'}ms avg | ${aiStep?.maxMs.toFixed(2) || '0.00'}ms max`,
    `Fog ${viewportFog?.averageMs.toFixed(2) || '0.00'}ms avg | ${viewportFog?.maxMs.toFixed(2) || '0.00'}ms max`,
  ].join('\n')
}

export function performanceReport(context: DevConsoleContext, value: string): CommandResult {
  if (value === 'reset') {
    context.performance?.reset?.()
    return { ok: true, message: 'Performance samples reset' }
  }
  const report = context.performance?.snapshot?.()
  if (!report) return { ok: false, message: 'Performance monitor unavailable' }
  const lines = [
    `Frame interval ${report.frames.samples} samples | avg ${report.frames.averageMs.toFixed(2)}ms | p95 ${report.frames.p95Ms.toFixed(2)}ms | p99 ${report.frames.p99Ms.toFixed(2)}ms | FPS ${Math.round(report.frames.fps)} | speed ${report.frames.speed}x`,
  ]
  const metrics = Object.entries(report.metrics).sort(([, a], [, b]) => b.totalMs - a.totalMs)
  for (const [name, metric] of metrics as [string, DevPerformanceMetric][]) {
    lines.push(
      `${name}: ${metric.count} calls | total ${metric.totalMs.toFixed(2)}ms | avg ${metric.averageMs.toFixed(2)}ms | max ${metric.maxMs.toFixed(2)}ms | slow ${metric.slowCount}`
    )
  }
  return { ok: true, message: lines.join('\n') }
}

function getAiDebugLines(aiPlayers: AiDebugPlayer[], targetIndex: number | null = null): string[] | null {
  const targets = targetIndex !== null ? [aiPlayers[targetIndex]].filter(Boolean) : aiPlayers
  if (!targets.length) return null

  const lines: string[] = []

  for (const ai of targets) {
    const idx = aiPlayers.indexOf(ai)
    const villagers = ai.getLivingUnitsByType(UNIT_TYPES.villager)
    const aliveUnits = ai.units.filter(isAliveUnit)
    const { infantry, archers, cavalry } = classifyMilitaryUnits(aliveUnits)
    const military = [...infantry, ...archers, ...cavalry]
    const militaryPower = Math.round(ai.strategy.military.getGroupCombatPower(military))
    const threats = ai.getActiveThreats()
    const enemyUnits = ai.enemyUnitMemory.size
    const enemyBuildings = ai.enemyBuildingMemory.size
    const maxVil = Math.floor(ai.maxVillagerPerAge[ai.age] * ai.difficultyConfig.popCapMultiplier)
    const maxInf = ai.maxInfantryByAge[ai.age]
    const maxArc = ai.maxArcherByAge[ai.age]
    const maxCav = ai.maxCavalryByAge[ai.age]
    const workerSnapshot = ai.economy.getWorkerSnapshot(villagers)
    const workerTargets = ai.economy.getResourceTargets(villagers.length)
    const demand = ai.strategy.getEconomicDemand()
    const builders = villagers.filter(
      (v: DevEntity) => !v.isDead && (v.hitPoints ?? 0) > 0 && v.action === ACTION_TYPES.build
    ).length
    const scoutLabel = ai.scout && !ai.scout.isDead ? `${ai.scout.type}#${ai.scout.name || ai.scout.label}` : 'none'
    const scoutStatus =
      ai.scout && !ai.scout.isDead ? (ai.scout.inactif ? 'idle' : ai.scout.dest ? 'moving' : 'active') : 'none'

    lines.push(`AI [${idx}] ${ai.label} (${ai.difficulty})`)
    lines.push(`Phase ${ai.phase} | Age ${ai.age} | Pop ${ai.population}/${ai.populationMax} | Step ${ai.stepDelay}ms`)
    lines.push(
      `Res W:${ai.wood} F:${ai.food} S:${ai.stone} G:${ai.gold} | Demand W:${demand.wood} F:${demand.food} S:${demand.stone} G:${demand.gold}`
    )
    lines.push(
      `Eco vil ${villagers.length}/${maxVil} | food ${workerSnapshot.villagersOnFood.length}/${workerTargets.maxVillagersOnFood} | wood ${workerSnapshot.villagersOnWood.length}/${workerTargets.maxVillagersOnWood} | gold ${workerSnapshot.villagersOnGold.length}/${workerTargets.maxVillagersOnGold} | stone ${workerSnapshot.villagersOnStone.length}/${workerTargets.maxVillagersOnStone}`
    )
    lines.push(
      `Jobs idle ${workerSnapshot.inactifVillagers.length} | builders ${builders} | hunters ${workerSnapshot.villagersHunting.length} | scout ${scoutLabel} (${scoutStatus})`
    )
    lines.push(
      `Army inf ${infantry.length}/${maxInf} | arc ${archers.length}/${maxArc} | cav ${cavalry.length}/${maxCav}`
    )
    lines.push(
      `Power ${militaryPower} | Defense recall ${ai.difficultyConfig.defenseRecallThreshold} | Ratio ${ai.difficultyConfig.defensePowerRatio}`
    )
    lines.push(
      `Intel mem u:${enemyUnits} b:${enemyBuildings} | known trees:${ai.foundedTrees?.size ?? 0} berries:${ai.foundedBerrybushs?.size ?? 0} hunt:${ai.foundedAnimals?.size ?? 0} gold:${ai.foundedGolds?.size ?? 0} stone:${ai.foundedStones?.size ?? 0}`
    )
    lines.push(`Threats ${threats.length}${threats.length ? ` | ${threats.map(t => t.target.type).join(', ')}` : ''}`)
    lines.push('')
  }

  lines.pop()
  return lines
}

function ensureAiInfoOverlay(context: DevConsoleContext): void {
  const overlay = ensureDebugOverlay('debug-ai-info')
  const aiPlayers = context.players.filter((p): p is AiDebugPlayer => p.type === PLAYER_TYPES.ai)

  if (!aiPlayers.length) {
    overlay.textContent = 'No AI players on the map'
    return
  }

  const targetIndex = Number.isInteger(context.debugAiInfoTargetIndex) ? context.debugAiInfoTargetIndex : null
  const lines = getAiDebugLines(aiPlayers, targetIndex)
  overlay.textContent = lines?.join('\n') || `No AI player at index ${targetIndex}`
}

export function toggleSolidDebug(context: DevConsoleContext, value: string): CommandResult {
  const { map } = context
  const showSolid = normalizeToggle(value, Boolean(map.debugSolidVisible))

  map.debugSolidVisible = showSolid
  if (!showSolid) {
    removeDebugLayer(context, DEBUG_SOLID_LAYER, '_debugSolidTicker')
    return { ok: true, message: 'Solid debug: off' }
  }

  drawSolidDebug(context)
  addDebugTicker(context, '_debugSolidTicker', drawSolidDebug)
  return { ok: true, message: 'Solid debug: on' }
}

export function togglePathDebug(context: DevConsoleContext, value: string): CommandResult {
  const { app, map } = context
  const showPath = normalizeToggle(value, Boolean(map.debugPathVisible))

  map.debugPathVisible = showPath
  if (!showPath) {
    removeDebugLayer(context, DEBUG_PATH_LAYER, '_debugPathTicker')
    return { ok: true, message: 'Path debug: off' }
  }

  drawPathDebug(context)
  stopDebugTicker(context, '_debugPathTicker')
  map._debugPathTicker = () => drawPathDebug(context)
  app?.ticker.add(map._debugPathTicker)
  return { ok: true, message: 'Path debug: on' }
}

export function toggleVisionDebug(context: DevConsoleContext, value: string): CommandResult {
  const { map } = context
  const showVision = normalizeToggle(value, Boolean(map.debugVisionVisible))

  map.debugVisionVisible = showVision
  if (!showVision) {
    removeDebugLayer(context, DEBUG_VISION_LAYER, '_debugVisionTicker')
    return { ok: true, message: 'Vision debug: off' }
  }

  drawVisionDebug(context)
  addDebugTicker(context, '_debugVisionTicker', drawVisionDebug)
  return { ok: true, message: 'Vision debug: on' }
}

export function toggleGridDebug(context: DevConsoleContext, value: string): CommandResult {
  const { map } = context
  const showGrid = normalizeToggle(value, Boolean(map.debugGridVisible))
  map.debugGridVisible = showGrid

  if (showGrid) {
    drawGridDebug(context)
    addDebugTicker(context, '_debugGridTicker', drawGridDebug)
  } else {
    removeDebugLayer(context, DEBUG_GRID_LAYER, '_debugGridTicker')
  }

  return { ok: true, message: `Grid debug: ${showGrid ? 'on' : 'off'}` }
}

export function toggleCoordsDebug(context: DevConsoleContext, value: string): CommandResult {
  const { map } = context
  const showCoords = normalizeToggle(value, Boolean(map.debugCoordsVisible))
  map.debugCoordsVisible = showCoords

  if (showCoords) {
    drawCoordsDebug(context)
    addDebugTicker(context, '_debugCoordsTicker', drawCoordsDebug)
  } else {
    removeDebugLayer(context, DEBUG_COORDS_LAYER, '_debugCoordsTicker')
  }

  return { ok: true, message: `Coords debug: ${showCoords ? 'on' : 'off'}` }
}

export function toggleHeroCollisionDebug(context: DevConsoleContext, value: string): CommandResult {
  const { app, map } = context
  const showHeroCollision = normalizeToggle(value, Boolean(map.debugHeroCollisionVisible))
  map.debugHeroCollisionVisible = showHeroCollision

  if (!showHeroCollision) {
    removeDebugLayer(context, DEBUG_HERO_COLLISION_LAYER, '_debugHeroCollisionTicker')
    document.getElementById('debug-hero-collision')?.remove()
    return { ok: true, message: 'Hero collision debug: off' }
  }

  drawHeroCollisionDebug(context)
  stopDebugTicker(context, '_debugHeroCollisionTicker')
  map._debugHeroCollisionTicker = () => drawHeroCollisionDebug(context)
  app?.ticker.add(map._debugHeroCollisionTicker)
  return { ok: true, message: 'Hero collision debug: on' }
}

export function toggleHeroAimDebug(context: DevConsoleContext, value: string): CommandResult {
  const { app, map } = context
  const showHeroAim = normalizeToggle(value, Boolean(map.debugHeroAimVisible))
  map.debugHeroAimVisible = showHeroAim

  if (!showHeroAim) {
    removeDebugLayer(context, DEBUG_HERO_AIM_LAYER, '_debugHeroAimTicker')
    return { ok: true, message: 'Hero aim debug: off' }
  }

  drawHeroAimDebug(context)
  stopDebugTicker(context, '_debugHeroAimTicker')
  map._debugHeroAimTicker = () => drawHeroAimDebug(context)
  app?.ticker.add(map._debugHeroAimTicker)
  return { ok: true, message: 'Hero aim debug: on' }
}

export function toggleTerrainFrameDebug(context: DevConsoleContext, value: string): CommandResult {
  const { map } = context
  const showTerrainFrame = normalizeToggle(value, Boolean(map.debugTerrainFrameVisible))
  map.debugTerrainFrameVisible = showTerrainFrame

  if (showTerrainFrame) {
    drawTerrainFrameDebug(context)
    addDebugTicker(context, '_debugTerrainFrameTicker', drawTerrainFrameDebug)
  } else {
    removeDebugLayer(context, DEBUG_TERRAIN_FRAME_LAYER, '_debugTerrainFrameTicker')
  }

  return { ok: true, message: `Terrain frame debug: ${showTerrainFrame ? 'on' : 'off'}` }
}

export function toggleFreeCamera(context: DevConsoleContext, value: string): CommandResult {
  const { controls } = context
  if (!controls?.setFreeCamera) return { ok: false, message: 'Free camera unavailable' }
  if (!controls.isHeroControlActive?.()) return { ok: false, message: 'Free camera only applies in hero gameplay' }

  const enabled = normalizeToggle(value, Boolean(controls.freeCameraActive))
  controls.setFreeCamera(enabled)
  return { ok: true, message: `Free camera: ${enabled ? 'on' : 'off'}` }
}

export function togglePerfDebug(context: DevConsoleContext, value: string): CommandResult {
  const { app, map } = context
  const showPerf = normalizeToggle(value, Boolean(map.debugPerfVisible))

  map.debugPerfVisible = showPerf
  if (!showPerf) {
    stopDebugTicker(context, '_debugPerfTicker')
    document.getElementById('debug-perf')?.remove()
    return { ok: true, message: 'Perf debug: off' }
  }

  ensurePerfOverlay(context)
  stopDebugTicker(context, '_debugPerfTicker')
  map._debugPerfTicker = () => ensurePerfOverlay(context)
  app?.ticker.add(map._debugPerfTicker)
  return { ok: true, message: 'Perf debug: on' }
}

function getVisibleEntities(context: DevConsoleContext): Set<DevEntity> {
  const visibleCells = getCameraCells(context)
  const entities = new Set<DevEntity>()
  const addIfVisible = (entity: DevEntity | undefined): void => {
    if (!entity) return
    const cell = context.map.grid[entity.i]?.[entity.j]
    if (!cell || !visibleCells.has(cell)) return
    entities.add(entity)
  }

  context.players.forEach(player => {
    player.units.forEach(addIfVisible)
    player.buildings.forEach(addIfVisible)
    player.animals?.forEach(addIfVisible)
  })

  context.map.gaia?.units?.forEach(addIfVisible)
  context.map.gaia?.animals?.forEach(addIfVisible)
  return entities
}

function getAllEntities(context: DevConsoleContext): Set<DevEntity> {
  const entities = new Set<DevEntity>()
  const add = (entity: DevEntity | undefined): void => {
    if (entity) entities.add(entity)
  }

  context.players.forEach(player => {
    player.units.forEach(add)
    player.buildings.forEach(add)
    player.animals?.forEach(add)
  })

  context.map.gaia?.units?.forEach(add)
  context.map.gaia?.animals?.forEach(add)
  return entities
}

function applyEntityBars(context: DevConsoleContext, entities: Set<DevEntity>): number {
  let refreshed = 0
  for (const entity of entities) {
    if (entity.selected || entity.shouldKeepHealthBarVisible?.()) {
      syncEntityHealthDisplay(entity)
      refreshed += 1
      continue
    }
    entity.removeHealthBar?.()
    entity.removeEnergyBar?.()
  }
  return refreshed
}

function hideEntityBars(entities: Set<DevEntity>): void {
  for (const entity of entities) {
    entity.removeEnergyBar?.()
    if (entity.selected || entity.shouldKeepHealthBarVisible?.()) {
      entity.drawHealthBar?.()
      continue
    }
    entity.removeHealthBar?.()
  }
}

function refreshEntityBars(context: DevConsoleContext): CommandResult {
  const refreshed = applyEntityBars(context, getVisibleEntities(context))
  return { ok: true, message: `Entity bars refreshed on ${refreshed} entities` }
}

export function toggleEntityBars(context: DevConsoleContext, value: string): CommandResult {
  const { map } = context
  const showEntityBars = normalizeToggle(value, Boolean(map.debugEntityBarsVisible))

  map.debugEntityBarsVisible = showEntityBars
  if (!showEntityBars) {
    stopDebugTicker(context, '_debugEntityBarsTicker')
    hideEntityBars(getAllEntities(context))
    return { ok: true, message: 'Entity bars: off' }
  }

  refreshEntityBars(context)
  addDebugTicker(context, '_debugEntityBarsTicker', refreshEntityBars)
  return { ok: true, message: 'Entity bars: on' }
}

function ensurePlayerStatsOverlay(context: DevConsoleContext): void {
  const overlay = ensureDebugOverlay('debug-player-stats')
  const { players = [], player: me } = context
  const sorted = [...players].sort((a, b) => {
    const activeDiff = Number(canPlayerStillAct(b)) - Number(canPlayerStillAct(a))
    if (activeDiff !== 0) return activeDiff
    return b.units.length + b.buildings.length - (a.units.length + a.buildings.length)
  })

  const formatValue = (current: number | undefined, total: number | undefined): string => {
    const normalizedCurrent = Number.isFinite(current ?? NaN) ? Math.round(current ?? 0) : 0
    const normalizedTotal = Number.isFinite(total ?? NaN) ? Math.round(total ?? normalizedCurrent) : normalizedCurrent
    return `${normalizedCurrent}/${normalizedTotal}`
  }

  overlay.innerHTML = ''
  sorted.forEach((p, rank) => {
    const dead = isPlayerEliminated(p)
    const isMe = p === me
    const label = isMe ? 'You' : (p.color?.charAt(0).toUpperCase() ?? '') + p.color?.slice(1)

    const row = document.createElement('div')
    row.className = 'debug-player-stats-row' + (dead ? ' debug-player-stats-row--dead' : '')
    row.style.color = p.colorHex
    const totalUnits = p.units.length
    const totalBuildings = p.buildings.length
    row.textContent = `${rank + 1}. ${label}: ${totalUnits}/${totalBuildings}`
    overlay.appendChild(row)

    for (const unit of p.units) {
      const unitRow = document.createElement('div')
      unitRow.className = 'debug-player-stats-unit' + (dead ? ' debug-player-stats-row--dead' : '')
      unitRow.style.color = p.colorHex

      const unitLabel = unit.name || `${unit.type}`
      const hp = formatValue(unit.hitPoints, unit.totalHitPoints)
      const energy =
        unit.energy == null || unit.totalEnergy == null
          ? null
          : formatValue(unit.energy, unit.totalEnergy)

      unitRow.textContent = `  ${unitLabel}: HP ${hp}${energy ? ` | EN ${energy}` : ''}`
      overlay.appendChild(unitRow)
    }
  })
}

export function togglePlayerStatsDebug(context: DevConsoleContext, value: string): CommandResult {
  const { app, map } = context
  const showPlayerStats = normalizeToggle(value, Boolean(map.debugPlayerStatsVisible))

  map.debugPlayerStatsVisible = showPlayerStats
  if (!showPlayerStats) {
    stopDebugTicker(context, '_debugPlayerStatsTicker')
    document.getElementById('debug-player-stats')?.remove()
    return { ok: true, message: 'Player stats debug: off' }
  }

  ensurePlayerStatsOverlay(context)
  stopDebugTicker(context, '_debugPlayerStatsTicker')
  map._debugPlayerStatsTicker = () => ensurePlayerStatsOverlay(context)
  app?.ticker.add(map._debugPlayerStatsTicker)
  return { ok: true, message: 'Player stats debug: on' }
}

export function aiInfo(context: DevConsoleContext, value: string): CommandResult {
  const aiPlayers = context.players.filter((p): p is AiDebugPlayer => p.type === PLAYER_TYPES.ai)
  if (!aiPlayers.length) return { ok: false, message: 'No AI players on the map' }

  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : ''
  const explicitOff = normalized === 'off'
  const explicitOn = normalized === 'on'
  const parsedIndex = value !== undefined && !explicitOn && !explicitOff ? parseInt(value, 10) : null

  if (parsedIndex !== null && isNaN(parsedIndex)) {
    return { ok: false, message: `Invalid AI index "${value}"` }
  }

  if (parsedIndex !== null && !aiPlayers[parsedIndex]) {
    return { ok: false, message: `No AI player at index ${parsedIndex}` }
  }

  const isVisible = Boolean(context.map.debugAiInfoVisible)
  const sameTarget =
    (parsedIndex === null && !Number.isInteger(context.debugAiInfoTargetIndex)) ||
    context.debugAiInfoTargetIndex === parsedIndex
  const showOverlay = explicitOff ? false : explicitOn || parsedIndex !== null ? true : !isVisible || !sameTarget

  context.map.debugAiInfoVisible = showOverlay

  if (!showOverlay) {
    context.debugAiInfoTargetIndex = null
    stopDebugTicker(context, '_debugAiInfoTicker')
    document.getElementById('debug-ai-info')?.remove()
    return { ok: true, message: 'AI info: off' }
  }

  context.debugAiInfoTargetIndex = parsedIndex
  ensureAiInfoOverlay(context)
  stopDebugTicker(context, '_debugAiInfoTicker')
  context.map._debugAiInfoTicker = () => ensureAiInfoOverlay(context)
  context.app?.ticker.add(context.map._debugAiInfoTicker)

  return {
    ok: true,
    message: `AI info: on${parsedIndex !== null ? ` (AI ${parsedIndex})` : ' (all AI)'}`,
  }
}
