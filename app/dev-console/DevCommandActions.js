import { Container, Graphics, Text } from 'pixi.js'
import { CELL_HEIGHT, CELL_WIDTH, FAMILY_TYPES, POPULATION_MAX } from '../constants'
import { capitalizeFirstLetter, canPlaceBuildingAt, drawInstanceBlinkingSelection } from '../lib'

const RESOURCE_NAMES = ['wood', 'food', 'stone', 'gold']
const DEBUG_SOLID_LAYER = 'debugSolidLayer'
const DEBUG_PATH_LAYER = 'debugPathLayer'
const DEBUG_VISION_LAYER = 'debugVisionLayer'
const DEBUG_GRID_LAYER = 'debugGridLayer'
const DEBUG_COORDS_LAYER = 'debugCoordsLayer'
const DEBUG_OVERLAY_Z = 1e9 + 100
const DEBUG_CELL_REFRESH_MS = 180

function normalizeToggle(value, currently) {
  return value === 'on' ? true : value === 'off' ? false : !currently
}

function normalize(value) {
  return String(value || '').toLowerCase()
}

function findKey(source, value) {
  const wanted = normalize(value)
  return Object.keys(source).find(key => normalize(key) === wanted)
}

function getAmount(value, fallback = 1) {
  const amount = Number(value ?? fallback)
  return Number.isFinite(amount) && amount > 0 ? Math.floor(amount) : fallback
}

function getSpawnCell(context, buildingConfig = null) {
  const { map, controls } = context
  const cursorCell = controls.getCellUnderCursor()
  if (!cursorCell) return null
  if (!buildingConfig && !cursorCell.solid && !cursorCell.has) return cursorCell
  if (buildingConfig && canPlaceBuildingAt(map.grid, cursorCell.i, cursorCell.j, buildingConfig)) return cursorCell

  const maxRadius = 8
  for (let radius = 1; radius <= maxRadius; radius++) {
    for (let di = -radius; di <= radius; di++) {
      for (let dj = -radius; dj <= radius; dj++) {
        if (Math.abs(di) !== radius && Math.abs(dj) !== radius) continue
        const cell = map.grid[cursorCell.i + di]?.[cursorCell.j + dj]
        if (!cell) continue
        if (buildingConfig) {
          if (canPlaceBuildingAt(map.grid, cell.i, cell.j, buildingConfig)) return cell
        } else if (!cell.solid && !cell.has) {
          return cell
        }
      }
    }
  }
  return null
}

function getDebugLayer(map, label, zIndex) {
  let layer = map.getChildByLabel?.(label)
  if (!layer) {
    layer = new Graphics()
    layer.label = label
    layer.eventMode = 'none'
    layer.zIndex = zIndex
    map.addChild(layer)
  }
  return layer
}

function getDebugContainer(map, label, zIndex) {
  let layer = map.getChildByLabel?.(label)
  if (!layer) {
    layer = new Container()
    layer.label = label
    layer.eventMode = 'none'
    layer.zIndex = zIndex
    map.addChild(layer)
  }
  return layer
}

function getCameraCells(context) {
  const { controls, map } = context
  const cells = controls?.cameraController?.visibleCells
  if (cells?.size) return cells
  return new Set([map.grid[Math.floor(map.size / 2)]?.[Math.floor(map.size / 2)]].filter(Boolean))
}

function drawCellDiamond(graphics, cell, color, alpha = 0.28) {
  graphics.poly([
    cell.x - CELL_WIDTH / 2,
    cell.y,
    cell.x,
    cell.y - CELL_HEIGHT / 2,
    cell.x + CELL_WIDTH / 2,
    cell.y,
    cell.x,
    cell.y + CELL_HEIGHT / 2,
  ])
  graphics.fill({ color, alpha })
}

function drawCellStroke(graphics, cell, color, alpha = 0.95, width = 1) {
  graphics.poly([
    cell.x - CELL_WIDTH / 2,
    cell.y,
    cell.x,
    cell.y - CELL_HEIGHT / 2,
    cell.x + CELL_WIDTH / 2,
    cell.y,
    cell.x,
    cell.y + CELL_HEIGHT / 2,
  ])
  graphics.closePath()
  graphics.stroke({ color, alpha, width })
}

function getSolidDebugColor(cell) {
  if (cell.has?.family === FAMILY_TYPES.resource) return 0x33d17a
  if (cell.has?.family === FAMILY_TYPES.building) return 0xffb000
  if (cell.has?.family === FAMILY_TYPES.unit) return 0xff4d4d
  if (cell.has?.family === FAMILY_TYPES.animal) return 0xba7cff
  if (cell.category === 'Water') return 0x35a7ff
  if (cell.border) return 0xffffff
  if (cell.inclined) return 0x8f8f8f
  return 0xff4d4d
}

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
    if (!unit.path?.length) return

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

function stopDebugTicker(context, tickerName) {
  const { app, map } = context
  const ticker = map[tickerName]
  if (ticker) {
    app.ticker.remove(ticker)
    map[tickerName] = null
  }
}

