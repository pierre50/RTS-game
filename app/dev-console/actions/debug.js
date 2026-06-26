import { Text } from 'pixi.js'
import { ACTION_TYPES, PLAYER_TYPES, UNIT_TYPES } from '../../constants'
import { classifyMilitaryUnits, isAliveUnit } from '../../ai/unitGroups'
import {
  DEBUG_COORDS_LAYER,
  DEBUG_GRID_LAYER,
  DEBUG_OVERLAY_Z,
  DEBUG_PATH_LAYER,
  DEBUG_SOLID_LAYER,
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

function drawSolidDebug(context) {
  const { map } = context
  const layer = getDebugLayer(map, DEBUG_SOLID_LAYER, DEBUG_OVERLAY_Z + 1)
  layer.clear()

  for (const cell of getCameraCells(context)) {
    if (!cell || (!cell.solid && !cell.border && !cell.inclined)) continue
    drawCellDiamond(layer, cell, getSolidDebugColor(cell))
  }
}

function drawPathDebug(context) {
  const { map, players } = context
  const layer = getDebugLayer(map, DEBUG_PATH_LAYER, DEBUG_OVERLAY_Z + 2)
  layer.clear()

  const allUnits = players.flatMap(p => p.units).filter(u => u.path?.length)
  allUnits.forEach((unit, index) => {
    const color = index % 2 ? 0x35a7ff : 0xfff04a
    const cells = [...unit.path].reverse()
    layer.moveTo(unit.x, unit.y)
    cells.forEach(cell => {
      layer.lineTo(cell.x, cell.y)
    })
    layer.stroke({ color, alpha: 0.95, width: 3 })

    cells.forEach(cell => drawCellDiamond(layer, cell, color, 0.18))
  })
}

function drawGridDebug(context) {
  const { map } = context
  const layer = getDebugLayer(map, DEBUG_GRID_LAYER, DEBUG_OVERLAY_Z + 3)
  layer.clear()

  for (const cell of getCameraCells(context)) {
    if (!cell) continue
    drawCellStroke(layer, cell, 0xffffff, 0.55, 1)
  }
}

function drawCoordsDebug(context) {
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

function drawVisionDebug(context) {
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

function ensureDebugOverlay(id) {
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

function ensurePerfOverlay(context) {
  const overlay = ensureDebugOverlay('debug-perf')
  const { app, map, players } = context
  const units = players.reduce((sum, player) => sum + player.units.length, 0) + (map.gaia?.units.length || 0)
  const buildings = players.reduce((sum, player) => sum + player.buildings.length, 0)
  const schedulerTasks = context.scheduler?._tasks?.size ?? 0
  const speed = context.app?.ticker?.speed ?? context.scheduler?.timeScale ?? 1
  const perf = context.performance?.snapshot()
  const pathfinding = perf?.metrics.pathfinding
  const aiStep = perf?.metrics['ai.step'] || perf?.metrics.aiStep
  const schedulerTick = perf?.metrics['scheduler.tick']
  const unitMove = perf?.metrics['unit.move']
  const visibility = perf?.metrics['visibility.update']
  const camera = perf?.metrics['camera.visibleCells']
  const viewportFog = perf?.metrics['fog.viewport']
  overlay.textContent = [
    `FPS ${Math.round(app.ticker.FPS)}`,
    `Frame avg ${perf?.frames.averageMs.toFixed(2) || '0.00'}ms | p95 ${perf?.frames.p95Ms.toFixed(2) || '0.00'}ms`,
    `Units ${units}`,
    `Buildings ${buildings}`,
    `Resources ${map.resources.size}`,
    `Tasks ${schedulerTasks}`,
    `Speed ${speed}x`,
    `AI ${context.aiPaused ? 'paused' : 'running'}`,
    `Scheduler ${schedulerTick?.averageMs.toFixed(2) || '0.00'}ms avg | ${schedulerTick?.maxMs.toFixed(2) || '0.00'}ms max`,
    `Move ${unitMove?.averageMs.toFixed(2) || '0.00'}ms avg | ${unitMove?.maxMs.toFixed(2) || '0.00'}ms max`,
    `Vision ${visibility?.averageMs.toFixed(2) || '0.00'}ms avg | ${visibility?.maxMs.toFixed(2) || '0.00'}ms max`,
    `Camera ${camera?.averageMs.toFixed(2) || '0.00'}ms avg | ${camera?.maxMs.toFixed(2) || '0.00'}ms max`,
    `Path ${pathfinding?.averageMs.toFixed(2) || '0.00'}ms avg | ${pathfinding?.maxMs.toFixed(2) || '0.00'}ms max`,
    `AI step ${aiStep?.averageMs.toFixed(2) || '0.00'}ms avg | ${aiStep?.maxMs.toFixed(2) || '0.00'}ms max`,
    `Fog ${viewportFog?.averageMs.toFixed(2) || '0.00'}ms avg | ${viewportFog?.maxMs.toFixed(2) || '0.00'}ms max`,
  ].join('\n')
}

export function performanceReport(context, value) {
  if (value === 'reset') {
    context.performance?.reset()
    return { ok: true, message: 'Performance samples reset' }
  }
  const report = context.performance?.snapshot()
  if (!report) return { ok: false, message: 'Performance monitor unavailable' }
  const lines = [
    `Frames ${report.frames.samples} | avg ${report.frames.averageMs.toFixed(2)}ms | p95 ${report.frames.p95Ms.toFixed(2)}ms | p99 ${report.frames.p99Ms.toFixed(2)}ms`,
  ]
  const metrics = Object.entries(report.metrics).sort(([, a], [, b]) => b.totalMs - a.totalMs)
  for (const [name, metric] of metrics) {
    lines.push(
      `${name}: ${metric.count} calls | total ${metric.totalMs.toFixed(2)}ms | avg ${metric.averageMs.toFixed(2)}ms | max ${metric.maxMs.toFixed(2)}ms | slow ${metric.slowCount}`
    )
  }
  return { ok: true, message: lines.join('\n') }
}

function getAiDebugLines(aiPlayers, targetIndex = null) {
  const targets = targetIndex !== null ? [aiPlayers[targetIndex]].filter(Boolean) : aiPlayers
  if (!targets.length) return null

  const lines = []

  for (const ai of targets) {
    const idx = aiPlayers.indexOf(ai)
    const villagers = ai.getLivingUnitsByType(UNIT_TYPES.villager)
    const { infantry, archers, cavalry, hoplites } = classifyMilitaryUnits(ai.units.filter(u => isAliveUnit(u)))
    const military = [...infantry, ...archers, ...cavalry, ...hoplites]
    const militaryPower = Math.round(ai.strategy.military.getGroupCombatPower(military))
    const desiredPower = Math.round(ai.strategy.military.getDesiredAttackPower())
    const threats = ai.getActiveThreats()
    const enemyUnits = ai.enemyUnitMemory.size
    const enemyBuildings = ai.enemyBuildingMemory.size
    const maxVil = Math.floor(ai.maxVillagerPerAge[ai.age] * ai.difficultyConfig.popCapMultiplier)
    const maxInf = ai.maxInfantryByAge[ai.age]
    const maxArc = ai.maxArcherByAge[ai.age]
    const maxCav = ai.maxCavalryByAge[ai.age]
    const maxHop = ai.maxHopliteByAge[ai.age]
    const cooldownLeft = Math.max(
      0,
      Math.round((ai.lastAttackWaveAt + ai.difficultyConfig.attackCooldownMs - ai.getNow()) / 1000)
    )
    const workerSnapshot = ai.economy.getWorkerSnapshot(villagers)
    const workerTargets = ai.economy.getResourceTargets(villagers.length)
    const demand = ai.strategy.getEconomicDemand()
    const builders = villagers.filter(v => !v.isDead && v.hitPoints > 0 && v.action === ACTION_TYPES.build).length
    const scoutLabel = ai.scout && !ai.scout.isDead ? `${ai.scout.type}#${ai.scout.name || ai.scout.label}` : 'none'
    const scoutStatus =
      ai.scout && !ai.scout.isDead ? (ai.scout.inactif ? 'idle' : ai.scout.dest ? 'moving' : 'active') : 'none'

    lines.push(`AI [${idx}] ${ai.label} (${ai.difficulty})`)
    lines.push(`Phase ${ai.phase} | Age ${ai.age} | Pop ${ai.population}/${ai.population_max} | Step ${ai.stepDelay}ms`)
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
      `Army inf ${infantry.length}/${maxInf} | arc ${archers.length}/${maxArc} | cav ${cavalry.length}/${maxCav} | hop ${hoplites.length}/${maxHop}`
    )
    lines.push(
      `Power ${militaryPower}/${desiredPower} | Attack ${cooldownLeft > 0 ? `${cooldownLeft}s` : 'ready'} | Threshold ${ai.difficultyConfig.attackThreshold}`
    )
    lines.push(
      `Intel mem u:${enemyUnits} b:${enemyBuildings} | known trees:${ai.foundedTrees.size} berries:${ai.foundedBerrybushs.size} hunt:${ai.foundedAnimals.size} fish:${ai.foundedFish.size} gold:${ai.foundedGolds.size} stone:${ai.foundedStones.size}`
    )
    lines.push(`Threats ${threats.length}${threats.length ? ` | ${threats.map(t => t.target.type).join(', ')}` : ''}`)
    lines.push('')
  }

  lines.pop()
  return lines
}

function ensureAiInfoOverlay(context) {
  const overlay = ensureDebugOverlay('debug-ai-info')
  const aiPlayers = context.players.filter(p => p.type === PLAYER_TYPES.ai)

  if (!aiPlayers.length) {
    overlay.textContent = 'No AI players on the map'
    return
  }

  const targetIndex = Number.isInteger(context.debugAiInfoTargetIndex) ? context.debugAiInfoTargetIndex : null
  const lines = getAiDebugLines(aiPlayers, targetIndex)
  overlay.textContent = lines?.join('\n') || `No AI player at index ${targetIndex}`
}

export function toggleSolidDebug(context, value) {
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

export function togglePathDebug(context, value) {
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
  app.ticker.add(map._debugPathTicker)
  return { ok: true, message: 'Path debug: on' }
}

export function toggleVisionDebug(context, value) {
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

export function toggleGridDebug(context, value) {
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

export function toggleCoordsDebug(context, value) {
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

export function togglePerfDebug(context, value) {
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
  app.ticker.add(map._debugPerfTicker)
  return { ok: true, message: 'Perf debug: on' }
}

export function toggleAiDebug(context, value) {
  const pauseAI = value === 'pause' ? true : value === 'resume' ? false : !context.aiPaused
  context.aiPaused = pauseAI
  return { ok: true, message: `AI: ${pauseAI ? 'paused' : 'running'}` }
}

export function aiInfo(context, value) {
  const aiPlayers = context.players.filter(p => p.type === PLAYER_TYPES.ai)
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
  context.app.ticker.add(context.map._debugAiInfoTicker)

  return {
    ok: true,
    message: `AI info: on${parsedIndex !== null ? ` (AI ${parsedIndex})` : ' (all AI)'}`,
  }
}
