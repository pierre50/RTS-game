import { clearNaturalGrowth } from '../../../services/NaturalGrowthQueue'
import { installWildlifeStore, clearWildlifeStore, isWildlife } from '../../../services/WildlifeStore'
import { traceLoad } from '../../../lib/loadDiagnostics'
import { resourceData } from '../../../serialization/ResourceSaveData'
import { CompactResourceSet, materializedResources } from '../../resources/CompactResourceSet'
import { getResourceConfig } from '../../ResourceTexture'
import { PASSABLE_RESOURCE_TYPES } from '../../../constants'
import { getPackedCellStore } from '../../cell/PackedCellRegistry'
import { Resource } from '../../Resource'
import { logStartingWheat } from '../../../lib/resources/startingWheatDiagnostics'
import { migrateSavedAge, AGE_RULES_VERSION } from '../../../lib/objectives/ageRules'
import { Human, AI, Gaia, Player } from '../../players'
import { getGaiaAnimals } from '../../../lib'
import { rehydrateAIKnowledge } from '../../../services/UnitPerception'
import { FAMILY_TYPES, PLAYER_TYPES, RESOURCE_TYPES } from '../../../constants'
import { Cell } from '../../cell'
import {
  processUnit,
  restoreCaveOccupants,
  restorePlayerInteriors,
  restoreAIState,
  restoreBuildingAssignments,
  restorePlayerEntitiesFromSave,
  restorePlayerViews,
  restoreSelection,
} from '../MapSaveRestore'
import type { GameContextLike } from '../../../types/context'
import type { PlayerLike } from '../../../types/player'
import type { ResourceOptions } from '../../Resource'
import type { ResourceEntity } from '../../../types/entities'
import type { SaveEntityState } from '../../../types/save'
import type { GaiaRespawnSlot, MapGenerationMap, SavedGameData } from '../MapGenerationTypes'
import type { SavedPlayer } from '../MapSaveRestoreTypes'
import { applyOfflineWorldSimulation } from './MapOfflineWorldSimulation'
import { isDerivedInteriorHorse, groupPlayersInteriorBuildings } from '../../../serialization/InteriorBuildingSave'

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

function createResourceFromState(
  resource: ResourceOptions & { isDead?: boolean; isDestroyed?: boolean },
  map: MapGenerationMap
): ResourceEntity {
  const resourceState =
    resource.type === RESOURCE_TYPES.wheat && resource.currentFrame == null && resource.startsMature == null
      ? { ...resource, startsMature: true }
      : resource
  return Resource.spawn(resourceState, runtimeContext(map))
}

