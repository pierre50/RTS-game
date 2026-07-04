import { Assets } from 'pixi.js'
import { ACTION_TYPES, PLAYER_TYPES, SHEET_TYPES } from '../constants'
import type { UnknownRecord } from '../types/common'
import type { LoadedGameConfig, SaveRecord, SerializedSave } from '../types/save'

const MAX_MAP_EDGE = 513
const ANIMAL_ACTIONS = new Set<string>(Object.values(ACTION_TYPES))
const ANIMAL_SHEETS = new Set<string>(Object.values(SHEET_TYPES))

function fail(message: string): never {
  throw new Error(message)
}

function isObject(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function validateGridPosition(value: unknown, size: number, label: string): void {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value >= size) {
    fail(`Invalid save file: ${label} is out of bounds.`)
  }
}

function validateArray(value: unknown, label: string): asserts value is unknown[] {
  if (!Array.isArray(value)) {
    fail(`Invalid save file: ${label} must be an array.`)
  }
}

function validateCell(cell: unknown, i: number, j: number): void {
  if (!isObject(cell)) fail(`Invalid save file: cell ${i},${j} is invalid.`)
  if (cell.z != null && !isFiniteNumber(cell.z)) fail(`Invalid save file: cell ${i},${j} has an invalid height.`)
  if (typeof cell.type !== 'string' || !cell.type) fail(`Invalid save file: cell ${i},${j} has an invalid type.`)
  validateArray(cell.fogSprites ?? [], `cell ${i},${j} fogSprites`)
}

function validateViewCell(cell: unknown, i: number, j: number): void {
  if (!isObject(cell)) fail(`Invalid save file: view cell ${i},${j} is invalid.`)
  if (cell.viewed != null && typeof cell.viewed !== 'boolean') {
    fail(`Invalid save file: view cell ${i},${j} has an invalid viewed flag.`)
  }
  validateArray(cell.viewBy ?? [], `view cell ${i},${j} viewBy`)
}

function validateEntityPosition(entity: unknown, size: number, label: string): asserts entity is UnknownRecord {
  if (!isObject(entity)) fail(`Invalid save file: ${label} is invalid.`)
  validateGridPosition(entity.i, size, `${label}.i`)
  validateGridPosition(entity.j, size, `${label}.j`)
}

function validateOptionalFiniteNumber(value: unknown, label: string): void {
  if (value != null && !isFiniteNumber(value)) {
    fail(`Invalid save file: ${label} must be a finite number.`)
  }
}

function validateOptionalBoolean(value: unknown, label: string): void {
  if (value != null && typeof value !== 'boolean') {
    fail(`Invalid save file: ${label} must be a boolean.`)
  }
}