function removeDebugLayer(context, layerLabel, tickerName) {
  const { map } = context
  stopDebugTicker(context, tickerName)
  const layer = map.getChildByLabel?.(layerLabel)
  if (layer) {
    map.removeChild(layer)
    layer.destroy()
  }
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

function addDebugTicker(context, tickerName, draw) {
  const { app, map } = context
  stopDebugTicker(context, tickerName)
  let elapsed = 0
  map[tickerName] = ticker => {
    elapsed += ticker.elapsedMS
    if (elapsed < DEBUG_CELL_REFRESH_MS) return
    elapsed = 0
    draw(context)
  }
  app.ticker.add(map[tickerName])
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

function getInstancesByCategory(context, category, typeName) {
  const { map, player, players } = context
  const wantedType = normalize(typeName)
  const matchesType = instance => !wantedType || normalize(instance.type) === wantedType

  switch (category) {
    case 'unit':
    case 'units':
      return player.units.filter(matchesType)
    case 'building':
    case 'buildings':
      return player.buildings.filter(matchesType)
    case 'resource':
    case 'resources':
      return [...map.resources].filter(matchesType)
    case 'enemy':
    case 'enemies':
      return players
        .filter(p => player.isEnemy(p))
        .flatMap(p => [...p.units, ...p.buildings])
        .filter(matchesType)
    default:
      return null
  }
}

export function addResources(player, resourceName, amount) {
  if (resourceName === 'all') {
    RESOURCE_NAMES.forEach(name => {
      player[name] += amount
    })
    return `Added ${amount} to all resources`
  }
  if (!RESOURCE_NAMES.includes(resourceName)) {
    return `Unknown resource: ${resourceName}`
  }
  player[resourceName] += amount
  return `Added ${amount} ${resourceName}`
}

export function spawnUnits(context, typeName, count = 1) {
  const { player, menu } = context
  const type = findKey(player.config.units, typeName)
  if (!type) return { ok: false, message: `Unknown unit: ${typeName}` }

  let spawned = 0
  for (let i = 0; i < getAmount(count); i++) {
    const cell = getSpawnCell(context)
    if (!cell) break
    player.createUnit({ i: cell.i, j: cell.j, type })
    player.population++
    spawned++
  }
  if (!spawned) return { ok: false, message: 'No free cell near cursor' }
  menu.updateTopbar()
  menu.updatePlayerMiniMapEvt(player)
  return { ok: true, message: `Spawned ${spawned} ${type}` }
}

export function spawnBuilding(context, typeName) {
  const { player, menu } = context
  const type = findKey(player.config.buildings, typeName)
  if (!type) return { ok: false, message: `Unknown building: ${typeName}` }

  const cell = getSpawnCell(context, player.config.buildings[type])
  if (!cell) return { ok: false, message: 'No buildable cell near cursor' }

  const building = player.createBuilding({ i: cell.i, j: cell.j, type, isBuilt: true })
  if (!player.hasBuilt.includes(type)) player.hasBuilt.push(type)
  building.updateTexture()
  menu.updateTopbar()
  menu.updatePlayerMiniMapEvt(player)
  return { ok: true, message: `Spawned ${type}` }
}

export function applyTechnology(context, typeName) {
  const { player, menu } = context
  const type = findKey(player.techs, typeName)
  if (!type) return { ok: false, message: `Unknown technology: ${typeName}` }
  if (player.technologies.includes(type)) return { ok: true, message: `${type} already unlocked` }

  const config = player.techs[type]
  if (Array.isArray(player[config.key])) {
    player[config.key].push(config.value || type)
  } else {
    player[config.key] = config.value || type
  }

  if (config.action) {
    switch (config.action.type) {
      case 'upgradeUnit':
        player.units.forEach(unit => {
          if (unit.type === config.action.source) unit.upgrade(config.action.target)
        })
        break
      case 'upgradeBuilding':
        player.buildings.forEach(building => {
          if (building.type === config.action.source) building.upgrade(config.action.target)
        })
        break
      case 'improve':
        player.updateConfig(
          config.action.operations.map(operation => ({
            ...operation,
            value: Number(operation.value),
          }))
        )
        break
    }
  }

  const handler = `on${capitalizeFirstLetter(config.key)}Change`
  typeof player[handler] === 'function' && player[handler](config.value)
  menu.updateBottombar()
  menu.updateTopbar()
  return { ok: true, message: `Unlocked ${type}` }
}

export function setAge(context, value) {
  const age = Number(value)
  if (!Number.isInteger(age) || age < 0 || age > 3) return { ok: false, message: 'Age must be between 0 and 3' }
  context.player.age = age
  context.player.onAgeChange()
  context.menu.updateBottombar()
  context.menu.updateTopbar()
  return { ok: true, message: `Age set to ${age}` }
}

export function setCiv(context, value) {
  const civ = value ? capitalizeFirstLetter(value.toLowerCase()) : ''
  if (!civ) return { ok: false, message: 'Usage: civ <name>' }
  context.player.civ = civ
  context.player.onAgeChange()
  context.menu.updateBottombar()
  return { ok: true, message: `Civilization set to ${civ}` }
}

export function killEntities(context, target = 'enemies') {
  const { player } = context

  if (target === 'enemies') {
    const enemies = player.enemyPlayers()
    let count = 0
    enemies.forEach(enemy => {
      count += enemy.units.length + enemy.buildings.length
      ;[...enemy.units].forEach(u => u.die())
      ;[...enemy.buildings].forEach(b => b.die())
    })
    if (!count) return { ok: false, message: 'No enemies found' }
    return { ok: true, message: `Killed ${count} enemy entities` }
  }

  if (target === 'all') {
    const count = player.units.length + player.buildings.length
    ;[...player.units].forEach(u => u.die())
    ;[...player.buildings].forEach(b => b.die())
    return { ok: true, message: `Killed ${count} of your entities` }
  }

  return { ok: false, message: 'Usage: kill [enemies|all]' }
}

export function healAll(context) {
  const { player } = context
  ;[...player.units].forEach(u => { u.hitPoints = u.totalHitPoints })
  ;[...player.buildings].forEach(b => { b.hitPoints = b.totalHitPoints })
  const count = player.units.length + player.buildings.length
  return { ok: true, message: `Healed ${count} entities to full HP` }
}

export function toggleFog(context, value) {
  const { map, menu, players } = context
  const currently = map.fogLayer?.visible ?? !map.revealEverything
  const showFog = normalizeToggle(value, currently)
  map.revealEverything = !showFog
  if (map.fogLayer) map.fogLayer.visible = showFog

  if (!showFog) menu.revealTerrainMinimap()
  menu.updateResourcesMiniMapEvt()
  players.forEach(p => menu.updatePlayerMiniMapEvt(p))

  return { ok: true, message: `Fog of war: ${showFog ? 'on' : 'off'}` }
}

export function toggleResourcesVisibility(context, value) {
  const { map, menu } = context
  const currently = map.showResources ?? true
  const showResources = normalizeToggle(value, currently)

  map.showResources = showResources
  map.resources.forEach(resource => {
    const cell = map.grid[resource.i]?.[resource.j]
    if (showResources) {
      cell?.updateVisible()
    } else {
      resource.visible = false
    }
  })
  menu.updateResourcesMiniMapEvt()

  return { ok: true, message: `Resources: ${showResources ? 'on' : 'off'}` }
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

export function setGameSpeed(context, value = 1) {
  const speed = Number(value)
  if (!Number.isFinite(speed) || speed <= 0 || speed > 8) {
    return { ok: false, message: 'Usage: speed <0.25|0.5|1|2|4|8>' }
  }
  context.scheduler.timeScale = speed
  return { ok: true, message: `Speed: ${speed}x` }
}

export function toggleTerrainReveal(context, value) {
  const { map, menu } = context
  const revealTerrain = normalizeToggle(value, Boolean(map.revealTerrain))
  map.revealTerrain = revealTerrain
  if (revealTerrain) {
    menu.revealTerrainMinimap()
  } else {
    menu.updateResourcesMiniMapEvt()
  }
  return { ok: true, message: `Reveal terrain: ${revealTerrain ? 'on' : 'off'}` }
}

export function highlightInstances(context, category, typeName = '') {
  if (!category) return { ok: false, message: 'Usage: highlight <units|buildings|resources|enemies> [type]' }
  const instances = getInstancesByCategory(context, normalize(category), typeName)
  if (!instances) return { ok: false, message: 'Usage: highlight <units|buildings|resources|enemies> [type]' }
  instances.forEach(instance => drawInstanceBlinkingSelection(instance))
  return { ok: true, message: `Highlighted ${instances.length} ${category}${typeName ? ` ${typeName}` : ''}` }
}

export function killResources(context, typeName = 'all') {
  const { map, menu } = context
  const wantedType = normalize(typeName)
  const resources = [...map.resources].filter(resource => wantedType === 'all' || normalize(resource.type) === wantedType)
  resources.forEach(resource => resource.die(true))
  menu.updateResourcesMiniMapEvt()
  return { ok: true, message: `Killed ${resources.length} resources${typeName !== 'all' ? ` ${typeName}` : ''}` }
}

export function toggleInstantMode(context, value) {
  const { map } = context
  const enabled = normalizeToggle(value, map.instantMode)
  map.instantMode = enabled
  return { ok: true, message: `Instant build/train/tech: ${enabled ? 'on' : 'off'}` }
}

export function setPopMax(context, value) {
  const { player, menu } = context
  const amount = value != null ? parseInt(value) : POPULATION_MAX
  if (!Number.isFinite(amount) || amount < 0) return { ok: false, message: 'Usage: popmax [amount]' }
  player.population_max = amount
  menu.updateTopbar()
  return { ok: true, message: `Population max: ${amount}` }
}
