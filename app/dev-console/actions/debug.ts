import { syncEntityHealthDisplay } from '../../lib/entities/entityHealthDisplay'
import type { CommandResult } from '../DevCommandRegistry'
import type { DevConsoleContext, DevEntity, DevPerformanceMetric, DevPerformanceSnapshot } from '../types'
import {
  drawCoordsDebug,
  drawGridDebug,
  drawHeroAimDebug,
  drawHeroCollisionDebug,
  drawPathDebug,
  drawSolidDebug,
  drawTerrainFrameDebug,
  drawVisionDebug,
} from './DebugMapRenderers'
import {
  ensureAiInfoOverlay,
  ensurePerfOverlay,
  ensurePlayerStatsOverlay,
  isAiDebugPlayer,
} from './DebugOverlayRenderers'
import {
  DEBUG_COORDS_LAYER,
  DEBUG_GRID_LAYER,
  DEBUG_HERO_AIM_LAYER,
  DEBUG_HERO_COLLISION_LAYER,
  DEBUG_PATH_LAYER,
  DEBUG_SOLID_LAYER,
  DEBUG_TERRAIN_FRAME_LAYER,
  DEBUG_VISION_LAYER,
  addDebugTicker,
  getCameraCells,
  normalizeToggle,
  removeDebugLayer,
  stopDebugTicker,
} from './shared'
import { isMovementDebugEnabled, setMovementDebugEnabled } from '../../classes/unit/movement/UnitMovementDebug'
import { getLazyEquipmentLoadStats } from '../../lib/lpc/lazyEquipmentAssets'
import { getGaiaAnimals } from '../../lib/playerState'

export function performanceReport(context: DevConsoleContext, value = ''): CommandResult {
  const [mode = '', ...rest] = value.trim().split(/\s+/).filter(Boolean)
  if (mode === 'reset') {
    context.performance?.reset?.()
    return { ok: true, message: 'Performance samples reset' }
  }
  const report = context.performance?.snapshot?.()
  if (!report) return { ok: false, message: 'Performance monitor unavailable' }
  const scene = createSceneBreakdown(context)
  if (mode === 'json') return { ok: true, message: JSON.stringify({ ...report, scene }, null, 2) }
  if (mode === 'spikes') {
    const lines = perfReportSlowFrames(report, 8)
    if (!lines.length) return { ok: true, message: 'No slow frames captured yet' }
    return { ok: true, message: lines.join('\n') }
  }
  if (mode === 'metric') {
    const name = rest.join(' ')
    const metric = report.metrics[name] || report.metrics[`runtime.${name}`] || report.metrics[`load.${name}`]
    if (!name || !metric) return { ok: false, message: 'Usage: perf-report metric <metricName>' }
    const lines = [
      `${name}`,
      `calls ${metric.count ?? 0} | total ${metric.totalMs.toFixed(2)}ms | avg/call ${metric.averageMs.toFixed(3)}ms`,
      `exclusive ${metric.exclusiveMs?.toFixed(2) ?? '0.00'}ms | exclusive avg ${metric.averageExclusiveMs?.toFixed(3) ?? '0.000'}ms | max exclusive ${metric.maxExclusiveMs?.toFixed(2) ?? '0.00'}ms`,
      `measured ${metric.measuredCount ?? 0} | measured avg ${metric.measuredAverageMs?.toFixed(3) ?? '0.000'}ms | measured exclusive avg ${metric.measuredAverageExclusiveMs?.toFixed(3) ?? '0.000'}ms | max call ${metric.maxMs.toFixed(2)}ms | last ${metric.lastMs?.toFixed(2) ?? '0.00'}ms`,
      `frames ${metric.frames ?? 0} | avg/frame ${metric.averageFrameMs?.toFixed(2) ?? '0.00'}ms | avg exclusive/frame ${metric.averageFrameExclusiveMs?.toFixed(2) ?? '0.00'}ms | max/frame ${metric.maxFrameMs?.toFixed(2) ?? '0.00'}ms | max exclusive/frame ${metric.maxFrameExclusiveMs?.toFixed(2) ?? '0.00'}ms | max calls/frame ${metric.maxFrameCalls ?? 0}`,
      `slow calls ${metric.slowCount ?? 0}`,
    ]
    const slowSamples = metric.slowSamples || []
    if (slowSamples.length) {
      lines.push('recent slow calls:')
      for (const sample of slowSamples.slice(-6).reverse()) {
        lines.push(`  ${sample.duration.toFixed(2)}ms at ${sample.at.toFixed(0)}ms`)
      }
    }
    return { ok: true, message: lines.join('\n') }
  }
  if (mode === 'render') {
    const lines = perfReportRenderStats(report, 8)
    if (!lines.length) return { ok: true, message: 'No render stats captured yet' }
    return { ok: true, message: lines.join('\n') }
  }
  if (mode === 'scene') return { ok: true, message: formatSceneBreakdown(scene).join('\n') }
  const lines = [
    `Frame interval ${report.frames.samples} samples | avg ${report.frames.averageMs.toFixed(2)}ms | p95 ${report.frames.p95Ms.toFixed(2)}ms | p99 ${report.frames.p99Ms.toFixed(2)}ms | slow frames ${report.frames.slowCount ?? 0} | FPS ${Math.round(report.frames.fps)} | speed ${report.frames.speed}x`,
  ]
  lines.push(...perfReportSlowFrames(report, 3))
  lines.push(...perfReportRenderStats(report, 3))
  lines.push(...formatSceneBreakdown(scene))
  lines.push(...perfReportMetricGroup(report, 'Load breakdown', 'load.', 16))
  lines.push('Top metrics')
  const limit = mode === 'top' ? Number(rest[0] || 20) : 12
  const metrics = Object.entries(report.metrics)
    .sort(([, a], [, b]) => b.totalMs - a.totalMs)
    .slice(0, Number.isFinite(limit) ? limit : Infinity)
  for (const [name, metric] of metrics as [string, DevPerformanceMetric][]) {
    lines.push(
      `${name}: ${metric.count} calls | total ${metric.totalMs.toFixed(2)}ms | exclusive ${metric.exclusiveMs?.toFixed(2) ?? '0.00'}ms | avg ${metric.averageMs.toFixed(3)}ms | max call ${metric.maxMs.toFixed(2)}ms | max exclusive/frame ${metric.maxFrameExclusiveMs?.toFixed(2) ?? '0.00'}ms | calls/frame max ${metric.maxFrameCalls ?? 0} | slow ${metric.slowCount}`
    )
  }
  return { ok: true, message: lines.join('\n') }
}

