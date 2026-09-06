import { ACTION_TYPES, PLAYER_TYPES, SHEET_TYPES } from '../constants'
import { isHorseTamingStatus } from '../lib/horses/horseTaming'
import type { LoadedGameConfig } from '../types/save'
import {
  fail,
  isObject,
  validateAnimalPath,
  validateArray,
  validateEntityPosition,
  validateOptionalBoolean,
  validateOptionalFiniteNumber,
  validateOptionalGridDestination,
  validateViewCell,
} from './SaveValidationPrimitives'

const ANIMAL_ACTIONS = new Set<string>(Object.values(ACTION_TYPES))
const ANIMAL_SHEETS = new Set<string>(Object.values(SHEET_TYPES))

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
  validateArray(aiState.enemyUnits ?? [], `player ${playerIndex} AI enemyUnits`)
  validateArray(aiState.enemyBuildings ?? [], `player ${playerIndex} AI enemyBuildings`)
  validateArray(aiState.threatenedTargets ?? [], `player ${playerIndex} AI threatenedTargets`)
}

export function validatePlayers(players: unknown, size: number, config: LoadedGameConfig): void {
  validateArray(players, 'players')
  if (!players.length) fail('Invalid save file: players list is empty.')

  let playedPlayers = 0
  for (let index = 0; index < players.length; index++) {
    if (validatePlayerRecord(players[index], index, size, config)) playedPlayers++
  }

  if (playedPlayers !== 1) {
    fail('Invalid save file: exactly one played player is required.')
  }
}

export function validateResources(resources: unknown, size: number, config: LoadedGameConfig): void {
  validateArray(resources, 'resources')
  resources.forEach((resource, index) => {
    validateEntityPosition(resource, size, `resource ${index}`)
    if (typeof resource.type !== 'string' || !config.resources?.[resource.type]) {
      fail(`Invalid save file: resource ${index} has an unsupported type.`)
    }
  })
}

export function validateNaturalResourceRespawnSlots(slots: unknown, size: number, config: LoadedGameConfig): void {
  const list = slots ?? []
  validateArray(list, 'naturalResourceRespawnSlots')
  list.forEach((slot, index) => {
    validateEntityPosition(slot, size, `natural resource respawn slot ${index}`)
    if (!isObject(slot) || typeof slot.type !== 'string' || !config.resources?.[slot.type]) {
      fail(`Invalid save file: natural resource respawn slot ${index} has an unsupported type.`)
    }
    validateOptionalFiniteNumber(slot.depletedDay, `natural resource respawn slot ${index} depletedDay`)
    validateOptionalFiniteNumber(slot.totalQuantity, `natural resource respawn slot ${index} totalQuantity`)
  })
}

export function validateAnimals(animals: unknown, size: number, config: LoadedGameConfig): void {
  validateArray(animals, 'animals')
  animals.forEach((animal, index) => {
    const label = `animal ${index}`
    validateEntityPosition(animal, size, label)
    if (typeof animal.type !== 'string' || !config.animals?.[animal.type]) {
      fail(`Invalid save file: ${label} has an unsupported type.`)
    }
    validateAnimalState(animal, config.animals[animal.type], size, label)
  })
}

function validatePlayerRecord(player: unknown, index: number, size: number, config: LoadedGameConfig): boolean {
  if (!isObject(player)) fail(`Invalid save file: player ${index} is invalid.`)
  if (
    typeof player.type !== 'string' ||
    ![PLAYER_TYPES.human, PLAYER_TYPES.ai, PLAYER_TYPES.bandits].includes(player.type)
  ) {
    fail(`Invalid save file: player ${index} has an unsupported type.`)
  }
  if (typeof player.isPlayed !== 'boolean') {
    fail(`Invalid save file: player ${index} has an invalid isPlayed flag.`)
  }
  if (player.type === PLAYER_TYPES.ai || player.type === PLAYER_TYPES.bandits) validateAIState(player.aiState, index)

  const buildings = player.buildings ?? []
  const units = player.units ?? []
  const corpses = player.corpses ?? []
  const views = player.views ?? []
  validateArray(buildings, `player ${index} buildings`)
  validateArray(units, `player ${index} units`)
  validateArray(corpses, `player ${index} corpses`)
  validatePlayerViews(views, index, size)
  validatePlayerBuildings(buildings, index, size, config)
  validatePlayerUnits(units, index, size, config)
  validatePlayerCorpses(corpses, index, size, config)
  return player.isPlayed
}

