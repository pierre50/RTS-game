import { Assets } from 'pixi.js'
import type { LoadedGameConfig, SaveRecord, SerializedSave } from '../types/save'
import { CAMPAIGN_SAVE_FORMAT, getCurrentWorldState, isCampaignSave } from './CampaignSave'
import {
  validateAnimals,
  validateNaturalResourceRespawnSlots,
  validatePlayers,
  validateResources,
} from './SaveEntityValidators'
import { containsCell, validateLocalLayout, validateMap, validateSeedWorld } from './SaveMapValidation'
import { validateRuntimeState } from './SaveRuntimeValidation'
import {
  fail,
  isFiniteNumber,
  isObject,
  type ObjectRecord,
  validateOptionalFiniteNumber,
} from './SaveValidationPrimitives'

function getLoadedConfig(): LoadedGameConfig {
  const config = Assets.cache.get('config')
  if (!config) {
    fail('Invalid save file: game config is not loaded.')
  }
  return config as LoadedGameConfig
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

  validateRuntimeState(data.runtime, size, config)
  if (data.config != null && !isObject(data.config)) {
    fail('Invalid save file: config is invalid.')
  }

  return data as SerializedSave
}
