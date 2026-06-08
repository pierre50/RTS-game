import { POPULATION_MAX } from '../../constants'
import { capitalizeFirstLetter } from '../../lib'
import { GAME_SPEED_USAGE, isGameSpeedPreset } from '../../lib/settings'
import { RESOURCE_NAMES, findKey } from './shared'

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
  ;[...player.units].forEach(u => {
    u.hitPoints = u.totalHitPoints
  })
  ;[...player.buildings].forEach(b => {
    b.hitPoints = b.totalHitPoints
  })
  const count = player.units.length + player.buildings.length
  return { ok: true, message: `Healed ${count} entities to full HP` }
}

export function setGameSpeed(context, value = 1) {
  const speed = Number(value)
  if (!Number.isFinite(speed) || !isGameSpeedPreset(speed)) {
    return { ok: false, message: `Usage: ${GAME_SPEED_USAGE}` }
  }
  context.app.ticker.speed = speed
  if (context.scheduler) {
    context.scheduler.timeScale = speed
  }
  return { ok: true, message: `Speed: ${speed}x` }
}

export function toggleInstantMode(context, value) {
  const { map } = context
  const enabled = value === 'on' ? true : value === 'off' ? false : !map.instantMode
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
