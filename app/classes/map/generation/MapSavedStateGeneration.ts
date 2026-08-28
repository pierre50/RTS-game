import { Resource } from '../../Resource'
import { Human, AI, Gaia, Player } from '../../players'
import { getGaiaAnimals } from '../../../lib'
import { rehydrateAIKnowledge } from '../../../services/FogOfWar'
import { FAMILY_TYPES, PLAYER_TYPES, RESOURCE_TYPES } from '../../../constants'
import { Cell } from '../../cell'
import {
  processUnit,
  restoreAIState,
  restoreBuildingAssignments,
  restorePlayerEntitiesFromSave,
  restorePlayerViewsAndFog,
  restoreSelection,
} from '../MapSaveRestore'
import { PORTAL_RESOURCE_TYPE, reservePortalFootprint } from '../MapPortalPlacement'
import type { GameContextLike } from '../../../types/context'
import type { PlayerLike } from '../../../types/player'
import type { ResourceOptions } from '../../Resource'
import type { ResourceEntity } from '../../../types/entities'
import type { SaveEntityState } from '../../../types/save'
import type { GaiaRespawnSlot, MapGenerationMap, SavedGameData } from '../MapGenerationTypes'
import type { SavedPlayer } from '../MapSaveRestoreTypes'

function runtimeContext(map: MapGenerationMap): GameContextLike {
  const { context } = map
  if (!context.app || !context.gamebox || !context.map || !context.scheduler) {
    throw new Error('Map generation requires a runtime context')
  }
  return context as GameContextLike
}

function createGaiaRespawnSlot(animal: SaveEntityState, context: GameContextLike, owner: PlayerLike): GaiaRespawnSlot {
  return {
    ...animal,
    context,
    family: FAMILY_TYPES.animal,
    isDestroyed: true,
    owner,
  }
}

function createResourceFromState(resource: ResourceOptions, map: MapGenerationMap): ResourceEntity {
  const resourceState =
    resource.type === RESOURCE_TYPES.wheat && resource.currentFrame == null && resource.startsMature == null
      ? { ...resource, startsMature: true }
      : resource
  const instance = map.addChild(new Resource(resourceState, runtimeContext(map)))
  if (instance.type === PORTAL_RESOURCE_TYPE) {
    reservePortalFootprint(instance, map.grid)
  }
  return instance
}

export function restoreSavedPlayers(
  map: MapGenerationMap,
  players: SavedPlayer[],
  runtime?: SavedGameData['runtime']
): void {
  const classMap: Record<string, typeof Human | typeof AI | typeof Player> = {
    Human,
    AI,
    [PLAYER_TYPES.bandits]: Player,
  }
  const context = runtimeContext(map)
  map.context.players = players.map((player: SavedPlayer) => {
    const PlayerClass = classMap[player.type] ?? Player
    const restoredPlayer = new PlayerClass(
      {
        ...player,
        corpses: [],
        buildings: [],
        units: [],
        ...(player.type === PLAYER_TYPES.ai ? { difficulty: map.difficulty } : {}),
      },
      context
    )
    if (player.isPlayed) map.context.player = restoredPlayer
    return restoredPlayer
  })
  if (Number.isFinite(runtime?.elapsedMs) && map.context.scheduler) {
    map.context.scheduler.elapsedMs = Math.max(0, runtime?.elapsedMs ?? 0)
  }
}

export function restoreSavedResources(
  map: MapGenerationMap,
  resources: SaveEntityState[],
  naturalResourceRespawnSlots?: SaveEntityState[]
): void {
  map.resources = new Set(resources.map(resource => createResourceFromState(resource, map)))
  map.naturalResourceRespawnSlots = [...(naturalResourceRespawnSlots ?? [])]
}

export function restoreSavedEntities(
  map: MapGenerationMap,
  players: SavedPlayer[],
  animals: SaveEntityState[],
  context: GameContextLike
): void {
  map.context.players.forEach((player, index) => restorePlayerEntitiesFromSave(player, players[index]))
  const gaia = map.gaia instanceof Gaia ? map.gaia : null
  animals.forEach(animal => {
    if (!gaia) return
    if (animal.isDestroyed)
      (gaia.animals as unknown as GaiaRespawnSlot[]).push(createGaiaRespawnSlot(animal, context, gaia))
    else gaia.createAnimal(animal)
  })

  getGaiaAnimals(gaia)
    .filter(animal => !animal.isDestroyed)
    .forEach(animal => processUnit(animal, map))

  map.context.players.forEach((player, index) => {
    const savedPlayer = players[index]
    restorePlayerViewsAndFog(player, map)
    restoreBuildingAssignments(player, savedPlayer?.buildings || [], map)
    rehydrateAIKnowledge(player, map)
    restoreAIState(player, savedPlayer, map)
    player.units.forEach(unit => processUnit(unit, map))
    restoreSelection(player, savedPlayer, map)
  })
}

