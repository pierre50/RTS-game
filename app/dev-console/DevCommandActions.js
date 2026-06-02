import { capitalizeFirstLetter, canPlaceBuildingAt } from '../lib'

const RESOURCE_NAMES = ['wood', 'food', 'stone', 'gold']

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
