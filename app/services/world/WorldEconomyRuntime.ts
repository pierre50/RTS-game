import { isContinentWorld } from '../../config/continentWorlds'
import { isLargeMapIsolationTest } from '../../config/largeMapTest'
import { traceLoad, traceLoadAsync } from '../../lib/loadDiagnostics'
import { Assets } from 'pixi.js'
import { worldEconomyFactors } from '../../config/worldEconomyBalance'
import { createPlayerData } from '../../config/playerConfig'
import { getBuildingShelterCapacity, getPopulationCapacityFromBuildings } from '../../lib/buildings/buildingOccupancy'
import { populateVillageBase } from './VillageBaseState'
import { factionIdForCivilization } from '../../lib/campaign/playerRoster'
import { createSquareLocalBlueprint } from '../../classes/map/generation/LocalMapBlueprint'
import { offlineWorkCycleMs } from '../../lib/economy/configuredWorkTiming'
import { serializeGame } from '../../serialization/SaveSerializer'
import { OfflineWorldSpatial } from './OfflineWorldSpatial'
import { applyVillageStartingState } from './VillageStartingState'
import {
  advanceCampaignEconomy,
  captureEconomyRegion,
  economyRegionId,
  encodeEconomyElevation,
  encodeEconomyTerrain,
  summarizeEconomy,
} from './WorldEconomy'
import type { MapBlueprint, MapSettlement } from '../../classes/map/MapGenerationTypes'
import type { PlayerConfigLike } from '../../types/player'
import type { GameContextLike } from '../../types/context'
import type { CampaignSave, RegionEconomySave, SerializedSave, VillageStartProfile } from '../../types/save'
import type { ResourceConfig } from '../../types/config'
import type { OfflineWorkRules } from './OfflineWorldWork'

export function economyRulesFor(state: SerializedSave): OfflineWorkRules {
  const base = Assets.cache.get('config') as PlayerConfigLike & { resources: Record<string, ResourceConfig> }
  const configs = state.players.map(player => createPlayerData(base, player.civ ?? 'Hellas'))
  state.players.forEach((player, index) => {
    if (!['Human', 'AI'].includes(player.type)) return
    player.populationMax = getPopulationCapacityFromBuildings(player.buildings ?? [], configs[index].buildings)
  })
  const wheat = base.resources.Wheat
  const sheet = typeof wheat?.assets === 'string' ? Assets.cache.get(wheat.assets) : null
  const cycles = new Map<string, number>()
  const factors = new Map<string, ReturnType<typeof worldEconomyFactors>>()
  return {
    planBuildings: true,
    abstractVillages: true,
    dailyFactors: (index, day) => {
      const player = state.players[index]
      if (player?.type !== 'AI') return { workEfficiency: 1, arrivalsAllowed: true }
      const key = `${index}:${day}`
      if (!factors.has(key)) {
        const seed = `${state.world?.seed ?? 0}:${state.world?.worldRegionId ?? state.config?.worldRegionId}:${player.factionId ?? player.label ?? index}`
        factors.set(key, worldEconomyFactors(state.config?.difficulty, seed, day))
      }
      return factors.get(key)!
    },
    unitConfig: (index, type) => configs[index]?.units[type] ?? {},
    buildingConfig: (index, type) => configs[index]?.buildings[type] ?? {},
    animalConfig: type => base.animals?.[type] ?? {},
    buildingCapacity: (index, type) => {
      const config = configs[index]?.buildings[type]
      return getBuildingShelterCapacity({ type, ...config })
    },
    wheatMatureFrame: Math.max(0, Object.keys(sheet?.textures ?? {}).length - 1),
    cycleMs: (index, work, action) => {
      const key = `${index}:${work}:${action ?? ''}`
      if (!cycles.has(key)) cycles.set(key, offlineWorkCycleMs(configs[index]?.units.Villager ?? {}, work, action))
      return cycles.get(key)!
    },
  }
}