type SceneEntityCounts = {
  total: number
  camera: number
  visible: number
  renderable: number
}

type SceneBreakdown = {
  cells: {
    total: number
    cameraCandidates: number
  }
  entities: {
    units: SceneEntityCounts
    buildings: SceneEntityCounts
    resources: SceneEntityCounts
    animals: SceneEntityCounts
    corpses: SceneEntityCounts
  }
  renderChunks: {
    total: number
    renderable: number
    displayObjects: number
  }
  terrainChunks: {
    total: number
    mounted: number
    visible: number
    visualCells: number
  }
  equipmentAtlases: {
    loaded: number
    pending: number
    total: number
  }
  tasks: number
}

function createEmptyEntityCounts(): SceneEntityCounts {
  return { total: 0, camera: 0, visible: 0, renderable: 0 }
}

function isEntityVisible(entity: DevEntity): boolean {
  const sprite = entity.sprite as { visible?: boolean } | undefined
  return entity.visible !== false && sprite?.visible !== false
}

function isEntityRenderable(entity: DevEntity): boolean {
  const sprite = entity.sprite as { renderable?: boolean } | undefined
  return isEntityVisible(entity) && entity.renderable !== false && sprite?.renderable !== false
}

function countEntity(
  counts: SceneEntityCounts,
  context: DevConsoleContext,
  visibleCells: Set<DevEntity['currentCell']>,
  entity: DevEntity | undefined
): void {
  if (!entity || entity.isDestroyed) return

  counts.total += 1
  const cell = entity.currentCell ?? context.map.grid[entity.i]?.[entity.j] ?? null
  if (cell && visibleCells.has(cell)) counts.camera += 1
  if (isEntityVisible(entity)) counts.visible += 1
  if (isEntityRenderable(entity)) counts.renderable += 1
}

function createSceneBreakdown(context: DevConsoleContext): SceneBreakdown {
  const visibleCells = (context.controls?.cameraController?.visibleCells ?? new Set()) as Set<DevEntity['currentCell']>
  const units = createEmptyEntityCounts()
  const buildings = createEmptyEntityCounts()
  const resources = createEmptyEntityCounts()
  const animals = createEmptyEntityCounts()
  const corpses = createEmptyEntityCounts()

  for (const player of context.players) {
    player.units.forEach(unit => countEntity(units, context, visibleCells, unit as DevEntity))
    player.buildings.forEach(building => countEntity(buildings, context, visibleCells, building as DevEntity))
    player.corpses?.forEach(corpse => countEntity(corpses, context, visibleCells, corpse as DevEntity))
    player.animals?.forEach(animal => countEntity(animals, context, visibleCells, animal as DevEntity))
  }
  getGaiaAnimals(context.map.gaia).forEach(animal => countEntity(animals, context, visibleCells, animal as DevEntity))
  context.map.resources.forEach(resource => countEntity(resources, context, visibleCells, resource))

  const renderChunks = context.map.renderChunks ?? []
  const terrainChunks = context.map.terrainChunkManager?.chunks
  const terrainChunkClock = context.map.terrainChunkManager?.clock
  let visibleTerrainChunks = 0
  let mountedTerrainChunks = 0
  let terrainVisualCells = 0
  if (terrainChunks) {
    for (const chunk of terrainChunks.values()) {
      if (terrainChunkClock != null && chunk.lastUsed === terrainChunkClock) visibleTerrainChunks += 1
      if (chunk.mounted) mountedTerrainChunks += 1
      terrainVisualCells += chunk.visualCells?.size ?? 0
    }
  }

  return {
    cells: {
      total: context.map.size * context.map.size,
      cameraCandidates: visibleCells.size,
    },
    entities: {
      units,
      buildings,
      resources,
      animals,
      corpses,
    },
    renderChunks: {
      total: renderChunks.length,
      renderable: renderChunks.filter(chunk => chunk.renderable !== false).length,
      displayObjects: renderChunks.reduce((sum, chunk) => sum + (chunk.displayObjects?.length ?? 0), 0),
    },
    terrainChunks: {
      total: terrainChunks?.size ?? 0,
      mounted: mountedTerrainChunks,
      visible: terrainChunkClock == null ? (context.map.visibleRenderChunkCount ?? 0) : visibleTerrainChunks,
      visualCells: terrainVisualCells,
    },
    equipmentAtlases: getLazyEquipmentLoadStats(),
    tasks: context.scheduler?._tasks?.size ?? 0,
  }
}

