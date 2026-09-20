import { isTutorialActive } from '../tutorial/TutorialState'
import { PLAYER_TYPES } from '../../constants'
import { DAY_NIGHT_CONFIG } from '../../config/gameplay'
import { getPlayerResourceTotals } from '../../lib/resources/playerResourceTotals'
import { simulateOfflineWorld } from './OfflineWorldSimulation'
import { isLiving, type OfflineTerrainCell } from './OfflineWorldSpatial'
import { savedResourceOwner, type OfflineWorkRules } from './OfflineWorldWork'
import type { CampaignSave, RegionEconomySave, SerializedSave } from '../../types/save'

export type EconomyRules = (state: SerializedSave) => OfflineWorkRules

export function materializeInitialEconomy(
  generated: SerializedSave,
  economy: SerializedSave,
  elapsedMs: number
): SerializedSave {
  const result = structuredClone(generated)
  const factions = new Set(economy.players.map(player => player.factionId).filter(Boolean))
  result.players = [
    ...result.players.filter(player => player.isPlayed || !player.factionId || !factions.has(player.factionId)),
    ...structuredClone(economy.players),
  ]
  result.resources = structuredClone(economy.resources)
  result.naturalResourceRespawnSlots = structuredClone(economy.naturalResourceRespawnSlots ?? [])
  result.runtime = { ...result.runtime, dayNightElapsedMs: elapsedMs }
  delete result.runtime.offlineFromElapsedMs
  return result
}

export function economyAfterWorldSave(campaign: CampaignSave, worldId: string, state: SerializedSave) {
  const regionId = economyRegionId(state)
  const previous = regionId ? campaign.economy?.regions[regionId] : undefined
  if (!previous || !campaign.economy) return campaign.economy
  const region = { ...previous, worldId, simulatedUntilMs: state.runtime?.dayNightElapsedMs ?? 0 }
  delete region.initialState
  summarizeEconomy(region, state)
  return { ...campaign.economy, regions: { ...campaign.economy.regions, [region.regionId]: region } }
}

export function economyRegionId(state: SerializedSave): string | undefined {
  if (state.world?.mapType === 'interior' || state.config?.mapType === 'interior') return undefined
  return state.world?.worldRegionId ?? state.config?.worldRegionId ?? undefined
}

export function encodeEconomyTerrain(terrain: (OfflineTerrainCell | null | undefined)[][]): string[] {
  return terrain.map(row =>
    Array.from({ length: row.length }, (_, j) => {
      const cell = row[j]
      if (!cell || cell.terrainHidden || cell.border) return '#'
      if (cell.category === 'Water') return '~'
      return cell.waterBorder || cell.inclined ? ':' : '.'
    }).join('')
  )
}

export function encodeEconomyElevation(terrain: (OfflineTerrainCell | null | undefined)[][]): string[] {
  return terrain.map(row =>
    Array.from({ length: row.length }, (_, j) => Math.max(0, Math.min(35, Math.round(row[j]?.z ?? 0))).toString(36)).join(
      ''
    )
  )
}

export function decodeEconomyTerrain(rows: string[], elevationRows?: string[]): (OfflineTerrainCell | null)[][] {
  return rows.map((row, i) =>
    Array.from(row, (code, j) =>
      code === '#'
        ? null
        : {
            category: code === '~' ? 'Water' : 'Land',
            waterBorder: code === ':',
            z: elevationRows?.[i]?.[j] ? parseInt(elevationRows[i][j], 36) : 0,
          }
    )
  )
}

// Rival AI factions and the player's own colonies both get a summary; Bandits/Gaia have no
// economy worth reporting.
const SUMMARIZED_PLAYER_TYPES = new Set<string>([PLAYER_TYPES.ai, PLAYER_TYPES.human])

export function summarizeEconomy(region: RegionEconomySave, state: SerializedSave): void {
  region.summaries = {}
  for (const player of state.players) {
    if (!SUMMARIZED_PLAYER_TYPES.has(player.type ?? '') || !player.factionId) continue
    const buildings: Record<string, number> = {}
    const military: Record<string, number> = {}
    let idleWorkers = 0
    for (const building of player.buildings ?? []) {
      if (isLiving(building) && building.isBuilt) buildings[building.type] = (buildings[building.type] ?? 0) + 1
    }
    for (const unit of player.units ?? []) {
      if (!isLiving(unit)) continue
      if (unit.type === 'Villager' && unit.inactif) idleWorkers++
      else if (unit.type !== 'Villager' && unit.type !== 'Hero') military[unit.type] = (military[unit.type] ?? 0) + 1
    }
    region.summaries[player.factionId] = {
      population: player.population ?? 0,
      populationMax: player.populationMax ?? 0,
      stocks: getPlayerResourceTotals(savedResourceOwner(player, state.players), { includeHero: false }),
      military,
      buildings,
      constructionProjects: (player.buildings ?? []).filter(b => isLiving(b) && !b.isBuilt).length,
      ...(player.offlineBuildingDecision ? { constructionDecision: player.offlineBuildingDecision } : {}),
      trainingProjects: (player.buildings ?? []).reduce((n, b) => n + (b.trainingQueue?.length ?? 0), 0),
      idleWorkers,
    }
  }
}

