import { PLAYER_TYPES } from '../../constants'
import { validateTargetKnowledge } from '../../lib/units/playerTargetKnowledge'
import type { LoadedGameConfig, SaveEntityState } from '../../types/save'
import { validateCaveDefinition } from '../CaveSave'
import { validateDepotReservePolicy } from '../DepotReserveValidation'
import { normalizeSavedInteriorBuildings, savedBuildingsWithInteriors } from '../InteriorBuildingSave'
import { validateMinimapBuildingMemory, validateMinimapPreferences } from '../MinimapMemoryValidation'
import { validateSavedHorseTamingStatus } from '../SaveAnimalState'
import { validatePlayerCorpses, validatePlayerUnits } from '../SaveUnitValidators'
import {
  fail,
  isObject,
  validateArray,
  validateEntityPosition,
  validateOptionalBoolean,
  validateOptionalFiniteNumber,
} from '../SaveValidationPrimitives'
import { validatePlayerViews } from '../SaveViewValidation'
import { validatePlayerTraining } from '../TrainingSaveValidation'

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

export function validatePlayerRecord(
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
  validateMinimapBuildingMemory(player.minimapBuildingMemory)
  validateMinimapPreferences(player.minimapPreferences)
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
    validateDepotReservePolicy(building.reservePolicy, String(building.type))
    if (building.constructionMaterials != null) {
      const materials = building.constructionMaterials
      if (!isObject(materials)) fail('Invalid construction materials.')
      for (const field of ['cost', 'delivered', 'consumed'] as const) {
        if (!isObject(materials[field])) fail('Invalid construction material ledger.')
        for (const amount of Object.values(materials[field])) {
          if (typeof amount !== 'number' || !Number.isSafeInteger(amount) || amount < 0)
            fail('Invalid construction material amount.')
        }
      }
      const ledger = materials as {
        cost: Record<string, number>
        delivered: Record<string, number>
        consumed: Record<string, number>
      }
      for (const resource of new Set([...Object.keys(ledger.delivered), ...Object.keys(ledger.consumed)])) {
        if (
          Number(ledger.delivered[resource] ?? 0) + Number(ledger.consumed[resource] ?? 0) >
          Number(ledger.cost[resource] ?? 0)
        )
          fail('Construction materials exceed recipe.')
      }
    }
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
