import { definedProperties } from '../../../lib/definedProperties'
import { Assets } from 'pixi.js'
import { getConfiguredActionFrameSequence } from '../../../lib/animations/actionFrameSequences'
import { getBuildingShelterCapacity } from '../../../lib/buildings/buildingOccupancy'
import { simulateOfflineWorld } from '../../../services/world/OfflineWorldSimulation'
import type { AnimalConfig, BuildingConfig, ResourceConfig, UnitConfig } from '../../../types/config'
import type { SerializedSave } from '../../../types/save'
import type { MapGenerationMap, SavedGameData } from '../MapGenerationTypes'

type OfflineSpriteSheet = {
  animations?: Record<string, unknown[]>
  textures?: Record<string, unknown>
  data?: { animationSpeed?: number }
}

const WORK_ACTION: Record<string, string> = {
  builder: 'build',
  woodcutter: 'chopwood',
  forager: 'forageberry',
  farmer: 'farm',
  stoneminer: 'minestone',
  goldminer: 'minegold',
  hunter: 'takemeat',
}

export function offlineWorkCycleMs(config: UnitConfig, work: string): number {
  const action = WORK_ACTION[work]
  const allAssets = config.allAssets as Record<string, { actionSheet?: string }> | undefined
  const sheetName = allAssets?.[work]?.actionSheet
  const sheet: OfflineSpriteSheet | undefined = sheetName ? Assets.cache.get(sheetName) : undefined
  const sequence = getConfiguredActionFrameSequence({ work, action: action ?? null })
  const frameCount = sequence?.length ?? Object.values(sheet?.animations ?? {})[0]?.length ?? 6
  const animationMs = (frameCount / (Math.max(0.01, sheet?.data?.animationSpeed ?? 0.3) * 60)) * 1000
  const cost = action ? Number((config.energyCosts as Record<string, number> | undefined)?.[action]) || 0 : 0
  const regen = Math.max(0.1, Number(config.energyRegenRate) || 3.1)
  const recoveryMs = (cost / regen) * 1000 + Math.max(0, Number(config.energyRegenDelay) || 0)
  return Math.max(animationMs, recoveryMs)
}

export function applyOfflineWorldSimulation(map: MapGenerationMap, data: SavedGameData): void {
  const fromElapsedMs = data.runtime?.offlineFromElapsedMs
  const toElapsedMs = data.runtime?.dayNightElapsedMs
  if (fromElapsedMs == null || toElapsedMs == null || toElapsedMs <= fromElapsedMs) return
  const players = map.context.players
  const config = Assets.cache.get('config') as
    | { resources?: Record<string, ResourceConfig>; animals?: Record<string, AnimalConfig> }
    | undefined
  const wheatAssets = config?.resources?.Wheat?.assets
  const wheatSheet: OfflineSpriteSheet | undefined =
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
    buildingCapacity: (index, type) =>
      getBuildingShelterCapacity(
        definedProperties({ type, shelterCapacity: buildingConfig(index, type).shelterCapacity })
      ) ||
      Number(buildingConfig(index, type).increasePopulation) ||
      0,
    cycleMs: (index, work) => {
      const key = `${index}:${work}`
      const cached = cycles.get(key)
      if (cached !== undefined) return cached
      const cycle = offlineWorkCycleMs(unitConfig(index, 'Villager'), work)
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
