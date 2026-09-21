import { validatePlayerViews } from './SaveViewValidation'
import { validatePlayerUnits, validatePlayerCorpses } from './SaveUnitValidators'
import { validateAnimalState, validateSavedHorseTamingStatus } from './SaveAnimalState'
import { validateTargetKnowledge } from '../lib/units/playerTargetKnowledge'
import { validateCaveDefinition, validateCaveOccupantReferences } from './CaveSave'
import { PLAYER_TYPES } from '../constants'
import type { LoadedGameConfig } from '../types/save'
import { validatePlayerTraining } from './TrainingSaveValidation'
import {
  groupPlayersInteriorBuildings,
  normalizeSavedInteriorBuildings,
  savedBuildingsWithInteriors,
} from './InteriorBuildingSave'
import type { SaveEntityState } from '../types/save'
import {
  fail,
  isObject,
  validateArray,
  validateEntityPosition,
  validateOptionalFiniteNumber,
  validateOptionalBoolean,
} from './SaveValidationPrimitives'

export function validateWorldPursuers(value: unknown, size: number, config: LoadedGameConfig): void {
  if (value == null) return
  validateArray(value, 'world pursuers')
  const labels = new Set<string>()
  for (const entry of value) {
    if (!isObject(entry) || !isObject(entry.entity) || !isObject(entry.arrival))
      fail('Invalid save file: world pursuer is invalid.')
    if (typeof entry.targetLabel !== 'string' || !entry.targetLabel)
      fail('Invalid save file: world pursuer target is invalid.')
    if (typeof entry.remainingMs !== 'number' || !Number.isFinite(entry.remainingMs) || entry.remainingMs < 0)
      fail('Invalid save file: world pursuer delay is invalid.')
    const label = entry.entity.label
    if (typeof label !== 'string' || !label || labels.has(label))
      fail('Invalid save file: world pursuer identity is invalid.')
    labels.add(label)
    const entity = { ...entry.entity, i: entry.arrival.i, j: entry.arrival.j, path: [], realDest: null }
    if (entry.owner != null) {
      if (
        !isObject(entry.owner) ||
        typeof entry.owner.label !== 'string' ||
        ![PLAYER_TYPES.human, PLAYER_TYPES.ai, PLAYER_TYPES.bandits, PLAYER_TYPES.gaia].includes(
          entry.owner.type as string
        )
      )
        fail('Invalid save file: world pursuer owner is invalid.')
      validatePlayerUnits([entity], 0, size, config)
    } else validateAnimals([entity], size, config)
  }
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
  validateArray(aiState.enemyUnits ?? [], `player ${playerIndex} AI enemyUnits`)
  validateArray(aiState.enemyBuildings ?? [], `player ${playerIndex} AI enemyBuildings`)
  validateArray(aiState.threatenedTargets ?? [], `player ${playerIndex} AI threatenedTargets`)
}

