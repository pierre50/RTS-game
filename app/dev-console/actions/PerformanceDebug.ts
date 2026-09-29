import { getLazyEquipmentLoadStats } from '../../lib/lpc/lazyEquipmentAssets'
import { getGaiaAnimals } from '../../lib/playerState'
import type { CommandResult } from '../DevCommandRegistry'
import type {
  DevConsoleContext,
  DevEntity,
  DevPerformanceEvent,
  DevPerformanceMetric,
  DevPerformanceSnapshot,
} from '../types'
import { formatDisplayTreeBreakdown } from './PerformanceDisplayTree'

export function performanceReport(context: DevConsoleContext, value = ''): CommandResult {
  const [mode = '', ...rest] = value.trim().split(/\s+/).filter(Boolean)
  if (mode === 'reset') {
    context.performance?.reset?.()
    return { ok: true, message: 'Performance samples reset' }
  }
  const report = context.performance?.snapshot?.()
  if (!report) return { ok: false, message: 'Performance monitor unavailable' }
  if (mode === 'display' || mode === 'tree') {
    const limit = Number(rest[0] || 12)
    return { ok: true, message: formatDisplayTreeBreakdown(context, Number.isFinite(limit) ? limit : 12).join('\n') }
  }
  if (mode === 'json')
    return { ok: true, message: JSON.stringify({ ...report, scene: createSceneBreakdown(context) }, null, 2) }
  if (mode === 'events')
    return {
      ok: true,
      message: [
        'Recent diagnostic events (bounded history)',
        ...(report.events ?? []).slice(-40).map(event => formatEvent(event)),
      ].join('\n'),
    }
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
      `estimated calls ${metric.count ?? 0} | estimated total ${metric.totalMs.toFixed(2)}ms | avg/call ${metric.averageMs.toFixed(3)}ms`,
      `estimated exclusive ${metric.exclusiveMs?.toFixed(2) ?? '0.00'}ms | exclusive avg ${metric.averageExclusiveMs?.toFixed(3) ?? '0.000'}ms | max exclusive ${metric.maxExclusiveMs?.toFixed(2) ?? '0.00'}ms`,
      `measured ${metric.measuredCount ?? 0} | measured avg ${metric.measuredAverageMs?.toFixed(3) ?? '0.000'}ms | measured exclusive avg ${metric.measuredAverageExclusiveMs?.toFixed(3) ?? '0.000'}ms | max call ${metric.maxMs.toFixed(2)}ms | last ${metric.lastMs?.toFixed(2) ?? '0.00'}ms`,
      `measured frames ${metric.frames ?? 0} | avg/frame ${metric.averageFrameMs?.toFixed(2) ?? '0.00'}ms | avg exclusive/frame ${metric.averageFrameExclusiveMs?.toFixed(2) ?? '0.00'}ms | max/frame ${metric.maxFrameMs?.toFixed(2) ?? '0.00'}ms | measured max exclusive/frame ${metric.maxFrameExclusiveMs?.toFixed(2) ?? '0.00'}ms | max calls/frame ${metric.maxFrameCalls ?? 0}`,
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
  const scene = createSceneBreakdown(context)
  if (mode === 'scene') return { ok: true, message: formatSceneBreakdown(scene).join('\n') }
  const lines = [
    `Frame interval ${report.frames.samples} samples | avg ${report.frames.averageMs.toFixed(2)}ms | p95 ${report.frames.p95Ms.toFixed(2)}ms | p99 ${report.frames.p99Ms.toFixed(2)}ms | slow in window ${report.frames.windowSlowCount ?? 'n/a'} | slow since reset ${report.frames.slowCount ?? 0} | window FPS ${report.frames.averageMs > 0 ? (1000 / report.frames.averageMs).toFixed(1) : 'n/a'} | speed ${report.frames.speed}x`,
  ]
  lines.push(
    'CPU timings only; sampled totals/calls are estimates, frame peaks use measured samples. Nested inclusive timings and load spans overlap; do not add them. Unattributed interval includes browser/GPU waiting and unmeasured work.'
  )
  lines.push(...perfReportSlowFrames(report, 3))
  lines.push(...perfReportMetricGroup(report, 'AI stage timings', 'runtime.ai.', 16))
  lines.push('Recent diagnostic events (timestamps share the slow-frame clock)')
  lines.push(...(report.events ?? []).slice(-12).map(event => formatEvent(event)))
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
      `${name}: ${metric.measuredCount ?? metric.count} measured samples | estimated calls ${metric.count} | estimated total ${metric.totalMs.toFixed(2)}ms | estimated exclusive ${metric.exclusiveMs?.toFixed(2) ?? '0.00'}ms | avg ${metric.averageMs.toFixed(3)}ms | max call ${metric.maxMs.toFixed(2)}ms | measured max exclusive/frame ${metric.maxFrameExclusiveMs?.toFixed(2) ?? '0.00'}ms | samples/frame max ${metric.maxFrameCalls ?? 0} | slow ${metric.slowCount}`
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
    cameraExited: number
    cameraMargin: number
    cameraSamples: number
    cameraStepX: number
    cameraStepY: number
    cameraUpdated: number
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
  // Reading sprite can create a lazy visual. Only inspect existing entity flags.
  return entity.visible === true
}

function isEntityRenderable(entity: DevEntity): boolean {
  return isEntityVisible(entity) && entity.renderable !== false
}

