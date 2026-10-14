import { HOUSE_LEVELS } from '../../config/housing'
import { nextBuildingUpgrade } from '../../lib/buildings/buildingUpgrade'
import type { BuildingConfig } from '../../types/config'
import type { LoadedGameConfig, SaveEntityState } from '../../types/save'
import { validateCaveDefinition } from '../CaveSave'
import { validateSavedHorseTamingStatus } from '../SaveAnimalState'
import { validateDepotReservePolicy } from './DepotReserveValidation'
import {
  fail,
  isObject,
  type ObjectRecord,
  validateArray,
  validateEntityPosition,
  validateOptionalBoolean,
  validateOptionalFiniteNumber,
} from './SaveValidationPrimitives'

function validateBuildingResidents(building: ObjectRecord): void {
  if (
    building.settlementName != null &&
    (typeof building.settlementName !== 'string' ||
      !building.settlementName.trim() ||
      building.settlementName.length > 120)
  )
    fail('Invalid save file: settlement name is invalid.')
  validateOptionalBoolean((building as SaveEntityState).placementMirrored, 'building mirror')
  validateDepotReservePolicy(building.reservePolicy, String(building.type))
  if (
    building.heroHomeResident != null &&
    (!isObject(building.heroHomeResident) ||
      typeof building.heroHomeResident.label !== 'string' ||
      !building.heroHomeResident.label ||
      (building.heroHomeResident.name != null && typeof building.heroHomeResident.name !== 'string'))
  )
    fail('Invalid hero home resident.')
  if (
    building.plannedBedLabels != null &&
    (!Array.isArray(building.plannedBedLabels) ||
      building.plannedBedLabels.some(label => typeof label !== 'string' || !label) ||
      new Set(building.plannedBedLabels).size !== building.plannedBedLabels.length)
  )
    fail('Invalid planned bed identities.')
}

function validateConstructionProgress(building: ObjectRecord): void {
  if (building.constructionPaused != null && typeof building.constructionPaused !== 'boolean')
    fail('Invalid construction pause state.')
  if (
    building.constructionProgress != null &&
    (typeof building.constructionProgress !== 'number' ||
      !Number.isFinite(building.constructionProgress) ||
      building.constructionProgress < 0 ||
      building.constructionProgress > 1)
  )
    fail('Invalid construction progress.')
  if (
    building.constructionWorkRequired != null &&
    (typeof building.constructionWorkRequired !== 'number' ||
      !Number.isFinite(building.constructionWorkRequired) ||
      building.constructionWorkRequired <= 0)
  )
    fail('Invalid construction work.')
}

