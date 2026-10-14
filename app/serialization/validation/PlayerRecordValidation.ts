import { migrateEquipmentRecord } from '../../lib/equipment/equipmentMaterials'
import { migrateLegacyProgression } from '../LegacyProgressionMigration'
import { FORGE_FAMILIES } from '../../lib/equipment/forgeUpgrades'
import { PLAYER_TYPES } from '../../constants'
import { validateTargetKnowledge } from '../../lib/units/playerTargetKnowledge'
import type { LoadedGameConfig, SaveEntityState, SavePlayerState } from '../../types/save'
import { normalizeSavedInteriorBuildings, savedBuildingsWithInteriors } from '../InteriorBuildingSave'
import { validateMinimapBuildingMemory, validateMinimapPreferences } from './MinimapMemoryValidation'
import { validatePlayerCorpses, validatePlayerUnits } from './SaveUnitValidators'
import { validatePlayerBuildings } from './BuildingRecordValidation'
import { fail, isObject, validateArray, validateOptionalFiniteNumber } from './SaveValidationPrimitives'
import { validatePlayerViews } from './SaveViewValidation'
import { validatePlayerTraining } from './TrainingSaveValidation'

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

function validateForgeUpgrades(forgeUpgrades: unknown): void {
  if (forgeUpgrades == null) return
  if (!isObject(forgeUpgrades)) fail('Invalid save file: forge upgrades must be an object.')
  for (const [family, tier] of Object.entries(forgeUpgrades)) {
    if (
      !FORGE_FAMILIES.includes(family as (typeof FORGE_FAMILIES)[number]) ||
      typeof tier !== 'number' ||
      !Number.isInteger(tier) ||
      tier < 0 ||
      tier > 3
    )
      fail('Invalid save file: invalid forge upgrade.')
  }
}

function validateInteriorIdentities(buildings: SaveEntityState[]): void {
  const interiorLabels = new Set(buildings.map(building => building.label).filter(Boolean))
  for (const building of buildings) {
    for (const child of building.interiorBuildings ?? []) {
      if (typeof child.label !== 'string' || !child.label || interiorLabels.has(child.label))
        fail('Invalid save file: duplicate or missing interior building identity.')
      interiorLabels.add(child.label)
    }
  }
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

  validateForgeUpgrades(player.forgeUpgrades)
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
  migrateLegacyProgression(player as SavePlayerState)
  migrateEquipmentRecord(player)
  normalizeSavedInteriorBuildings(player as { label?: string; buildings?: SaveEntityState[] })
  const normalizedBuildings = player.buildings as SaveEntityState[]
  validateArray(units, `player ${index} units`)
  validateArray(corpses, `player ${index} corpses`)
  if (!abstractEconomy || player.views != null) validatePlayerViews(views, index, size, containsCell)
  validatePlayerBuildings(normalizedBuildings, index, size, config)
  validatePlayerUnits(units, index, size, config)
  validatePlayerCorpses(corpses, index, size, config)
  const allBuildings = savedBuildingsWithInteriors(normalizedBuildings)
  validateInteriorIdentities(normalizedBuildings)
  validatePlayerTraining(allBuildings, [...units, ...corpses], size, config)
  return player.isPlayed
}