function countEntity(
  counts: SceneEntityCounts,
  context: DevConsoleContext,
  visibleCells: Set<DevEntity['currentCell']>,
  entity: DevEntity | undefined
): void {
  if (!entity || entity.isDestroyed) return

  counts.total += 1
  const cell = entity.currentCell
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

  const seenAnimals = new Set<DevEntity>()
  const countAnimal = (animal: DevEntity) => {
    if (seenAnimals.has(animal)) return
    seenAnimals.add(animal)
    countEntity(animals, context, visibleCells, animal)
  }
  for (const player of context.players) {
    player.units.forEach(unit => countEntity(units, context, visibleCells, unit as DevEntity))
    player.buildings.forEach(building => countEntity(buildings, context, visibleCells, building as DevEntity))
    player.corpses?.forEach(corpse => countEntity(corpses, context, visibleCells, corpse as DevEntity))
    player.animals?.forEach(animal => countAnimal(animal as DevEntity))
  }
  getGaiaAnimals(context.map.gaia).forEach(animal => countAnimal(animal as DevEntity))
  const cameraResources = new Set<DevEntity>()
  for (const cell of visibleCells) {
    const resource = cell?.has as DevEntity | undefined
    if (resource?.family !== 'resource' || resource.isDestroyed || cameraResources.has(resource)) continue
    cameraResources.add(resource)
    resources.camera++
    if (isEntityVisible(resource)) resources.visible++
    if (isEntityRenderable(resource)) resources.renderable++
  }
  resources.total = context.map.resources.size

  const renderChunks = context.map.renderChunks ?? []
  const terrainChunks = context.map.terrainChunkManager?.chunks
  const terrainChunkClock = context.map.terrainChunkManager?.clock
  const cameraCellsStats = context.controls?.cameraController?.visibleCellsStats
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
      cameraExited: cameraCellsStats?.exited ?? 0,
      cameraMargin: cameraCellsStats?.margin ?? 0,
      cameraSamples: cameraCellsStats?.samples ?? 0,
      cameraStepX: cameraCellsStats?.stepX ?? 0,
      cameraStepY: cameraCellsStats?.stepY ?? 0,
      cameraUpdated: cameraCellsStats?.updated ?? 0,
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
    `cells ${scene.cells.total} total | ${scene.cells.cameraCandidates} camera candidates | ${scene.cells.cameraSamples} camera samples`,
    `camera cells step ${scene.cells.cameraStepX}x${scene.cells.cameraStepY} | margin ${scene.cells.cameraMargin} | updated ${scene.cells.cameraUpdated} | exited ${scene.cells.cameraExited}`,
    formatEntityCounts('units', scene.entities.units),
    formatEntityCounts('buildings', scene.entities.buildings),
    formatEntityCounts('resources', scene.entities.resources) +
      ' (visibility: camera candidates only; entity flags, no sprite creation)',
    formatEntityCounts('animals', scene.entities.animals),
    formatEntityCounts('corpses', scene.entities.corpses),
    `terrain chunks ${scene.terrainChunks.total} total | ${scene.terrainChunks.visible} visible | ${scene.terrainChunks.mounted} mounted | ${scene.terrainChunks.visualCells} visual cells`,
    `render chunks ${scene.renderChunks.total} total | ${scene.renderChunks.renderable} renderable | ${scene.renderChunks.displayObjects} display objects`,
    `equipment atlases ${scene.equipmentAtlases.loaded}/${scene.equipmentAtlases.total} loaded | ${scene.equipmentAtlases.pending} pending`,
    `scheduler tasks ${scene.tasks}`,
  ]
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
      `${name}: elapsed total ${metric.totalMs.toFixed(2)}ms | max span ${metric.maxMs.toFixed(2)}ms | calls ${metric.count}`
    )
  }
  return lines
}

function formatEvent(event: DevPerformanceEvent, frameAt?: number): string {
  const time =
    frameAt == null ? `at ${event.at.toFixed(0)}ms` : `${Math.max(0, frameAt - event.at).toFixed(0)}ms before frame end`
  return `  ${event.name} ${time} | ${Object.entries(event.details)
    .map(([key, value]) => `${key}=${value}`)
    .join(' | ')}`
}

function perfReportSlowFrames(report: DevPerformanceSnapshot, limit: number): string[] {
  const slowFrames = report.slowFrames || []
  if (!slowFrames.length) return []
  const lines = ['Worst slow frames since reset (up to 24 retained)']
  for (const frame of [...slowFrames].sort((a, b) => b.duration - a.duration).slice(0, limit)) {
    const phaseLabel = `${frame.phase} #${frame.phaseFrame}${frame.mixedPhases ? ' mixed' : ''}`
    lines.push(
      `${frame.duration.toFixed(2)}ms at ${frame.at.toFixed(0)}ms | exclusive ${frame.exclusiveMeasuredMs.toFixed(2)}ms | unattributed interval ${frame.untrackedMs.toFixed(2)}ms | inclusive ${frame.measuredMs.toFixed(2)}ms | phase ${phaseLabel}`
    )
    for (const event of frame.events ?? []) lines.push(formatEvent(event, frame.at))
    if (!frame.metrics.length) {
      lines.push('  no measured metrics on this interval')
      continue
    }
    for (const metric of frame.metrics.slice(0, 8)) {
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
  const lines = ['Sampled CPU renders (scene census at most once/second)']
  for (const stat of stats.slice(-limit).reverse()) {
    const effectiveRenderable = stat.effectiveRenderable ?? stat.renderable
    const effectiveVisible = stat.effectiveVisible ?? stat.visible
    lines.push(
      `${stat.duration.toFixed(2)}ms | nodes ${stat.nodes} | effective ${effectiveRenderable} renderable/${effectiveVisible} visible | flags ${stat.renderable} renderable/${stat.visible} visible | depth ${stat.maxDepth}`
    )
  }
  return lines
}