function formatEntityCounts(label: string, counts: SceneEntityCounts): string {
  return `${label} ${counts.total} total | ${counts.camera} camera | ${counts.visible} visible | ${counts.renderable} renderable`
}

function formatSceneBreakdown(scene: SceneBreakdown): string[] {
  return [
    'Scene breakdown',
    `cells ${scene.cells.total} total | ${scene.cells.cameraCandidates} camera candidates`,
    formatEntityCounts('units', scene.entities.units),
    formatEntityCounts('buildings', scene.entities.buildings),
    formatEntityCounts('resources', scene.entities.resources),
    formatEntityCounts('animals', scene.entities.animals),
    formatEntityCounts('corpses', scene.entities.corpses),
    `terrain chunks ${scene.terrainChunks.total} total | ${scene.terrainChunks.visible} visible | ${scene.terrainChunks.mounted} mounted | ${scene.terrainChunks.visualCells} visual cells`,
    `render chunks ${scene.renderChunks.total} total | ${scene.renderChunks.renderable} renderable | ${scene.renderChunks.displayObjects} display objects`,
    `equipment atlases ${scene.equipmentAtlases.loaded}/${scene.equipmentAtlases.total} loaded | ${scene.equipmentAtlases.pending} pending`,
    `scheduler tasks ${scene.tasks}`,
  ]
}

export function toggleUnitMovementDebug(value = ''): CommandResult {
  const enabled = normalizeToggle(value, isMovementDebugEnabled())
  setMovementDebugEnabled(enabled)
  return {
    ok: true,
    message: `Unit movement debug ${enabled ? 'enabled' : 'disabled'} (${enabled ? 'logs to console and hero-collision overlay' : 'off'})`,
  }
}

function perfReportMetricGroup(report: DevPerformanceSnapshot, title: string, prefix: string, limit: number): string[] {
  const metrics = Object.entries(report.metrics)
    .filter(([name]) => name.startsWith(prefix))
    .sort(([, a], [, b]) => b.totalMs - a.totalMs)
    .slice(0, limit)
  if (!metrics.length) return []

  const lines = [title]
  for (const [name, metric] of metrics as [string, DevPerformanceMetric][]) {
    lines.push(
      `${name}: total ${metric.totalMs.toFixed(2)}ms | exclusive ${metric.exclusiveMs?.toFixed(2) ?? '0.00'}ms | max ${metric.maxMs.toFixed(2)}ms | calls ${metric.count}`
    )
  }
  return lines
}

function perfReportSlowFrames(report: DevPerformanceSnapshot, limit: number): string[] {
  const slowFrames = report.slowFrames || []
  if (!slowFrames.length) return []
  const lines = ['Slow frames']
  for (const frame of slowFrames.slice(-limit).reverse()) {
    const phaseLabel = `${frame.phase} #${frame.phaseFrame}${frame.mixedPhases ? ' mixed' : ''}`
    lines.push(
      `${frame.duration.toFixed(2)}ms | exclusive ${frame.exclusiveMeasuredMs.toFixed(2)}ms | untracked ${frame.untrackedMs.toFixed(2)}ms | inclusive ${frame.measuredMs.toFixed(2)}ms | phase ${phaseLabel}`
    )
    if (!frame.metrics.length) {
      lines.push('  no measured metrics on this interval')
      continue
    }
    for (const metric of frame.metrics.slice(0, 4)) {
      lines.push(
        `  ${metric.name}: exclusive ${metric.exclusiveMs.toFixed(2)}ms | total ${metric.totalMs.toFixed(2)}ms | calls ${metric.count}`
      )
    }
  }
  return lines
}

function perfReportRenderStats(report: DevPerformanceSnapshot, limit: number): string[] {
  const stats = report.renderStats || []
  if (!stats.length) return []
  const lines = ['Recent renders']
  for (const stat of stats.slice(-limit).reverse()) {
    lines.push(
      `${stat.duration.toFixed(2)}ms | nodes ${stat.nodes} | visible ${stat.visible} | renderable ${stat.renderable} | depth ${stat.maxDepth}`
    )
  }
  return lines
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
  const aiPlayers = context.players.filter(isAiDebugPlayer)
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
