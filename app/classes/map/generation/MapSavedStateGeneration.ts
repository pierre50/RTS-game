import { clearDeferredVillages } from '../../../services/world/distantVillages/DeferredVillageStore'
import { FAMILY_TYPES } from '../../../constants'
import { traceLoad } from '../../../lib/loadDiagnostics'
import { groupPlayersInteriorBuildings, isDerivedInteriorHorse } from '../../../serialization/InteriorBuildingSave'
import { resourceData } from '../../../serialization/ResourceSaveData'
import { clearNaturalGrowth } from '../../../services/NaturalGrowthQueue'
import { clearWildlifeStore } from '../../../services/wildlife/WildlifeStore'
import { Cell } from '../../cell'
import { getPackedCellStore } from '../../cell/PackedCellRegistry'
import { AI, Gaia } from '../../players'
import { CompactResourceSet } from '../../resources/CompactResourceSet'
import type { MapGenerationMap, SavedGameData } from '../MapGenerationTypes'
import { applyOfflineWorldSimulation } from './MapOfflineWorldSimulation'
import { restoreSavedEntities, restoreSavedPlayers, restoreSavedResources, runtimeContext } from './MapSavedEntities'
export { restoreSavedEntities, restoreSavedPlayers, restoreSavedResources } from './MapSavedEntities'

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

  restoreSavedEntities(map, players, animals, context, runtime?.dayNightElapsedMs ?? 0)
  finishSavedStateRestore(map, { bakeTerrain: true })
}

export function clearGeneratedGameplayState(map: MapGenerationMap): void {
  clearDeferredVillages(map)
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
      traceLoad('save.restoreEntities', () =>
        restoreSavedEntities(map, players, animals, context, runtime?.dayNightElapsedMs ?? 0)
      )
      finishSavedStateRestore(map)
    },
  }
}
