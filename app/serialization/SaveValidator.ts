import { Assets } from 'pixi.js'
import { CAMPAIGN_SAVE_FORMAT, getCurrentWorldState, isCampaignSave } from './CampaignSave'
import type { LoadedGameConfig, SaveRecord, SerializedSave } from '../types/save'
import {
  fail,
  isFiniteNumber,
  isObject,
  MAX_MAP_EDGE,
  type ObjectRecord,
  validateArray,
  validateCell,
  validateOptionalFiniteNumber,
} from './SaveValidationPrimitives'
import {
  validateAnimals,
  validateNaturalResourceRespawnSlots,
  validatePlayers,
  validateResources,
} from './SaveEntityValidators'

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

function validateSeedWorld(data: ObjectRecord, legacyMapSize: number | null = null): number {
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
  const environment = world.environment ?? config.environment
  if (environment != null && (typeof environment !== 'string' || !environment)) {
    fail('Invalid save file: map environment is invalid.')
  }
  return rawSize + 1
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

  if (isCampaignSave(data)) {
    if (data.version !== 1) fail('Invalid save file: campaign version is unsupported.')
    if (data.format !== CAMPAIGN_SAVE_FORMAT) fail('Invalid save file: campaign format is invalid.')
    if (!isObject(data.worlds)) fail('Invalid save file: campaign worlds are invalid.')
    if (!isObject(data.worldGraph)) fail('Invalid save file: campaign world graph is invalid.')
    if (data.clock != null) {
      if (!isObject(data.clock)) fail('Invalid save file: campaign clock is invalid.')
      validateOptionalFiniteNumber(data.clock.dayNightElapsedMs, 'campaign clock dayNightElapsedMs')
      validateOptionalFiniteNumber(data.clock.savedAt, 'campaign clock savedAt')
    }
    if (!isObject(data.heroParty)) fail('Invalid save file: campaign hero party is invalid.')
    if (!Array.isArray(data.heroParty.followerLabels)) {
      fail('Invalid save file: campaign hero party followers are invalid.')
    }
    const world = data.worlds[data.currentWorldId]
    if (!isObject(world)) fail('Invalid save file: current campaign world is missing.')
    if (world.id !== data.currentWorldId) fail('Invalid save file: current campaign world id is invalid.')
    validateSaveData(getCurrentWorldState(data))
    return data
  }

  const config = getLoadedConfig()
  const legacyMapSize = Array.isArray(data.map) ? validateMap(data.map) : null
  const size = validateSeedWorld(data, legacyMapSize)
  validateCamera(data.camera)
  validatePlayers(data.players, size, config)
  validateResources(data.resources, size, config)
  validateNaturalResourceRespawnSlots(data.naturalResourceRespawnSlots, size, config)
  validateAnimals(data.animals, size, config)

  if (data.runtime != null) {
    if (!isObject(data.runtime)) fail('Invalid save file: runtime is invalid.')
    validateOptionalFiniteNumber(data.runtime.dayNightElapsedMs, 'runtime dayNightElapsedMs')
    validateOptionalFiniteNumber(data.runtime.elapsedMs, 'runtime elapsedMs')
    validateOptionalFiniteNumber(data.runtime.savedAt, 'runtime savedAt')
  }
  if (data.config != null && !isObject(data.config)) {
    fail('Invalid save file: config is invalid.')
  }

  return data as SerializedSave
}