export function captureEconomyRegion(
  campaign: CampaignSave,
  state: SerializedSave,
  terrain: (OfflineTerrainCell | null | undefined)[][]
): void {
  const regionId = economyRegionId(state)
  if (!regionId) return
  campaign.economy ??= { version: 1, regions: {} }
  const region = campaign.economy.regions[regionId] ?? {
    regionId,
    terrain: encodeEconomyTerrain(terrain),
    elevation: encodeEconomyElevation(terrain),
    simulatedUntilMs: 0,
    summaries: {},
  }
  const world = campaign.worlds[campaign.currentWorldId]
  if (!world || economyRegionId(world.state) !== regionId) return
  world.state = state
  region.worldId = world.id
  delete region.initialState
  region.simulatedUntilMs = state.runtime?.dayNightElapsedMs ?? 0
  campaign.economy.regions[regionId] = region
  summarizeEconomy(region, state)
}

function assignIdleEconomyWorkers(state: SerializedSave): void {
  for (const player of state.players) {
    if (player.type !== 'AI') continue
    const construction = (player.buildings ?? []).some(b => isLiving(b) && !b.isBuilt)
    let workers = 0
    for (const unit of player.units ?? []) {
      if (unit.type !== 'Villager' || !isLiving(unit) || unit.trainingTargetType || unit.followingHero) continue
      if (unit.autonomousJob || unit.work || (unit.action && unit.action !== 'move')) continue
      unit.autonomousJob = construction && workers === 0 ? 'construction' : workers % 3 < 2 ? 'food' : 'wood'
      workers++
    }
  }
}

/** Advance only detached data. The currently running region remains owned by its runtime. */
export function advanceCampaignEconomy(
  campaign: CampaignSave,
  toElapsedMs: number,
  activeRegionId: string | undefined,
  rulesFor: EconomyRules
): void {
  if (!Number.isFinite(toElapsedMs) || toElapsedMs < 0) return
  for (const region of Object.values(campaign.economy?.regions ?? {})) {
    if (region.regionId === activeRegionId || toElapsedMs <= region.simulatedUntilMs) continue
    const source = region.worldId ? campaign.worlds[region.worldId]?.state : region.initialState
    if (!source) continue
    if (isTutorialActive(campaign)) {
      region.simulatedUntilMs = toElapsedMs
      source.runtime = { ...source.runtime, dayNightElapsedMs: toElapsedMs }
      delete source.runtime.offlineFromElapsedMs
      continue
    }
    // Commit only after a successful simulation; retries cannot spend or produce twice.
    const state = structuredClone(source)
    state.config = {
      ...state.config,
      difficulty:
        state.config?.difficulty ?? campaign.worlds[campaign.currentWorldId]?.state.config?.difficulty ?? 'medium',
    }
    const terrain = decodeEconomyTerrain(region.terrain, region.elevation)
    const rules = rulesFor(state)
    let cursor = Math.max(region.simulatedUntilMs, state.runtime?.dayNightElapsedMs ?? 0)
    while (cursor < toElapsedMs) {
      const dayMs = DAY_NIGHT_CONFIG.dayLengthMs
      const offset = (((DAY_NIGHT_CONFIG.newDayHour - DAY_NIGHT_CONFIG.startHour + 24) % 24) / 24) * dayMs
      const boundary = offset + (Math.floor((cursor - offset) / dayMs) + 1) * dayMs
      const end = Math.min(toElapsedMs, boundary)
      assignIdleEconomyWorkers(state)
      simulateOfflineWorld(state, { ...rules, terrain, fromElapsedMs: cursor, toElapsedMs: end })
      cursor = end
    }
    if (region.worldId) campaign.worlds[region.worldId]!.state = state
    else region.initialState = state
    region.simulatedUntilMs = toElapsedMs
    summarizeEconomy(region, state)
  }
}
