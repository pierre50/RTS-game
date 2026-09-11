import { Assets } from 'pixi.js'
import { RESOURCE_STOCKPILE_TYPES } from '../../constants/entities'
import { worldEconomyFactors } from '../../config/worldEconomyBalance'
import { createPlayerData } from '../../config/playerConfig'
import { getBuildingShelterCapacity } from '../../lib/buildings/buildingOccupancy'
import { expandLegacyFoodAmount } from '../../lib/resources/playerResourceTotals'
import { factionIdForCivilization } from '../../lib/campaign/playerRoster'
import { createSquareLocalBlueprint } from '../../classes/map/generation/LocalMapBlueprint'
import { offlineWorkCycleMs } from '../../classes/map/generation/MapOfflineWorldSimulation'
import { serializeGame } from '../../serialization/SaveSerializer'
import { OfflineWorldSpatial } from './OfflineWorldSpatial'
import {
  advanceCampaignEconomy,
  captureEconomyRegion,
  economyRegionId,
  encodeEconomyTerrain,
  summarizeEconomy,
} from './WorldEconomy'
import type { MapBlueprint, MapSettlement } from '../../classes/map/MapGenerationTypes'
import type { PlayerConfigLike } from '../../types/player'
import type { GameContextLike } from '../../types/context'
import type { CampaignSave, RegionEconomySave, SaveEntityState, SerializedSave } from '../../types/save'
import type { ResourceConfig } from '../../types/config'
import type { ResourceAmount } from '../../types/common'
import type { OfflineWorkRules } from './OfflineWorldWork'

function findEconomyCenter(spatial: OfflineWorldSpatial, anchor: { i: number; j: number }, radius: number) {
  for (let ring = 0; ring <= 30; ring++) {
    for (let di = -ring; di <= ring; di++) {
      for (let dj = -ring; dj <= ring; dj++) {
        if (Math.max(Math.abs(di), Math.abs(dj)) !== ring) continue
        const point = { i: anchor.i + di, j: anchor.j + dj }
        let available = true
        for (let i = point.i - radius; i <= point.i + radius && available; i++) {
          for (let j = point.j - radius; j <= point.j + radius; j++) {
            if (!spatial.available({ i, j })) {
              available = false
              break
            }
          }
        }
        if (available) return point
      }
    }
  }
  return null
}

export function economyRulesFor(state: SerializedSave): OfflineWorkRules {
  const base = Assets.cache.get('config') as PlayerConfigLike & { resources: Record<string, ResourceConfig> }
  const configs = state.players.map(player => createPlayerData(base, player.civ ?? 'Hellas'))
  const wheat = base.resources.Wheat
  const sheet = typeof wheat?.assets === 'string' ? Assets.cache.get(wheat.assets) : null
  const cycles = new Map<string, number>()
  const factors = new Map<string, ReturnType<typeof worldEconomyFactors>>()
  const resourceCounts: Record<string, number> = {}
  for (const resource of state.resources) {
    const stored = RESOURCE_STOCKPILE_TYPES[resource.type]
    const key = ['berry', 'wheat', 'meat'].includes(stored) ? 'food' : stored
    if (key && !resource.isDestroyed) resourceCounts[key] = (resourceCounts[key] ?? 0) + 1
  }
  return {
    planBuildings: true,
    abstractVillages: true,
    abstractPotential: Object.fromEntries(
      ['food', 'wood', 'stone', 'gold'].map(key => [key, Math.min(1.2, 0.8 + (resourceCounts[key] ?? 0) / 50)])
    ),
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
      return (
        getBuildingShelterCapacity({ type, shelterCapacity: config?.shelterCapacity ?? 0 }) ||
        Number(config?.increasePopulation) ||
        0
      )
    },
    wheatMatureFrame: Math.max(0, Object.keys(sheet?.textures ?? {}).length - 1),
    cycleMs: (index, work) => {
      const key = `${index}:${work}`
      if (!cycles.has(key)) cycles.set(key, offlineWorkCycleMs(configs[index]?.units.Villager ?? {}, work))
      return cycles.get(key)!
    },
  }
}