function validatePlayerViews(views: unknown, playerIndex: number, size: number): void {
  validateArray(views, `player ${playerIndex} views`)
  if (views.length !== size) {
    fail(`Invalid save file: player ${playerIndex} views have an invalid size.`)
  }

  for (let i = 0; i < size; i++) {
    const viewRow = views[i]
    validateArray(viewRow, `player ${playerIndex} view row ${i}`)
    if (viewRow.length !== size) {
      fail(`Invalid save file: player ${playerIndex} views must match the map size.`)
    }
    for (let j = 0; j < size; j++) {
      validateViewCell(viewRow[j], i, j)
    }
  }
}

function validatePlayerBuildings(
  buildings: unknown[],
  playerIndex: number,
  size: number,
  config: LoadedGameConfig
): void {
  buildings.forEach((building, buildingIndex) => {
    validateEntityPosition(building, size, `player ${playerIndex} building ${buildingIndex}`)
    if (typeof building.type !== 'string' || !config.buildings?.[building.type]) {
      fail(`Invalid save file: player ${playerIndex} building ${buildingIndex} has an unsupported type.`)
    }
    if (isObject(building) && building.stableHorses != null) {
      validateArray(building.stableHorses, `player ${playerIndex} building ${buildingIndex}.stableHorses`)
      building.stableHorses.forEach((horse, horseIndex) =>
        validateSavedHorseTamingStatus(horse, `player ${playerIndex} building ${buildingIndex}.stableHorses ${horseIndex}`)
      )
    }
    validateOptionalFiniteNumber(building.trainingStartedDay, `player ${playerIndex} building ${buildingIndex}.trainingStartedDay`)
    validateOptionalFiniteNumber(building.trainingCompleteDay, `player ${playerIndex} building ${buildingIndex}.trainingCompleteDay`)
  })
}

function validatePlayerUnits(units: unknown[], playerIndex: number, size: number, config: LoadedGameConfig): void {
  units.forEach((unit, unitIndex) => {
    validateEntityPosition(unit, size, `player ${playerIndex} unit ${unitIndex}`)
    if (typeof unit.type !== 'string' || !config.units?.[unit.type]) {
      fail(`Invalid save file: player ${playerIndex} unit ${unitIndex} has an unsupported type.`)
    }
  })
}

function validatePlayerCorpses(corpses: unknown[], playerIndex: number, size: number, config: LoadedGameConfig): void {
  corpses.forEach((corpse, corpseIndex) => {
    validateEntityPosition(corpse, size, `player ${playerIndex} corpse ${corpseIndex}`)
    if (typeof corpse.type !== 'string' || !config.units?.[corpse.type]) {
      fail(`Invalid save file: player ${playerIndex} corpse ${corpseIndex} has an unsupported type.`)
    }
  })
}

function validateAnimalState(
  animal: Record<string, unknown>,
  definition: Record<string, unknown>,
  size: number,
  label: string
): void {
  validateOptionalFiniteNumber(animal.quantity, `${label}.quantity`)
  validateOptionalBoundedNumber(animal.quantity, definition.totalQuantity, `${label}.quantity`)
  validateOptionalFiniteNumber(animal.hitPoints, `${label}.hitPoints`)
  validateOptionalBoundedNumber(animal.hitPoints, definition.totalHitPoints, `${label}.hitPoints`)
  validateOptionalBoolean(animal.isDead, `${label}.isDead`)
  validateOptionalBoolean(animal.isDestroyed, `${label}.isDestroyed`)
  validateSavedHorseTamingStatus(animal, label)
  if (animal.isDestroyed === true && animal.isDead !== true) {
    fail(`Invalid save file: ${label} is destroyed but not dead.`)
  }
  if (animal.action != null && (typeof animal.action !== 'string' || !ANIMAL_ACTIONS.has(animal.action))) {
    fail(`Invalid save file: ${label}.action is invalid.`)
  }
  if (animal.currentSheet != null && (typeof animal.currentSheet !== 'string' || !ANIMAL_SHEETS.has(animal.currentSheet))) {
    fail(`Invalid save file: ${label}.currentSheet is invalid.`)
  }
  validateAnimalPath(animal.path, size, `${label}.path`)
  validateOptionalGridDestination(animal.dest, size, `${label}.dest`)
  validateOptionalGridDestination(animal.previousDest, size, `${label}.previousDest`)
  validateOptionalGridDestination(animal.realDest, size, `${label}.realDest`)
}

function validateSavedHorseTamingStatus(record: unknown, label: string): void {
  if (!isObject(record) || record.tamingStatus == null) return
  if (!isHorseTamingStatus(record.tamingStatus)) {
    fail(`Invalid save file: ${label}.tamingStatus is invalid.`)
  }
}

function validateOptionalBoundedNumber(value: unknown, max: unknown, label: string): void {
  if (typeof value === 'number' && typeof max === 'number' && (value < 0 || value > max)) {
    fail(`Invalid save file: ${label} is out of range.`)
  }
}
