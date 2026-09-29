import { PLAYER_TYPES } from '../constants'
import type { LoadedGameConfig, SaveEntityState } from '../types/save'
import { validateCaveOccupantReferences } from './CaveSave'
import { groupPlayersInteriorBuildings } from './InteriorBuildingSave'
import { validateAnimalState } from './SaveAnimalState'
import { validatePlayerUnits } from './SaveUnitValidators'
import {
  fail,
  isObject,
  validateArray,
  validateEntityPosition,
  validateOptionalFiniteNumber,
} from './SaveValidationPrimitives'
import { validatePlayerRecord } from './validation/PlayerRecordValidation'

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
