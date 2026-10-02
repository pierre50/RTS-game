import { Assets } from 'pixi.js'
import { offlineWorkCycleMs } from '../../../lib/economy/configuredWorkTiming'
import type { WorkSpriteSheet } from '../../../lib/economy/workTiming'
import { simulateOfflineWorld } from '../../../services/world/offline/OfflineWorldSimulation'
import type { AnimalConfig, BuildingConfig, ResourceConfig, UnitConfig } from '../../../types/config'
import type { SerializedSave } from '../../../types/save'
import type { MapGenerationMap, SavedGameData } from '../MapGenerationTypes'

export function applyOfflineWorldSimulation(map: MapGenerationMap, data: SavedGameData): void {
  const fromElapsedMs = data.runtime?.offlineFromElapsedMs
  const toElapsedMs = data.runtime?.dayNightElapsedMs
  if (fromElapsedMs == null || toElapsedMs == null || toElapsedMs <= fromElapsedMs) return
  const players = map.context.players
  const config = Assets.cache.get('config') as
    | { resources?: Record<string, ResourceConfig>; animals?: Record<string, AnimalConfig> }
    | undefined
  const wheatAssets = config?.resources?.Wheat?.assets
  const wheatSheet: WorkSpriteSheet | undefined =
    typeof wheatAssets === 'string' ? Assets.cache.get(wheatAssets) : undefined
  const buildingConfig = (index: number, type: string): BuildingConfig =>
    players[index]?.config?.buildings?.[type] ?? {}
  const unitConfig = (index: number, type: string): UnitConfig => players[index]?.config?.units?.[type] ?? {}
  const cycles = new Map<string, number>()
  // SavedPlayer is a narrower restore view of the same serialized player records.
  const state = data as SerializedSave
  simulateOfflineWorld(state, {
    fromElapsedMs,
    toElapsedMs,
    terrain: map.grid,
    buildingConfig,
    unitConfig,
    animalConfig: type => config?.animals?.[type] ?? {},
    isKnown: (index, resource) =>
      Boolean(map.revealEverything || players[index]?.views?.isViewed(resource.i, resource.j)),
    wheatMatureFrame: Math.max(0, Object.keys(wheatSheet?.textures ?? {}).length - 1),
    cycleMs: (index, work, action) => {
      const key = `${index}:${work}:${action ?? ''}`
      const cached = cycles.get(key)
      if (cached !== undefined) return cached
      const cycle = offlineWorkCycleMs(unitConfig(index, 'Villager'), work, action)
      cycles.set(key, cycle)
      return cycle
    },
  })
  state.players.forEach((saved, index) => {
    const player = players[index]
    if (!player) return
    if (saved.population != null) player.population = saved.population
    if (saved.populationMax != null) player.populationMax = saved.populationMax
  })
}
