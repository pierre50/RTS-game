import type { CommandResult } from '../DevCommandRegistry'
import type { DevConsoleContext, DevEntity, DevPerformanceMetric, DevPerformanceSnapshot } from '../types'
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
  if (mode === 'display' || mode === 'tree') {
    const limit = Number(rest[0] || 12)
    return { ok: true, message: formatDisplayTreeBreakdown(context, Number.isFinite(limit) ? limit : 12).join('\n') }
  }
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
    formatEntityCounts('resources', scene.entities.resources),
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
    const effectiveRenderable = stat.effectiveRenderable ?? stat.renderable
    const effectiveVisible = stat.effectiveVisible ?? stat.visible
    lines.push(
      `${stat.duration.toFixed(2)}ms | nodes ${stat.nodes} | effective ${effectiveRenderable} renderable/${effectiveVisible} visible | flags ${stat.renderable} renderable/${stat.visible} visible | depth ${stat.maxDepth}`
    )
  }
  return lines
}

type DisplayTreeNode = {
  children?: unknown[]
  constructor?: { name?: string }
  label?: unknown
  renderable?: boolean
  visible?: boolean
}

type DisplayTreeStats = {
  effectiveRenderable: number
  effectiveVisible: number
  maxDepth: number
  nodes: number
  renderable: number
  visible: number
}

type DisplayTreeGroup = DisplayTreeStats & {
  count: number
  label: string
}

function asDisplayTreeNode(value: unknown): DisplayTreeNode | null {
  if (!value || typeof value !== 'object') return null
  return value as DisplayTreeNode
}

function looksLikeUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}

function displayNodeLabel(node: DisplayTreeNode): string {
  const constructorName = node.constructor?.name || 'Object'
  const label = typeof node.label === 'string' ? node.label.trim() : ''
  if (label && !looksLikeUuid(label)) return `${label} (${constructorName})`
  return constructorName
}

function collectDisplayTreeStats(root: unknown): DisplayTreeStats | null {
  const rootNode = asDisplayTreeNode(root)
  if (!rootNode) return null
  const stack: Array<{ depth: number; node: DisplayTreeNode; parentRenderable: boolean; parentVisible: boolean }> = [
    { node: rootNode, depth: 0, parentRenderable: true, parentVisible: true },
  ]
  const stats: DisplayTreeStats = {
    effectiveRenderable: 0,
    effectiveVisible: 0,
    maxDepth: 0,
    nodes: 0,
    renderable: 0,
    visible: 0,
  }

  while (stack.length) {
    const { depth, node, parentRenderable, parentVisible } = stack.pop()!
    const nodeVisible = node.visible !== false
    const nodeRenderable = node.renderable !== false
    const nodeEffectiveVisible = parentVisible && nodeVisible
    const nodeEffectiveRenderable = parentRenderable && nodeVisible && nodeRenderable
    stats.nodes++
    if (nodeVisible) stats.visible++
    if (nodeRenderable) stats.renderable++
    if (nodeEffectiveVisible) stats.effectiveVisible++
    if (nodeEffectiveRenderable) stats.effectiveRenderable++
    stats.maxDepth = Math.max(stats.maxDepth, depth)

    const children = node.children
    if (!children?.length) continue
    for (let index = children.length - 1; index >= 0; index--) {
      const child = asDisplayTreeNode(children[index])
      if (!child) continue
      stack.push({
        node: child,
        depth: depth + 1,
        parentRenderable: nodeEffectiveRenderable,
        parentVisible: nodeEffectiveVisible,
      })
    }
  }

  return stats
}

function mergeDisplayTreeStats(target: DisplayTreeGroup, stats: DisplayTreeStats): void {
  target.effectiveRenderable += stats.effectiveRenderable
  target.effectiveVisible += stats.effectiveVisible
  target.maxDepth = Math.max(target.maxDepth, stats.maxDepth)
  target.nodes += stats.nodes
  target.renderable += stats.renderable
  target.visible += stats.visible
}

function formatDisplayTreeStats(stats: DisplayTreeStats): string {
  return `nodes ${stats.nodes} | effective ${stats.effectiveRenderable} renderable/${stats.effectiveVisible} visible | flags ${stats.renderable} renderable/${stats.visible} visible | depth ${stats.maxDepth}`
}

function formatDisplayTreeSection(title: string, root: unknown, limit: number): string[] {
  const rootNode = asDisplayTreeNode(root)
  const rootStats = collectDisplayTreeStats(root)
  if (!rootNode || !rootStats) return [`${title}: unavailable`]

  const lines = [`${title}: ${formatDisplayTreeStats(rootStats)}`]
  const groups = new Map<string, DisplayTreeGroup>()
  for (const childValue of rootNode.children ?? []) {
    const child = asDisplayTreeNode(childValue)
    if (!child) continue
    const stats = collectDisplayTreeStats(child)
    if (!stats) continue
    const label = displayNodeLabel(child)
    let group = groups.get(label)
    if (!group) {
      group = { count: 0, effectiveRenderable: 0, effectiveVisible: 0, label, maxDepth: 0, nodes: 0, renderable: 0, visible: 0 }
      groups.set(label, group)
    }
    group.count++
    mergeDisplayTreeStats(group, stats)
  }

  const sortedGroups = [...groups.values()]
    .sort((a, b) => b.effectiveRenderable - a.effectiveRenderable || b.nodes - a.nodes)
    .slice(0, Math.max(1, limit))
  if (sortedGroups.length) lines.push(`${title} children`)
  for (const group of sortedGroups) {
    lines.push(`  ${group.label} x${group.count}: ${formatDisplayTreeStats(group)}`)
  }
  return lines
}

function formatDisplayTreeBreakdown(context: DevConsoleContext, limit: number): string[] {
  return [
    'Display tree',
    ...formatDisplayTreeSection('stage', context.app?.stage, limit),
    ...formatDisplayTreeSection('map', context.map, limit),
  ]
}