function validateOptionalGridDestination(value: unknown, size: number, label: string): void {
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

function validateAnimalPath(path: unknown, size: number, label: string): void {
  if (path == null) return
  validateArray(path, label)
  if (path.length > size * size) {
    fail(`Invalid save file: ${label} is too long.`)
  }
  path.forEach((cell, index) => {
    validateEntityPosition(cell, size, `${label} ${index}`)
  })
}

function validateAIState(aiState: unknown, playerIndex: number): void {
  if (aiState == null) return
  if (!isObject(aiState)) fail(`Invalid save file: player ${playerIndex} AI state is invalid.`)

  if (
    aiState.phase != null &&
    (typeof aiState.phase !== 'string' || !['economy', 'military_build', 'attack'].includes(aiState.phase))
  ) {
    fail(`Invalid save file: player ${playerIndex} AI phase is invalid.`)
  }
  validateOptionalFiniteNumber(aiState.savedAt, `player ${playerIndex} AI savedAt`)
  validateOptionalFiniteNumber(aiState.lastAttackWaveAgo, `player ${playerIndex} AI lastAttackWaveAgo`)
  validateOptionalFiniteNumber(aiState.lastAttackWaveAt, `player ${playerIndex} AI lastAttackWaveAt`)
  validateArray(aiState.enemyUnits ?? [], `player ${playerIndex} AI enemyUnits`)
  validateArray(aiState.enemyBuildings ?? [], `player ${playerIndex} AI enemyBuildings`)
  validateArray(aiState.threatenedTargets ?? [], `player ${playerIndex} AI threatenedTargets`)
}

function getLoadedConfig(): LoadedGameConfig {
  const config = Assets.cache.get('config')
  if (!config) {
    fail('Invalid save file: game config is not loaded.')
  }
  return config as LoadedGameConfig
}

function validateMap(map: unknown): number {
  validateArray(map, 'map')
  if (!map.length || map.length > MAX_MAP_EDGE) {
    fail('Invalid save file: map size is unsupported.')
  }
  const size = map.length
  for (let i = 0; i < size; i++) {
    const row = map[i]
    validateArray(row, `map row ${i}`)
    if (row.length !== size) {
      fail('Invalid save file: map must be square.')
    }
    for (let j = 0; j < size; j++) {
      validateCell(row[j], i, j)
    }
  }
  return size
}

function validateSeedWorld(data: UnknownRecord, legacyMapSize: number | null = null): number {
  const world = isObject(data.world) ? data.world : {}
  const config = isObject(data.config) ? data.config : {}
  const rawSize = world.size ?? config.size ?? (legacyMapSize != null ? legacyMapSize - 1 : null)
  if (typeof rawSize !== 'number' || !Number.isInteger(rawSize) || rawSize < 1 || rawSize >= MAX_MAP_EDGE) {
    fail('Invalid save file: map size is unsupported.')
  }
  const seed = world.seed ?? config.seed
  if (typeof seed !== 'number' || !Number.isFinite(seed)) {
    fail('Invalid save file: map seed is invalid.')
  }
  const mapType = world.mapType ?? config.mapType
  if (mapType != null && (typeof mapType !== 'string' || !mapType)) {
    fail('Invalid save file: map type is invalid.')
  }
  return rawSize + 1
}

function validatePlayers(players: unknown, size: number, config: LoadedGameConfig): void {
  validateArray(players, 'players')
  if (!players.length) fail('Invalid save file: players list is empty.')

  let playedPlayers = 0
  for (let index = 0; index < players.length; index++) {
    const player = players[index]
    if (!isObject(player)) fail(`Invalid save file: player ${index} is invalid.`)
    if (typeof player.type !== 'string' || ![PLAYER_TYPES.human, PLAYER_TYPES.ai].includes(player.type)) {
      fail(`Invalid save file: player ${index} has an unsupported type.`)
    }
    if (typeof player.isPlayed !== 'boolean') {
      fail(`Invalid save file: player ${index} has an invalid isPlayed flag.`)
    }
    if (player.isPlayed) playedPlayers++
    if (player.type === PLAYER_TYPES.ai) validateAIState(player.aiState, index)

    const buildings = player.buildings ?? []
    const units = player.units ?? []
    const corpses = player.corpses ?? []
    const views = player.views ?? []
    validateArray(buildings, `player ${index} buildings`)
    validateArray(units, `player ${index} units`)
    validateArray(corpses, `player ${index} corpses`)
    validateArray(views, `player ${index} views`)
    if (views.length !== size) {
      fail(`Invalid save file: player ${index} views have an invalid size.`)
    }

    for (let i = 0; i < size; i++) {
      const viewRow = views[i]
      validateArray(viewRow, `player ${index} view row ${i}`)
      if (viewRow.length !== size) {
        fail(`Invalid save file: player ${index} views must match the map size.`)
      }
      for (let j = 0; j < size; j++) {
        validateViewCell(viewRow[j], i, j)
      }
    }

    buildings.forEach((building: unknown, buildingIndex: number) => {
      validateEntityPosition(building, size, `player ${index} building ${buildingIndex}`)
      if (typeof building.type !== 'string' || !config.buildings?.[building.type]) {
        fail(`Invalid save file: player ${index} building ${buildingIndex} has an unsupported type.`)
      }
    })

    units.forEach((unit: unknown, unitIndex: number) => {
      validateEntityPosition(unit, size, `player ${index} unit ${unitIndex}`)
      if (typeof unit.type !== 'string' || !config.units?.[unit.type]) {
        fail(`Invalid save file: player ${index} unit ${unitIndex} has an unsupported type.`)
      }
    })

    corpses.forEach((corpse: unknown, corpseIndex: number) => {
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

function validateResources(resources: unknown, size: number, config: LoadedGameConfig): void {
  validateArray(resources, 'resources')
  resources.forEach((resource, index) => {
    validateEntityPosition(resource, size, `resource ${index}`)
    if (typeof resource.type !== 'string' || !config.resources?.[resource.type]) {
      fail(`Invalid save file: resource ${index} has an unsupported type.`)
    }
  })
}

function validateAnimals(animals: unknown, size: number, config: LoadedGameConfig): void {
  validateArray(animals, 'animals')
  animals.forEach((animal, index) => {
    const label = `animal ${index}`
    validateEntityPosition(animal, size, label)
    if (typeof animal.type !== 'string' || !config.animals?.[animal.type]) {
      fail(`Invalid save file: ${label} has an unsupported type.`)
    }

    const definition = config.animals[animal.type]
    validateOptionalFiniteNumber(animal.quantity, `${label}.quantity`)
    if (
      typeof animal.quantity === 'number' &&
      typeof definition.totalQuantity === 'number' &&
      (animal.quantity < 0 || animal.quantity > definition.totalQuantity)
    ) {
      fail(`Invalid save file: ${label}.quantity is out of range.`)
    }
    validateOptionalFiniteNumber(animal.hitPoints, `${label}.hitPoints`)
    if (
      typeof animal.hitPoints === 'number' &&
      typeof definition.totalHitPoints === 'number' &&
      (animal.hitPoints < 0 || animal.hitPoints > definition.totalHitPoints)
    ) {
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

function validateCamera(camera: unknown): void {
  if (!isObject(camera)) fail('Invalid save file: camera is invalid.')
  if (!isFiniteNumber(camera.x) || !isFiniteNumber(camera.y)) {
    fail('Invalid save file: camera coordinates are invalid.')
  }
}

export function validateSaveData(data: unknown): SaveRecord {
  if (!isObject(data)) {
    fail('Invalid save file: expected an object.')
  }

  const config = getLoadedConfig()
  const legacyMapSize = Array.isArray(data.map) ? validateMap(data.map) : null
  const size = validateSeedWorld(data, legacyMapSize)
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

  return data as SerializedSave
}

export function parseSaveJSON(raw: string): SaveRecord {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    fail('Invalid save file: malformed JSON.')
  }
  return validateSaveData(parsed)
}
