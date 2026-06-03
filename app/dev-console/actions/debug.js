import { Text } from 'pixi.js'
import { PLAYER_TYPES, UNIT_TYPES, BUILDING_TYPES } from '../../constants'
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
    const view = player.views[cell.i]?.[cell.j]
    if (!cell || !view) continue
    if (view.viewBy?.size) {
      drawCellDiamond(layer, cell, 0x54ff7a, 0.38)
    } else if (view.viewed) {
      drawCellDiamond(layer, cell, 0x5da9ff, 0.24)
    }
  }
}

function ensurePerfOverlay(context) {
  let overlay = document.getElementById('debug-perf')
  if (!overlay) {
    overlay = document.createElement('div')
    overlay.id = 'debug-perf'
    document.body.appendChild(overlay)
  }
  const { app, map, players } = context
  const units = players.reduce((sum, player) => sum + player.units.length, 0) + (map.gaia?.units.length || 0)
  const buildings = players.reduce((sum, player) => sum + player.buildings.length, 0)
  const schedulerTasks = context.scheduler?._tasks?.size ?? 0
  overlay.textContent = [
    `FPS ${Math.round(app.ticker.FPS)}`,
    `Units ${units}`,
    `Buildings ${buildings}`,
    `Resources ${map.resources.size}`,
    `Tasks ${schedulerTasks}`,
    `Speed ${context.scheduler?.timeScale ?? 1}x`,
    `AI ${context.aiPaused ? 'paused' : 'running'}`,
  ].join('\n')
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

export function aiInfo(context, targetIndex) {
  const aiPlayers = context.players.filter(p => p.type === PLAYER_TYPES.ai)
  if (!aiPlayers.length) return { ok: false, message: 'No AI players on the map' }

  const index = targetIndex !== undefined ? parseInt(targetIndex, 10) : null
  const targets = index !== null && !isNaN(index) ? [aiPlayers[index]].filter(Boolean) : aiPlayers

  if (!targets.length) return { ok: false, message: `No AI player at index ${index}` }

  const lines = []
  for (const ai of targets) {
    const idx = aiPlayers.indexOf(ai)
    const villagers = ai.getLivingUnitsByType(UNIT_TYPES.villager)
    const { infantry, archers, cavalry, hoplites } = classifyMilitaryUnits(ai.units.filter(u => isAliveUnit(u)))
    const military = [...infantry, ...archers, ...cavalry, ...hoplites]
    const militaryPower = Math.round(ai.strategy.military.getGroupCombatPower(military))
    const desiredPower = Math.round(ai.strategy.military.getDesiredAttackPower())

    const towncenters = ai.buildingsByTypes([BUILDING_TYPES.townCenter])
    const barracks = ai.buildingsByTypes([BUILDING_TYPES.barracks])
    const archeryRanges = ai.buildingsByTypes([BUILDING_TYPES.archeryRange])
    const stables = ai.buildingsByTypes([BUILDING_TYPES.stable])
    const houses = ai.buildingsByTypes([BUILDING_TYPES.house])
    const farms = ai.buildingsByTypes([BUILDING_TYPES.farm])
    const storagepits = ai.buildingsByTypes([BUILDING_TYPES.storagePit])
    const granarys = ai.buildingsByTypes([BUILDING_TYPES.granary])

    const threats = ai.getActiveThreats()
    const enemyUnits = ai.enemyUnitMemory.size
    const enemyBuildings = ai.enemyBuildingMemory.size

    const maxVil = Math.floor(ai.maxVillagerPerAge[ai.age] * ai.difficultyConfig.popCapMultiplier)
    const maxInf = ai.maxInfantryByAge[ai.age]
    const maxArc = ai.maxArcherByAge[ai.age]
    const maxCav = ai.maxCavalryByAge[ai.age]

    const cooldownLeft = Math.max(0, Math.round((ai.lastAttackWaveAt + ai.difficultyConfig.attackCooldownMs - ai.getNow()) / 1000))

    lines.push(`── AI [${idx}] ${ai.label} (${ai.difficulty}) ──`)
    lines.push(`  Phase: ${ai.phase}  |  Age: ${ai.age}  |  Pop: ${ai.population}/${ai.population_max}`)
    lines.push(`  Resources  W:${ai.wood} F:${ai.food} S:${ai.stone} G:${ai.gold}`)
    lines.push(`  Villagers  ${villagers.length}/${maxVil}`)
    lines.push(`  Military   inf:${infantry.length}/${maxInf}  arc:${archers.length}/${maxArc}  cav:${cavalry.length}/${maxCav}  hop:${hoplites.length}`)
    lines.push(`  Power      ${militaryPower} / desired ${desiredPower}  (threshold: ${ai.difficultyConfig.attackThreshold})`)
    lines.push(`  Attack cd  ${cooldownLeft > 0 ? cooldownLeft + 's' : 'ready'}`)
    lines.push(`  Buildings  TC:${towncenters.length}  bx:${barracks.length}  ar:${archeryRanges.length}  st:${stables.length}  ho:${houses.length}  fa:${farms.length}  sp:${storagepits.length}  gr:${granarys.length}`)
    lines.push(`  Enemy mem  units:${enemyUnits}  buildings:${enemyBuildings}`)
    lines.push(`  Threats    ${threats.length}${threats.length ? ': ' + threats.map(t => t.target.type).join(', ') : ''}`)
    lines.push(`  Step delay ${ai.stepDelay}ms`)
  }

  return { ok: true, message: lines.join('\n') }
}