function seedRegion(
  source: MapBlueprint,
  regionId: string,
  campaign: CampaignSave,
  context: GameContextLike,
  profiles: Record<string, VillageStartProfile> = {}
) {
  const blueprint = createSquareLocalBlueprint(source)
  const base = Assets.cache.get('config') as PlayerConfigLike & { resources: Record<string, ResourceConfig> }
  const state: SerializedSave = {
    camera: { x: 0, y: 0 },
    config: {
      difficulty: context.map.difficulty,
      worldId: context.map.worldId,
      worldRegionId: regionId,
      size: blueprint.size,
      localGridLayout: blueprint.localGridLayout,
    },
    world: {
      seed: blueprint.seed ?? 0,
      size: blueprint.size,
      sourceSize: source.size,
      worldId: context.map.worldId,
      worldRegionId: regionId,
      localGridLayout: blueprint.localGridLayout,
    },
    runtime: { dayNightElapsedMs: 0 },
    players: [],
    resources: [],
    animals: [],
  }
  const terrain = blueprint.terrain.map((row, i) =>
    Array.from({ length: row.length }, (_, j) => {
      const type = row[j]
      return type == null
        ? null
        : { category: String(type) === 'Water' ? 'Water' : 'Land', z: blueprint.relief?.[i]?.[j] ?? 0 }
    })
  )
  for (const [index, resource] of (blueprint.resources ?? []).entries()) {
    const config = base.resources[resource.type]
    if (!config || !terrain[resource.i]?.[resource.j]) continue
    state.resources.push({
      ...resource,
      label: `economy:${regionId}:resource:${index}`,
      quantity: resource.quantity ?? (Number(config.totalQuantity) || 1),
      totalQuantity: resource.totalQuantity ?? resource.quantity ?? (Number(config.totalQuantity) || 1),
      hitPoints: Number(config.totalHitPoints) || 1,
      totalHitPoints: Number(config.totalHitPoints) || 1,
      isNaturalResource: true,
      ...(resource.type === 'Wheat' && resource.startsMature === false ? { currentFrame: 0 } : {}),
    })
  }
  const spatial = new OfflineWorldSpatial(terrain, state, () => 2)
  for (const settlement of blueprint.settlements ?? []) {
    if (!settlement.civ || settlement.civ === context.player?.civ || settlement.kind === 'banditCamp') continue
    const factionId = factionIdForCivilization(settlement.civ)
    const faction = campaign.factions?.[factionId]
    const config = createPlayerData(base, settlement.civ)
    const label = `economy:${regionId}:${factionId}`
    state.players.push({
      label,
      civ: settlement.civ,
      factionId,
      name: faction?.name ?? settlement.civ,
      color: faction?.color,
      type: 'AI',
      isPlayed: false,
      age: 0,
      units: [],
      buildings: [],
    })
    const index = state.players.length - 1
    populateVillageBase(
      state.players[index],
      index,
      settlement.local,
      spatial,
      {
        buildingConfig: (_i, type) => config.buildings[type] ?? {},
        unitConfig: (_i, type) => config.units[type] ?? {},
        buildingCapacity: (_i, type) => getBuildingShelterCapacity({ type, ...config.buildings[type] }),
      },
      context.map.startingResources ?? { wood: 200, food: 200, stone: 150 }
    )
  }
  const initialState = applyVillageStartingState(state, profiles, terrain, economyRulesFor(state))
  const region: RegionEconomySave = {
    regionId,
    initialState,
    terrain: encodeEconomyTerrain(terrain),
    elevation: encodeEconomyElevation(terrain),
    simulatedUntilMs: 0,
    summaries: {},
  }
  summarizeEconomy(region, initialState)
  return region
}

export async function initializeCampaignEconomy(
  campaign: CampaignSave,
  context: GameContextLike,
  load: (regionId: string, size: number) => Promise<MapBlueprint>,
  profiles: Record<string, VillageStartProfile> = {},
  initialState?: SerializedSave
): Promise<void> {
  if (isLargeMapIsolationTest(context.map.worldId) || isContinentWorld(context.map.worldId)) {
    campaign.economy = { version: 1, initialized: true, regions: {} }
    return
  }
  return traceLoadAsync('boot.initializeCampaignEconomy', async () => {
    campaign.economy ??= { version: 1, regions: {} }
    const manifest = context.map.worldManifest
    const candidates = manifest?.maps ?? []
    const settlements = (manifest?.settlements ?? []) as MapSettlement[]
    const current = initialState ?? traceLoad('economy.serializeCurrentRegion', () => serializeGame(context))
    traceLoad('economy.captureCurrentRegion', () => captureEconomyRegion(campaign, current, context.map.grid))
    for (const entry of candidates) {
      if (!entry.id || campaign.economy.regions[entry.id]) continue
      if (
        !settlements.some(
          s =>
            s.civ &&
            s.civ !== context.player?.civ &&
            s.kind !== 'banditCamp' &&
            s.region?.x === entry.region.x &&
            s.region?.y === entry.region.y
        )
      )
        continue
      const regionId = entry.id
      const world = Object.values(campaign.worlds).find(w => economyRegionId(w.state) === regionId)
      const blueprint = await traceLoadAsync('economy.loadRegion', () => load(regionId, entry.size), {
        region: entry.id,
      })
      const seeded = traceLoad(
        'economy.seedRegion',
        () =>
          seedRegion(
            world && !world.state.world?.localGridLayout && !world.state.config?.localGridLayout
              ? { ...blueprint, preserveLegacyGrid: true }
              : blueprint,
            regionId,
            campaign,
            context,
            world ? {} : profiles
          ),
        { region: entry.id }
      )
      if (world) {
        delete seeded.initialState
        Object.assign(seeded, { worldId: world.id, simulatedUntilMs: world.state.runtime?.dayNightElapsedMs ?? 0 })
        summarizeEconomy(seeded, world.state)
      }
      campaign.economy.regions[entry.id] = seeded
    }
    traceLoad('economy.advanceCampaign', () =>
      advanceCampaignEconomy(
        campaign,
        current.runtime?.dayNightElapsedMs ?? 0,
        economyRegionId(current),
        economyRulesFor
      )
    )
    campaign.economy.initialized = true
  })
}

export function updateWorldEconomy(campaign: CampaignSave, context: GameContextLike): void {
  // VillageActivitySystem owns distant production inside a single-region continent.
  if (isContinentWorld(context.map.worldId)) return
  const state = serializeGame(context)
  captureEconomyRegion(campaign, state, context.map.grid)
  advanceCampaignEconomy(campaign, state.runtime?.dayNightElapsedMs ?? 0, economyRegionId(state), economyRulesFor)
}
