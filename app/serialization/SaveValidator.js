import { Assets } from 'pixi.js'
import { PLAYER_TYPES } from '../constants'

const MAX_MAP_EDGE = 513

function fail(message) {
  throw new Error(message)
}

function isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value)
}

function validateGridPosition(value, size, label) {
  if (!Number.isInteger(value) || value < 0 || value >= size) {
    fail(`Invalid save file: ${label} is out of bounds.`)
  }
}

function validateArray(value, label) {
  if (!Array.isArray(value)) {
    fail(`Invalid save file: ${label} must be an array.`)
  }
}

function validateCell(cell, i, j) {
  if (!isObject(cell)) fail(`Invalid save file: cell ${i},${j} is invalid.`)
  if (!isFiniteNumber(cell.z)) fail(`Invalid save file: cell ${i},${j} has an invalid height.`)
  if (typeof cell.type !== 'string' || !cell.type) fail(`Invalid save file: cell ${i},${j} has an invalid type.`)
  validateArray(cell.fogSprites ?? [], `cell ${i},${j} fogSprites`)
}

function validateViewCell(cell, i, j) {
  if (!isObject(cell)) fail(`Invalid save file: view cell ${i},${j} is invalid.`)
  if (typeof cell.viewed !== 'boolean') fail(`Invalid save file: view cell ${i},${j} has an invalid viewed flag.`)
  validateArray(cell.viewBy ?? [], `view cell ${i},${j} viewBy`)
}

function validateEntityPosition(entity, size, label) {
  if (!isObject(entity)) fail(`Invalid save file: ${label} is invalid.`)
  validateGridPosition(entity.i, size, `${label}.i`)
  validateGridPosition(entity.j, size, `${label}.j`)
}

function getLoadedConfig() {
  const config = Assets.cache.get('config')
  if (!config) {
    fail('Invalid save file: game config is not loaded.')
  }
  return config
}

function validateMap(map) {
  validateArray(map, 'map')
  if (!map.length || map.length > MAX_MAP_EDGE) {
    fail('Invalid save file: map size is unsupported.')
  }
  const size = map.length
  for (let i = 0; i < size; i++) {
    validateArray(map[i], `map row ${i}`)
    if (map[i].length !== size) {
      fail('Invalid save file: map must be square.')
    }
    for (let j = 0; j < size; j++) {
      validateCell(map[i][j], i, j)
    }
  }
  return size
}

function validatePlayers(players, size, config) {
  validateArray(players, 'players')
  if (!players.length) fail('Invalid save file: players list is empty.')

  let playedPlayers = 0
  for (let index = 0; index < players.length; index++) {
    const player = players[index]
    if (!isObject(player)) fail(`Invalid save file: player ${index} is invalid.`)
    if (![PLAYER_TYPES.human, PLAYER_TYPES.ai].includes(player.type)) {
      fail(`Invalid save file: player ${index} has an unsupported type.`)
    }
    if (typeof player.isPlayed !== 'boolean') {
      fail(`Invalid save file: player ${index} has an invalid isPlayed flag.`)
    }
    if (player.isPlayed) playedPlayers++

    validateArray(player.buildings ?? [], `player ${index} buildings`)
    validateArray(player.units ?? [], `player ${index} units`)
    validateArray(player.corpses ?? [], `player ${index} corpses`)
    validateArray(player.views ?? [], `player ${index} views`)
    if (player.views.length !== size) {
      fail(`Invalid save file: player ${index} views have an invalid size.`)
    }

    for (let i = 0; i < size; i++) {
      validateArray(player.views[i], `player ${index} view row ${i}`)
      if (player.views[i].length !== size) {
        fail(`Invalid save file: player ${index} views must match the map size.`)
      }
      for (let j = 0; j < size; j++) {
        validateViewCell(player.views[i][j], i, j)
      }
    }

    player.buildings.forEach((building, buildingIndex) => {
      validateEntityPosition(building, size, `player ${index} building ${buildingIndex}`)
      if (typeof building.type !== 'string' || !config.buildings?.[building.type]) {
        fail(`Invalid save file: player ${index} building ${buildingIndex} has an unsupported type.`)
      }
    })

    player.units.forEach((unit, unitIndex) => {
      validateEntityPosition(unit, size, `player ${index} unit ${unitIndex}`)
      if (typeof unit.type !== 'string' || !config.units?.[unit.type]) {
        fail(`Invalid save file: player ${index} unit ${unitIndex} has an unsupported type.`)
      }
    })

    player.corpses.forEach((corpse, corpseIndex) => {
      validateEntityPosition(corpse, size, `player ${index} corpse ${corpseIndex}`)
      if (typeof corpse.type !== 'string' || !config.units?.[corpse.type]) {
        fail(`Invalid save file: player ${index} corpse ${corpseIndex} has an unsupported type.`)
      }
    })
  }

  if (playedPlayers !== 1) {
    fail('Invalid save file: exactly one played player is required.')
  }
}

function validateResources(resources, size, config) {
  validateArray(resources, 'resources')
  resources.forEach((resource, index) => {
    validateEntityPosition(resource, size, `resource ${index}`)
    if (typeof resource.type !== 'string' || !config.resources?.[resource.type]) {
      fail(`Invalid save file: resource ${index} has an unsupported type.`)
    }
  })
}

function validateAnimals(animals, size, config) {
  validateArray(animals, 'animals')
  animals.forEach((animal, index) => {
    validateEntityPosition(animal, size, `animal ${index}`)
    if (typeof animal.type !== 'string' || !config.animals?.[animal.type]) {
      fail(`Invalid save file: animal ${index} has an unsupported type.`)
    }
  })
}

function validateCamera(camera) {
  if (!isObject(camera)) fail('Invalid save file: camera is invalid.')
  if (!isFiniteNumber(camera.x) || !isFiniteNumber(camera.y)) {
    fail('Invalid save file: camera coordinates are invalid.')
  }
}

export function validateSaveData(data) {
  if (!isObject(data)) {
    fail('Invalid save file: expected an object.')
  }

  const config = getLoadedConfig()
  const size = validateMap(data.map)
  validateCamera(data.camera)
  validatePlayers(data.players, size, config)
  validateResources(data.resources, size, config)
  validateAnimals(data.animals, size, config)

  if (data.config != null && !isObject(data.config)) {
    fail('Invalid save file: config is invalid.')
  }

  return data
}

export function parseSaveJSON(raw) {
  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch {
    fail('Invalid save file: malformed JSON.')
  }
  return validateSaveData(parsed)
}
