import { Assets } from 'pixi.js'
import type { LoadedGameConfig, SaveRecord, SerializedSave } from '../../types/save'
import { getCurrentWorldState, isCampaignSave } from '../CampaignSave'
import { isDerivedInteriorHorse } from '../InteriorBuildingSave'
import {
  validateAnimals,
  validateNaturalResourceRespawnSlots,
  validatePlayers,
  validateResources,
} from './SaveEntityValidators'
import { containsCell, validateLocalLayout, validateMap, validateSeedWorld } from './SaveMapValidation'
import { validateRuntimeState } from './SaveRuntimeValidation'
import { fail, isFiniteNumber, isObject, type ObjectRecord, validateArray } from './SaveValidationPrimitives'
import { validateCampaignRecord } from './CampaignRecordValidation'

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
    validateCampaignRecord(data, getLoadedConfig())
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
  if (data.resourceDelta !== undefined) {
    const delta = data.resourceDelta
    if (
      !isObject(delta) ||
      delta.version !== 1 ||
      !Number.isSafeInteger(delta.count) ||
      Number(delta.count) < 0 ||
      Number(delta.count) > (size + 1) * (size + 1) ||
      typeof delta.signature !== 'string' ||
      !/^[0-9a-f]{1,8}$/.test(delta.signature) ||
      !Array.isArray(delta.removed) ||
      !Array.isArray(delta.updated) ||
      !isObject(data.world) ||
      data.world.pregeneratedBlueprintId == null ||
      Array.isArray(data.map)
    )
      fail('Invalid save file: resource blueprint delta is invalid.')
    const seen = new Set<number>()
    for (const index of [
      ...delta.removed,
      ...delta.updated.map(entry => (isObject(entry) ? entry.index : undefined)),
    ]) {
      if (!Number.isInteger(index) || index < 0 || index >= Number(delta.count) || seen.has(index))
        fail('Invalid save file: resource delta index is invalid.')
      seen.add(index)
    }
    const states = delta.updated.map(entry => entry.state)
    validateResources(states, size, config)
    if (layout)
      for (const state of states)
        if (!containsCell(layout, state.i, state.j)) fail('Invalid save file: resource delta is outside the map.')
  }
  validateNaturalResourceRespawnSlots(data.naturalResourceRespawnSlots, size, config)
  validateArray(data.animals, 'animals')
  data.animals = data.animals.filter(
    animal =>
      !isObject(animal) ||
      !isDerivedInteriorHorse(
        animal as { type?: string; label?: string; tamingStatus?: string },
        data.players as SerializedSave['players']
      )
  )
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