export function finishSavedStateRestore(
  map: MapGenerationMap,
  { bakeTerrain = false }: { bakeTerrain?: boolean } = {}
): void {
  map._fogInitComplete = true
  map._flushFogQueue()
  if (bakeTerrain) map.bakeTerrainToChunks()
  map.ready = true
}

export function generateFromJSON(map: MapGenerationMap, data: SavedGameData): void {
  const { map: savedMap, players, camera, resources, naturalResourceRespawnSlots, animals, runtime } = data
  const context = runtimeContext(map)
  const { menu, controls } = context
  map.removeChildren()
  map.clearRenderChunks()
  map.resetRandom()
  map.size = savedMap.length - 1
  map.invalidateReliefCoastDistances()

  restoreSavedPlayers(map, players, runtime)

  map._initFogChunks()
  const gaia = new Gaia(context)
  map.gaia = gaia

  for (let i = 0; i <= map.size; i++) {
    const line = savedMap[i]
    for (let j = 0; j <= map.size; j++) {
      if (!map.grid[i]) {
        map.grid[i] = []
      }
      const cell = line[j]
      const newCell = new Cell({ i, j, z: cell.z ?? 0, type: cell.type, fogSprites: cell.fogSprites ?? [] }, context)
      map.addChild(newCell)
      map.grid[i][j] = newCell
    }
  }
  map._indexFogChunkCells()

  map.fillWaterGaps()
  map.normalizeWaterTopology()
  restoreSavedResources(map, resources, naturalResourceRespawnSlots)

  map.rebuildTerrainAppearance()

  if (!map.revealEverything) {
    for (let i = 0; i <= map.size; i++) {
      for (let j = 0; j <= map.size; j++) {
        map.grid[i][j].setFog()
      }
    }
  }

  controls?.setCamera?.(camera.x, camera.y, true)
  menu?.init?.()
  if (menu?.isMiniMapActive?.() !== false) menu?.updateResourcesMiniMap()

  restoreSavedEntities(map, players, animals, context)
  finishSavedStateRestore(map, { bakeTerrain: true })
}

export function clearGeneratedGameplayState(map: MapGenerationMap): void {
  const dynamicFamilies = new Set([
    FAMILY_TYPES.animal,
    FAMILY_TYPES.building,
    FAMILY_TYPES.projectile,
    FAMILY_TYPES.resource,
    FAMILY_TYPES.unit,
  ])
  for (const child of [...(map.children || [])]) {
    if (!child.family || !dynamicFamilies.has(child.family)) continue
    child.stopInterval?.()
    child.stopTimeout?.()
    child.animalBehavior?.stop?.()
    child.isDestroyed = true
    map.removeChild(child)
    child.destroy?.({ children: true, texture: false, textureSource: false })
  }
  for (const row of map.grid || []) {
    for (const cell of row || []) {
      cell.has = null
      cell.solid = false
      cell.corpses?.clear?.()
    }
  }
  map.resources = new Set()
  map.naturalResourceRespawnSlots = []
  map.instanceBuckets = null
  map.context.players = []
  map.context.player = null
  map.gaia = new Gaia(runtimeContext(map))
}

export function applySavedStateToGeneratedMap(map: MapGenerationMap, data: SavedGameData): void {
  const { players, camera, resources, naturalResourceRespawnSlots, animals, runtime } = data
  const context = runtimeContext(map)
  const { menu, controls } = context

  clearGeneratedGameplayState(map)
  restoreSavedPlayers(map, players, runtime)

  restoreSavedResources(map, resources, naturalResourceRespawnSlots)

  controls?.setCamera?.(camera.x, camera.y, true)
  menu?.init?.()
  if (menu?.isMiniMapActive?.() !== false) menu?.updateResourcesMiniMap()

  restoreSavedEntities(map, players, animals, context)
  finishSavedStateRestore(map)
}