export function validatePlayers(
  players: unknown,
  size: number,
  config: LoadedGameConfig,
  containsCell?: (i: number, j: number) => boolean,
  options: { abstractEconomy?: boolean } = {}
): void {
  validateArray(players, 'players')
  if (!players.length) fail('Invalid save file: players list is empty.')

  let playedPlayers = 0
  for (let index = 0; index < players.length; index++) {
    if (validatePlayerRecord(players[index], index, size, config, containsCell, options.abstractEconomy))
      playedPlayers++
  }

  const normalized = groupPlayersInteriorBuildings(players as { label?: string; buildings?: SaveEntityState[] }[])
  normalized.forEach((player, index) => Object.assign(players[index] as object, player))
  validateCaveOccupantReferences(players)
  if (playedPlayers !== (options.abstractEconomy ? 0 : 1)) {
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

function validatePlayerRecord(
  player: unknown,
  index: number,
  size: number,
  config: LoadedGameConfig,
  containsCell?: (i: number, j: number) => boolean,
  abstractEconomy = false
): boolean {
  if (!isObject(player)) fail(`Invalid save file: player ${index} is invalid.`)
  if (
    typeof player.type !== 'string' ||
    ![PLAYER_TYPES.human, PLAYER_TYPES.ai, PLAYER_TYPES.bandits, PLAYER_TYPES.gaia].includes(player.type)
  ) {
    fail(`Invalid save file: player ${index} has an unsupported type.`)
  }
  if (typeof player.isPlayed !== 'boolean') {
    fail(`Invalid save file: player ${index} has an invalid isPlayed flag.`)
  }
  if (player.type === PLAYER_TYPES.ai || player.type === PLAYER_TYPES.bandits) validateAIState(player.aiState, index)

  validateTargetKnowledge(player.targetKnowledge)
  const buildings = player.buildings ?? []
  const units = player.units ?? []
  const corpses = player.corpses ?? []
  const views = player.views ?? []
  validateArray(buildings, `player ${index} buildings`)
  for (const building of buildings) {
    if (!isObject(building)) fail('Invalid save file: building is invalid.')
    if (building.interiorBuildings != null) validateArray(building.interiorBuildings, 'interior buildings')
  }
  normalizeSavedInteriorBuildings(player as { label?: string; buildings?: SaveEntityState[] })
  const normalizedBuildings = player.buildings as SaveEntityState[]
  validateArray(units, `player ${index} units`)
  validateArray(corpses, `player ${index} corpses`)
  if (!abstractEconomy || player.views != null) validatePlayerViews(views, index, size, containsCell)
  validatePlayerBuildings(normalizedBuildings, index, size, config)
  validatePlayerUnits(units, index, size, config)
  validatePlayerCorpses(corpses, index, size, config)
  const allBuildings = savedBuildingsWithInteriors(normalizedBuildings)
  const interiorLabels = new Set(normalizedBuildings.map(building => building.label).filter(Boolean))
  for (const building of normalizedBuildings) {
    for (const child of building.interiorBuildings ?? []) {
      if (typeof child.label !== 'string' || !child.label || interiorLabels.has(child.label))
        fail('Invalid save file: duplicate or missing interior building identity.')
      interiorLabels.add(child.label)
    }
  }
  validatePlayerTraining(allBuildings, [...units, ...corpses], size, config)
  return player.isPlayed
}

function validatePlayerBuildings(
  buildings: unknown[],
  playerIndex: number,
  size: number,
  config: LoadedGameConfig
): void {
  buildings.forEach((building, buildingIndex) => {
    validateEntityPosition(building, size, `player ${playerIndex} building ${buildingIndex}`)
    validateOptionalBoolean((building as SaveEntityState).placementMirrored, 'building mirror')
    validateOptionalBoolean((building as SaveEntityState).villagerDeliveriesBlocked, 'building villager deliveries')
    if (typeof building.type !== 'string' || !config.buildings?.[building.type]) {
      fail(`Invalid save file: player ${playerIndex} building ${buildingIndex} has an unsupported type.`)
    }
    if (
      building.buildingAge != null &&
      (typeof building.buildingAge !== 'number' || !Number.isInteger(building.buildingAge) || building.buildingAge < 0)
    ) {
      fail(`Invalid save file: player ${playerIndex} building ${buildingIndex} has an invalid building age.`)
    }
    if (building.cave != null) {
      if (building.type !== 'Cave') fail('Invalid cave building type.')
      validateCaveDefinition(building.cave)
    }
    if (building.interiorBuildings != null) {
      validateArray(building.interiorBuildings, 'interior buildings')
      for (const child of building.interiorBuildings) {
        if (!isObject(child) || child.interiorBuildings != null || child.spaceId != null)
          fail('Invalid save file: invalid nested interior building.')
      }
      // Interior coordinates belong to the room, not the sparse exterior grid.
      validatePlayerBuildings(building.interiorBuildings, playerIndex, Number.MAX_SAFE_INTEGER, config)
    }
    if (isObject(building) && building.stableHorses != null) {
      validateArray(building.stableHorses, `player ${playerIndex} building ${buildingIndex}.stableHorses`)
      building.stableHorses.forEach((horse, horseIndex) =>
        validateSavedHorseTamingStatus(
          horse,
          `player ${playerIndex} building ${buildingIndex}.stableHorses ${horseIndex}`
        )
      )
    }
    validateOptionalFiniteNumber(
      building.trainingStartedDay,
      `player ${playerIndex} building ${buildingIndex}.trainingStartedDay`
    )
    validateOptionalFiniteNumber(
      building.trainingCompleteDay,
      `player ${playerIndex} building ${buildingIndex}.trainingCompleteDay`
    )
  })
}
