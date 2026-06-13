import { Assets } from 'pixi.js'
import { ACTION_TYPES, PLAYER_TYPES, SHEET_TYPES } from '../constants'

const MAX_MAP_EDGE = 513
const ANIMAL_ACTIONS = new Set(Object.values(ACTION_TYPES))
const ANIMAL_SHEETS = new Set(Object.values(SHEET_TYPES))

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
  if (cell.z != null && !isFiniteNumber(cell.z)) fail(`Invalid save file: cell ${i},${j} has an invalid height.`)
  if (typeof cell.type !== 'string' || !cell.type) fail(`Invalid save file: cell ${i},${j} has an invalid type.`)
  validateArray(cell.fogSprites ?? [], `cell ${i},${j} fogSprites`)
}

function validateViewCell(cell, i, j) {
  if (!isObject(cell)) fail(`Invalid save file: view cell ${i},${j} is invalid.`)
  if (cell.viewed != null && typeof cell.viewed !== 'boolean') {
    fail(`Invalid save file: view cell ${i},${j} has an invalid viewed flag.`)
  }
  validateArray(cell.viewBy ?? [], `view cell ${i},${j} viewBy`)
}

function validateEntityPosition(entity, size, label) {
  if (!isObject(entity)) fail(`Invalid save file: ${label} is invalid.`)
  validateGridPosition(entity.i, size, `${label}.i`)
  validateGridPosition(entity.j, size, `${label}.j`)
}

function validateOptionalFiniteNumber(value, label) {
  if (value != null && !isFiniteNumber(value)) {
    fail(`Invalid save file: ${label} must be a finite number.`)
  }
}

function validateOptionalBoolean(value, label) {
  if (value != null && typeof value !== 'boolean') {
    fail(`Invalid save file: ${label} must be a boolean.`)
  }
}

function validateOptionalGridDestination(value, size, label) {
  if (value == null) return

  if (Array.isArray(value)) {
    if (value.length < 2 || value.length > 3) {
      fail(`Invalid save file: ${label} is invalid.`)
    }
    validateGridPosition(value[0], size, `${label}.i`)
    validateGridPosition(value[1], size, `${label}.j`)
    if (value[2] != null && typeof value[2] !== 'string') {
      fail(`Invalid save file: ${label}.label is invalid.`)
    }
    return
  }

  if (!isObject(value)) {
    fail(`Invalid save file: ${label} is invalid.`)
  }
  validateGridPosition(value.i, size, `${label}.i`)
  validateGridPosition(value.j, size, `${label}.j`)
  validateOptionalFiniteNumber(value.x, `${label}.x`)
  validateOptionalFiniteNumber(value.y, `${label}.y`)
  if (value.label != null && typeof value.label !== 'string') {
    fail(`Invalid save file: ${label}.label is invalid.`)
  }
}

function validateAnimalPath(path, size, label) {
  if (path == null) return
  validateArray(path, label)
  if (path.length > size * size) {
    fail(`Invalid save file: ${label} is too long.`)
  }
  path.forEach((cell, index) => {
    validateEntityPosition(cell, size, `${label} ${index}`)
  })
}

function validateAIState(aiState, playerIndex) {
  if (aiState == null) return
  if (!isObject(aiState)) fail(`Invalid save file: player ${playerIndex} AI state is invalid.`)

  if (aiState.phase != null && !['economy', 'military_build', 'attack'].includes(aiState.phase)) {
    fail(`Invalid save file: player ${playerIndex} AI phase is invalid.`)
  }
  validateOptionalFiniteNumber(aiState.savedAt, `player ${playerIndex} AI savedAt`)
  validateOptionalFiniteNumber(aiState.lastAttackWaveAgo, `player ${playerIndex} AI lastAttackWaveAgo`)
  validateOptionalFiniteNumber(aiState.lastAttackWaveAt, `player ${playerIndex} AI lastAttackWaveAt`)
  validateArray(aiState.enemyUnits ?? [], `player ${playerIndex} AI enemyUnits`)
  validateArray(aiState.enemyBuildings ?? [], `player ${playerIndex} AI enemyBuildings`)
  validateArray(aiState.threatenedTargets ?? [], `player ${playerIndex} AI threatenedTargets`)
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
    if (player.type === PLAYER_TYPES.ai) validateAIState(player.aiState, index)

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
    const label = `animal ${index}`
    validateEntityPosition(animal, size, label)
    if (typeof animal.type !== 'string' || !config.animals?.[animal.type]) {
      fail(`Invalid save file: ${label} has an unsupported type.`)
    }

    const definition = config.animals[animal.type]
    validateOptionalFiniteNumber(animal.quantity, `${label}.quantity`)
    if (animal.quantity != null && (animal.quantity < 0 || animal.quantity > definition.totalQuantity)) {
      fail(`Invalid save file: ${label}.quantity is out of range.`)
    }
    validateOptionalFiniteNumber(animal.hitPoints, `${label}.hitPoints`)
    if (animal.hitPoints != null && (animal.hitPoints < 0 || animal.hitPoints > definition.totalHitPoints)) {
      fail(`Invalid save file: ${label}.hitPoints is out of range.`)
    }

    validateOptionalBoolean(animal.isDead, `${label}.isDead`)
    validateOptionalBoolean(animal.isDestroyed, `${label}.isDestroyed`)
    if (animal.isDestroyed === true && animal.isDead !== true) {
      fail(`Invalid save file: ${label} is destroyed but not dead.`)
    }
    if (animal.action != null && (typeof animal.action !== 'string' || !ANIMAL_ACTIONS.has(animal.action))) {
      fail(`Invalid save file: ${label}.action is invalid.`)
    }
    if (
      animal.currentSheet != null &&
      (typeof animal.currentSheet !== 'string' || !ANIMAL_SHEETS.has(animal.currentSheet))
    ) {
      fail(`Invalid save file: ${label}.currentSheet is invalid.`)
    }
    validateAnimalPath(animal.path, size, `${label}.path`)
    validateOptionalGridDestination(animal.dest, size, `${label}.dest`)
    validateOptionalGridDestination(animal.previousDest, size, `${label}.previousDest`)
    validateOptionalGridDestination(animal.realDest, size, `${label}.realDest`)
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

  if (data.runtime != null) {
    if (!isObject(data.runtime)) fail('Invalid save file: runtime is invalid.')
    validateOptionalFiniteNumber(data.runtime.elapsedMs, 'runtime elapsedMs')
  }
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
