import { Assets } from 'pixi.js'
import { gridToLocal } from '../lib/localMapLayout'
import type { GameConfig } from '../types/save'
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
  validateWorldPursuers,
} from './SaveEntityValidators'

function getLoadedConfig(): LoadedGameConfig {
  const config = Assets.cache.get('config')
  if (!config) {
    fail('Invalid save file: game config is not loaded.')
  }
  return config as LoadedGameConfig
}

type LocalLayout = NonNullable<GameConfig['localGridLayout']>

function containsCell(layout: LocalLayout, i: number, j: number): boolean {
  const { row, column } = gridToLocal(i, j, layout)
  return row >= 0 && row < layout.rows && column >= 0 && column < layout.columns - (row % 2)
}

function validateLocalLayout(value: unknown): LocalLayout | undefined {
  if (value === undefined) return undefined
  if (
    !isObject(value) ||
    !Number.isInteger(value.columns) ||
    !Number.isInteger(value.rows) ||
    typeof value.columns !== 'number' ||
    typeof value.rows !== 'number' ||
    value.columns < 2 ||
    value.columns > MAX_MAP_EDGE ||
    value.rows !== 4 * (value.columns - 1) + 1
  ) {
    fail('Invalid save file: local grid layout is invalid.')
  }
  return { columns: value.columns, rows: value.rows }
}

function validateMap(map: unknown, layout?: LocalLayout): number {
  validateArray(map, 'map')
  if (!map.length || map.length > MAX_MAP_EDGE) {
    fail('Invalid save file: map size is unsupported.')
  }
  const size = map.length
  for (let i = 0; i < size; i++) {
    const row = map[i]
    validateArray(row, `map row ${i}`)
    if (layout ? row.length > size : row.length !== size) {
      fail('Invalid save file: map must be square.')
    }
    for (let j = 0; j < size; j++) {
      if (layout && !containsCell(layout, i, j)) {
        if (row[j] != null) fail(`Invalid save file: cell ${i},${j} is outside the local grid layout.`)
        continue
      }
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
  if (
    world.sourceSize != null &&
    (typeof world.sourceSize !== 'number' ||
      !Number.isInteger(world.sourceSize) ||
      world.sourceSize < 1 ||
      world.sourceSize >= MAX_MAP_EDGE)
  ) {
    fail('Invalid save file: source map size is unsupported.')
  }
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
  const worldLayout = validateLocalLayout(isObject(data.world) ? data.world.localGridLayout : undefined)
  const configLayout = validateLocalLayout(isObject(data.config) ? data.config.localGridLayout : undefined)
  if (
    worldLayout &&
    configLayout &&
    (worldLayout.columns !== configLayout.columns || worldLayout.rows !== configLayout.rows)
  ) {
    fail('Invalid save file: local grid layouts disagree.')
  }
  const layout = worldLayout ?? configLayout
  const legacyMapSize = Array.isArray(data.map) ? validateMap(data.map, layout) : null
  const size = validateSeedWorld(data, legacyMapSize)
  if (layout && layout.columns - 1 + Math.ceil((layout.rows - 1) / 2) >= size) {
    fail('Invalid save file: local grid layout exceeds the map size.')
  }
  if (layout && legacyMapSize != null && legacyMapSize !== size) {
    fail('Invalid save file: local grid map size disagrees with its world size.')
  }
  validateCamera(data.camera)
  validatePlayers(data.players, size, config, layout ? (i, j) => containsCell(layout, i, j) : undefined)
  validateResources(data.resources, size, config)
  validateNaturalResourceRespawnSlots(data.naturalResourceRespawnSlots, size, config)
  validateAnimals(data.animals, size, config)
  if (layout) {
    const players = data.players as ObjectRecord[]
    const entities = [
      data.resources,
      data.animals,
      data.naturalResourceRespawnSlots ?? [],
      ...players.flatMap(player => [player.buildings ?? [], player.units ?? [], player.corpses ?? []]),
    ]
    for (const list of entities as ObjectRecord[][]) {
      for (const entity of list) {
        if (!containsCell(layout, entity.i as number, entity.j as number)) {
          fail('Invalid save file: entity is outside the local grid layout.')
        }
      }
    }
  }

  if (data.runtime != null) {
    if (!isObject(data.runtime)) fail('Invalid save file: runtime is invalid.')
    validateOptionalFiniteNumber(data.runtime.dayNightElapsedMs, 'runtime dayNightElapsedMs')
    validateOptionalFiniteNumber(data.runtime.elapsedMs, 'runtime elapsedMs')
    validateOptionalFiniteNumber(data.runtime.savedAt, 'runtime savedAt')
    validateWorldPursuers(data.runtime.worldPursuers, size, config)
    if (data.runtime.weather != null) {
      if (!isObject(data.runtime.weather)) fail('Invalid save file: runtime weather is invalid.')
      if (data.runtime.weather.phase != null && typeof data.runtime.weather.phase !== 'string') {
        fail('Invalid save file: runtime weather phase is invalid.')
      }
      validateOptionalFiniteNumber(data.runtime.weather.elapsedMs, 'runtime weather elapsedMs')
      validateOptionalFiniteNumber(data.runtime.weather.flashCooldownMs, 'runtime weather flashCooldownMs')
      validateOptionalFiniteNumber(data.runtime.weather.lightningBursts, 'runtime weather lightningBursts')
      validateOptionalFiniteNumber(data.runtime.weather.lightningNextBurstMs, 'runtime weather lightningNextBurstMs')
      validateOptionalFiniteNumber(data.runtime.weather.phaseEndsAt, 'runtime weather phaseEndsAt')
      validateOptionalFiniteNumber(data.runtime.weather.precipIntensity, 'runtime weather precipIntensity')
      validateOptionalFiniteNumber(data.runtime.weather.rainIntensity, 'runtime weather rainIntensity')
      validateOptionalFiniteNumber(data.runtime.weather.sandIntensity, 'runtime weather sandIntensity')
      validateOptionalFiniteNumber(data.runtime.weather.snowIntensity, 'runtime weather snowIntensity')
      validateOptionalFiniteNumber(data.runtime.weather.windIntensity, 'runtime weather windIntensity')
      validateOptionalFiniteNumber(data.runtime.weather.windTargetX, 'runtime weather windTargetX')
      validateOptionalFiniteNumber(data.runtime.weather.windX, 'runtime weather windX')
    }
  }
  if (data.config != null && !isObject(data.config)) {
    fail('Invalid save file: config is invalid.')
  }

  return data as SerializedSave
}