export function restoreSavedPlayers(
  map: MapGenerationMap,
  players: SavedPlayer[],
  runtime?: SavedGameData['runtime']
): void {
  const classMap: Record<string, typeof Human | typeof AI | typeof Player> = {
    Human,
    AI,
    [PLAYER_TYPES.bandits]: AI,
  }
  const context = runtimeContext(map)
  map.context.players = players.map((player: SavedPlayer) => {
    player.age = migrateSavedAge(player.age, player.ageRulesVersion)
    player.ageRulesVersion = AGE_RULES_VERSION
    const PlayerClass = classMap[player.type] ?? Player
    const restoredPlayer = new PlayerClass(
      {
        ...player,
        corpses: [],
        buildings: [],
        units: [],
        ...(player.type === PLAYER_TYPES.ai || player.type === PLAYER_TYPES.bandits
          ? { difficulty: map.difficulty }
          : {}),
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
  const packed = !map.context.editor && getPackedCellStore(map.grid)
  if (packed) {
    const collection = new CompactResourceSet(
      resources.length,
      packed.stride,
      `resource:${map.worldId ?? 'local'}:${map.worldRegionId ?? 'outside'}:${map.seed ?? 0}`,
      type => getResourceConfig().resources[type],
      state => createResourceFromState(state, map),
      runtimeContext(map)
    )
    map.resources = collection
    packed.resourceAt = index => collection.atCell(index)
    for (const resource of resources) {
      if (collection.canPack(resource)) {
        collection.addState(resource)
        const index = resource.i * packed.stride + resource.j
        const extra = packed.extras.get(index)
        if (extra?.has == null && extra) delete extra.has
        if (!PASSABLE_RESOURCE_TYPES.has(resource.type)) packed.flags[index] |= 1
      } else collection.add(createResourceFromState(resource, map))
    }
  } else map.resources = new Set(resources.map(resource => createResourceFromState(resource, map)))
  logStartingWheat(materializedResources(map.resources))
  map.naturalResourceRespawnSlots = [...(naturalResourceRespawnSlots ?? [])]
}

export function restoreSavedEntities(
  map: MapGenerationMap,
  players: SavedPlayer[],
  animals: SaveEntityState[],
  context: GameContextLike
): void {
  map.context.players.forEach((player, index) => restorePlayerEntitiesFromSave(player, players[index], true))
  map.context.players.forEach(restorePlayerInteriors)
  const gaia = map.gaia instanceof Gaia ? map.gaia : null
  const wildlife = installWildlifeStore(map, animals.filter(isWildlife), `wildlife:${map.seed ?? 0}`)
  const interacting = new Set<string>()
  for (const player of players)
    for (const unit of player.units ?? []) {
      for (const ref of [unit.dest, unit.previousDest, unit.realDest]) {
        const label = typeof ref === 'string' ? ref : Array.isArray(ref) ? ref[2] : ref?.label
        if (label) interacting.add(label)
      }
    }
  // Restore encounter participants before resolving unit destinations and combat references.
  for (const animal of animals) {
    if (!isWildlife(animal) || animal.isDestroyed || !gaia) continue
    if (!animal.isFleeing && animal.action !== 'attack' && !interacting.has(animal.label ?? '')) continue
    const cell = map.grid[animal.i]?.[animal.j]
    if (!cell || cell.has) continue
    const saved = wildlife.entries.get(animal.label ?? '')?.state ?? animal
    gaia.createAnimal({ ...saved, ...animal })
  }
  animals
    .filter(animal => !isWildlife(animal))
    .forEach(animal => {
      if (!gaia) return
      if (animal.isDestroyed)
        (gaia.animals as unknown as GaiaRespawnSlot[]).push(createGaiaRespawnSlot(animal, context, gaia))
      else gaia.createAnimal(animal)
    })

  getGaiaAnimals(gaia)
    .filter(animal => !animal.isDestroyed)
    .forEach(animal => processUnit(animal, map))

  restoreCaveOccupants(context, players)
  map.context.players.forEach((player, index) => {
    const savedPlayer = players[index]
    restorePlayerViews(player, map)
    restoreBuildingAssignments(player, savedPlayer?.buildings || [], map)
    rehydrateAIKnowledge(player, map)
    restoreAIState(player, savedPlayer, map)
    const savedUnitsByLabel = new Map(savedPlayer?.units?.map(saved => [saved.label, saved]))
    player.units.forEach(unit => processUnit(unit, map, savedUnitsByLabel.get(unit.label)))
    restoreSelection(player, savedPlayer, map)
  })
}

export function finishSavedStateRestore(
  map: MapGenerationMap,
  { bakeTerrain = false }: { bakeTerrain?: boolean } = {}
): void {
  if (bakeTerrain) map.bakeTerrainToChunks()
  map.ready = true
}

export function generateFromJSON(map: MapGenerationMap, data: SavedGameData): void {
  data.players = groupPlayersInteriorBuildings(data.players)
  data.animals = data.animals.filter(animal => !isDerivedInteriorHorse(animal, data.players))
  const { map: savedMap, players, camera, resources, naturalResourceRespawnSlots, animals, runtime } = data
  const context = runtimeContext(map)
  const { menu, controls } = context
  map.removeChildren()
  map.clearRenderChunks()
  map.resetRandom()
  map.size = savedMap.length - 1
  map.localGridLayout = data.world?.localGridLayout ?? data.config?.localGridLayout
  map.grid = Array.from({ length: savedMap.length }, () => [])
  map.invalidateReliefCoastDistances()

  restoreSavedPlayers(map, players, runtime)

  const gaia = new Gaia(context)
  map.gaia = gaia

  for (let i = 0; i <= map.size; i++) {
    const line = savedMap[i]
    for (let j = 0; j <= map.size; j++) {
      if (!map.grid[i]) {
        map.grid[i] = []
      }
      const cell = line[j]
      if (!cell) continue
      const newCell = new Cell({ i, j, z: cell.z ?? 0, type: cell.type }, context)
      map.addChild(newCell)
      map.grid[i][j] = newCell
    }
  }

  applyOfflineWorldSimulation(map, data)
  restoreSavedResources(map, resources, data.naturalResourceRespawnSlots ?? naturalResourceRespawnSlots)

  map.rebuildTerrainAppearance()

  controls?.setCamera?.(camera.x, camera.y, true)
  menu?.init?.()
  if (menu?.isMiniMapActive?.() !== false) menu?.updateResourcesMiniMap()

  restoreSavedEntities(map, players, animals, context)
  finishSavedStateRestore(map, { bakeTerrain: true })
}

export function clearGeneratedGameplayState(map: MapGenerationMap): void {
  clearWildlifeStore(map)
  clearNaturalGrowth(map)
  // Stop provisional AI tasks before swapping in the saved village roster.
  for (const player of [...map.context.players]) {
    if (player instanceof AI) player.die()
  }
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
  const packed = getPackedCellStore(map.grid)
  if (packed) packed.resourceAt = undefined
  if (packed) for (let index = 0; index < packed.flags.length; index++) packed.flags[index] &= ~1
  const rows = packed ? [packed.changedCells(map.grid)] : map.grid || []
  for (const row of rows) {
    for (const cell of row || []) {
      if (!cell) continue
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
  for (const step of savedStateRestoreSteps(map, data)) step.run()
}

export async function applySavedStateToGeneratedMapAsync(
  map: MapGenerationMap,
  data: SavedGameData,
  onProgress: (stage: string, progress: number) => Promise<void>
): Promise<void> {
  for (const step of savedStateRestoreSteps(map, data)) {
    await onProgress(step.label, step.progress)
    step.run()
  }
}

function* savedStateRestoreSteps(map: MapGenerationMap, data: SavedGameData) {
  yield { label: 'restoringResources', progress: 0, run: () => {} }

  data.players = groupPlayersInteriorBuildings(data.players)
  data.animals = data.animals.filter(animal => !isDerivedInteriorHorse(animal, data.players))
  const { players, camera, naturalResourceRespawnSlots, animals, runtime } = data
  const context = runtimeContext(map)
  const { menu, controls } = context
  const baseline = map.resources instanceof CompactResourceSet ? map.resources : null
  let delta = data.resourceDelta
    ? { resourceDelta: data.resourceDelta, resources: data.resources }
    : baseline?.deltaFromFullSave(data.resources, resourceData)
  if (delta && !baseline) throw new Error('SAVE_RESOURCE_BLUEPRINT_MISMATCH')
  if (delta) baseline!.assertBlueprintDelta(delta.resourceDelta)
  const needsOffline =
    runtime?.offlineFromElapsedMs != null &&
    runtime.dayNightElapsedMs != null &&
    runtime.dayNightElapsedMs > runtime.offlineFromElapsedMs
  if (delta && needsOffline) {
    data.resources = baseline!.expandDelta(delta.resourceDelta, delta.resources, resourceData)
    delete data.resourceDelta
  }

  yield {
    label: 'restoringResources',
    progress: 0.1,
    run: () => {
      traceLoad('save.clearGeneratedState', () => clearGeneratedGameplayState(map))
      traceLoad('save.restorePlayers', () => restoreSavedPlayers(map, players, runtime))
    },
  }
  yield {
    label: 'restoringResources',
    progress: 0.2,
    run: () => {
      traceLoad('save.offlineSimulation', () => applyOfflineWorldSimulation(map, data))
      if (delta && needsOffline) delta = baseline!.deltaFromFullSave(data.resources, resourceData)
      if (delta && baseline) {
        const packed = getPackedCellStore(map.grid)
        if (!packed) throw new Error('SAVE_RESOURCE_BLUEPRINT_MISMATCH')
        map.resources = baseline
        packed.resourceAt = index => baseline.atCell(index)
        for (const extra of packed.extras.values()) if (extra.has == null) delete extra.has
        traceLoad('save.restoreResourceDelta', () =>
          baseline.restoreDelta(delta!.resourceDelta, delta!.resources, index => {
            packed.flags[index] |= 1
          })
        )
        map.naturalResourceRespawnSlots = [...(data.naturalResourceRespawnSlots ?? naturalResourceRespawnSlots ?? [])]
      } else restoreSavedResources(map, data.resources, data.naturalResourceRespawnSlots ?? naturalResourceRespawnSlots)
    },
  }
  yield {
    label: 'restoringCamera',
    progress: 0.6,
    run: () => {
      traceLoad('save.restoreCamera', () => controls?.setCamera?.(camera.x, camera.y, true))
      menu?.init?.()
      if (menu?.isMiniMapActive?.() !== false) menu?.updateResourcesMiniMap()
    },
  }
  yield {
    label: 'restoringEntities',
    progress: 0.7,
    run: () => {
      traceLoad('save.restoreEntities', () => restoreSavedEntities(map, players, animals, context))
      finishSavedStateRestore(map)
    },
  }
}