function seedRegion(source: MapBlueprint, regionId: string, campaign: CampaignSave, context: GameContextLike) {
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
      totalQuantity: resource.quantity ?? (Number(config.totalQuantity) || 1),
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
    const centerConfig = config.buildings.TownCenter
    const footprint = Math.ceil((Number(centerConfig?.size) || 2) / 2)
    const anchor = findEconomyCenter(spatial, settlement.local, footprint)
    if (!anchor) throw new Error(`No settlement position for ${regionId}:${factionId}`)
    const label = `economy:${regionId}:${factionId}`
    const center: SaveEntityState = {
      ...anchor,
      label: `${label}:center`,
      type: 'TownCenter',
      isBuilt: true,
      totalHitPoints: Number(centerConfig?.totalHitPoints) || 100,
      hitPoints: Number(centerConfig?.totalHitPoints) || 100,
      inventory: {
        resources: expandLegacyFoodAmount(
          (context.map as { startingResources?: ResourceAmount }).startingResources ?? {
            wood: 200,
            food: 200,
            stone: 150,
          }
        ),
      },
    }
    for (let i = center.i - footprint; i <= center.i + footprint; i++) {
      for (let j = center.j - footprint; j <= center.j + footprint; j++) spatial.reserve(center, { i, j })
    }
    const units: SaveEntityState[] = []
    for (let n = 0; n < 5; n++) {
      const point = spatial.findNear(center, 12)
      if (!point) throw new Error(`No starting unit position for ${label}`)
      const type = n === 0 ? 'Chief' : 'Villager'
      const hp = Number(config.units[type]?.totalHitPoints) || 18
      const unit: SaveEntityState = {
        ...point,
        label: `${label}:unit:${n}`,
        type,
        hitPoints: hp,
        totalHitPoints: hp,
        inactif: true,
        gender: n % 2 ? 'female' : 'male',
      }
      units.push(unit)
      spatial.reserve(unit)
    }
    state.players.push({
      label,
      civ: settlement.civ,
      factionId,
      name: faction?.name ?? settlement.civ,
      color: faction?.color,
      type: 'AI',
      isPlayed: false,
      age: 0,
      units,
      buildings: [center],
      population: units.length,
      populationMax: Math.max(
        units.length,
        getBuildingShelterCapacity({ type: 'TownCenter', shelterCapacity: centerConfig?.shelterCapacity ?? 0 }) ||
          Number(centerConfig?.increasePopulation) ||
          10
      ),
    })
  }
  const region: RegionEconomySave = {
    regionId,
    initialState: state,
    terrain: encodeEconomyTerrain(terrain),
    simulatedUntilMs: 0,
    summaries: {},
  }
  summarizeEconomy(region, state)
  return region
}

export async function initializeCampaignEconomy(
  campaign: CampaignSave,
  context: GameContextLike,
  load: (regionId: string, size: number) => Promise<MapBlueprint>
): Promise<void> {
  campaign.economy ??= { version: 1, regions: {} }
  const manifest = context.map.worldManifest
  const candidates = manifest?.maps ?? []
  const settlements = (manifest?.settlements ?? []) as MapSettlement[]
  const current = serializeGame(context)
  captureEconomyRegion(campaign, current, context.map.grid)
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
    const world = Object.values(campaign.worlds).find(w => economyRegionId(w.state) === entry.id)
    const blueprint = await load(entry.id, entry.size)
    const seeded = seedRegion(
      world && !world.state.world?.localGridLayout && !world.state.config?.localGridLayout
        ? { ...blueprint, preserveLegacyGrid: true }
        : blueprint,
      entry.id,
      campaign,
      context
    )
    if (world) {
      delete seeded.initialState
      Object.assign(seeded, { worldId: world.id, simulatedUntilMs: world.state.runtime?.dayNightElapsedMs ?? 0 })
      summarizeEconomy(seeded, world.state)
    }
    campaign.economy.regions[entry.id] = seeded
  }
  advanceCampaignEconomy(campaign, current.runtime?.dayNightElapsedMs ?? 0, economyRegionId(current), economyRulesFor)
  campaign.economy.initialized = true
}

export function updateWorldEconomy(campaign: CampaignSave, context: GameContextLike): void {
  const state = serializeGame(context)
  captureEconomyRegion(campaign, state, context.map.grid)
  advanceCampaignEconomy(campaign, state.runtime?.dayNightElapsedMs ?? 0, economyRegionId(state), economyRulesFor)
}