function validateConstructionMaterials(materials: unknown): void {
  if (materials == null) return
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

function validateBuildingLevels(building: ObjectRecord, label: string): void {
  if (
    building.buildingLevel != null &&
    (typeof building.buildingLevel !== 'number' ||
      !Number.isInteger(building.buildingLevel) ||
      building.buildingLevel < 0)
  ) {
    fail(`Invalid save file: ${label} has an invalid building level.`)
  }
  if (
    building.houseInteriorLevel != null &&
    (typeof building.houseInteriorLevel !== 'number' ||
      !Number.isInteger(building.houseInteriorLevel) ||
      building.houseInteriorLevel < 0 ||
      building.houseInteriorLevel >= HOUSE_LEVELS.length)
  )
    fail('Invalid house interior level.')
}

function validateUpgradeProgress(upgrade: ObjectRecord): void {
  if (upgrade.constructionProgress != null) {
    if (
      typeof upgrade.constructionProgress !== 'number' ||
      !Number.isFinite(upgrade.constructionProgress) ||
      upgrade.constructionProgress < 0 ||
      upgrade.constructionProgress > 1
    )
      fail('Invalid building upgrade progress.')
  } else if (
    typeof upgrade.hitPoints !== 'number' ||
    !Number.isFinite(upgrade.hitPoints) ||
    typeof upgrade.totalHitPoints !== 'number' ||
    !Number.isFinite(upgrade.totalHitPoints) ||
    upgrade.totalHitPoints < 1 ||
    upgrade.hitPoints < 1 ||
    upgrade.hitPoints > Number(upgrade.totalHitPoints)
  ) {
    fail('Invalid building upgrade progress.')
  }
}

function validateBuildingUpgrade(building: ObjectRecord, buildingConfig: BuildingConfig): void {
  if (building.buildingUpgrade == null) return
  const upgrade = building.buildingUpgrade
  if (
    !isObject(upgrade) ||
    !building.isBuilt ||
    building.isDead ||
    building.isDestroyed ||
    !building.constructionMaterials
  )
    fail('Invalid building upgrade state.')
  if (upgrade.targetLevel !== nextBuildingUpgrade(buildingConfig, Number(building.buildingLevel ?? 0)))
    fail('Invalid building upgrade tier.')
  if (
    typeof upgrade.constructionTime !== 'number' ||
    !Number.isFinite(upgrade.constructionTime) ||
    upgrade.constructionTime <= 0
  )
    fail('Invalid building upgrade progress.')
  validateUpgradeProgress(upgrade)
}

function validateInteriorBuildings(building: ObjectRecord, playerIndex: number, config: LoadedGameConfig): void {
  if (building.interiorBuildings == null) return
  validateArray(building.interiorBuildings, 'interior buildings')
  for (const child of building.interiorBuildings) {
    if (!isObject(child) || child.interiorBuildings != null || child.spaceId != null)
      fail('Invalid save file: invalid nested interior building.')
  }
  // Interior coordinates belong to the room, not the sparse exterior grid.
  validatePlayerBuildings(building.interiorBuildings, playerIndex, Number.MAX_SAFE_INTEGER, config)
}

function validateCaveAndTownCenter(building: ObjectRecord): void {
  if (building.cave != null) {
    if (building.type !== 'Cave') fail('Invalid cave building type.')
    validateCaveDefinition(building.cave)
  }
  if (building.townCenterId != null && (typeof building.townCenterId !== 'string' || !building.townCenterId))
    fail('Invalid town center identity.')
}

function validateStableHorses(building: ObjectRecord, label: string): void {
  if (building.stableHorses == null) return
  validateArray(building.stableHorses, `${label}.stableHorses`)
  building.stableHorses.forEach((horse, horseIndex) =>
    validateSavedHorseTamingStatus(horse, `${label}.stableHorses ${horseIndex}`)
  )
}

function validatePlayerBuilding(
  building: unknown,
  playerIndex: number,
  buildingIndex: number,
  size: number,
  config: LoadedGameConfig
): void {
  const label = `player ${playerIndex} building ${buildingIndex}`
  validateEntityPosition(building, size, label)
  validateBuildingResidents(building)
  validateConstructionProgress(building)
  validateConstructionMaterials(building.constructionMaterials)
  if (typeof building.type !== 'string' || !config.buildings?.[building.type]) {
    fail(`Invalid save file: ${label} has an unsupported type.`)
  }
  validateBuildingLevels(building, label)
  validateBuildingUpgrade(building, config.buildings[building.type])
  validateCaveAndTownCenter(building)
  validateInteriorBuildings(building, playerIndex, config)
  validateStableHorses(building, label)
  validateOptionalFiniteNumber(building.trainingStartedDay, `${label}.trainingStartedDay`)
  validateOptionalFiniteNumber(building.trainingCompleteDay, `${label}.trainingCompleteDay`)
}

export function validatePlayerBuildings(
  buildings: unknown[],
  playerIndex: number,
  size: number,
  config: LoadedGameConfig
): void {
  buildings.forEach((building, buildingIndex) =>
    validatePlayerBuilding(building, playerIndex, buildingIndex, size, config)
  )
}
