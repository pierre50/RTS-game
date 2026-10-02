import { SETTLEMENT_PROFILES, defaultSettlementType } from '../../config/settlementProfiles'
import { StartingVillageLayout } from './StartingVillageLayout'
import { OfflineWorldSpatial, isLiving, type OfflineTerrainCell } from './offline/OfflineWorldSpatial'
import type { OfflineWorkRules } from './offline/OfflineWorldWork'
import {
  factionChiefHomes,
  isSettlementOwner,
  replaceGeneratedBaselines,
  settlementProfile,
  startingProfileResolver,
} from './startingState/StartingProfiles'
import { populateStartingVillage } from './startingState/StartingVillage'
import type { GameConfig, SerializedSave, VillageStartProfile } from '../../types/save'

/** Numeric levels are accepted only when importing an older setup. */
export function villageStartProfiles(config: GameConfig): Record<string, VillageStartProfile> {
  const result: Record<string, VillageStartProfile> = {}
  for (const player of config.players ?? []) {
    if (!player.civ || player.isHuman) continue
    const legacy = player.civilizationLevel
    const type =
      player.settlementType ??
      (legacy ? (legacy === 1 ? 'outpost' : legacy === 2 ? 'village' : 'city') : defaultSettlementType(player.civ))
    result[player.civ] = { ...SETTLEMENT_PROFILES[type], developmentMode: player.developmentMode ?? 'static' }
  }
  return { ...result, ...config.villageStarts }
}

/** Build a detached initial state. Never call this on a restored campaign world. */
export function applyVillageStartingState(
  source: SerializedSave,
  profiles: Record<string, VillageStartProfile>,
  terrain: (OfflineTerrainCell | null | undefined)[][],
  rules: OfflineWorkRules,
  options: { skipPlayed?: boolean } = {}
): SerializedSave {
  const state = structuredClone(source)
  const profileFor = startingProfileResolver(profiles)
  replaceGeneratedBaselines(state, profileFor, rules, options.skipPlayed)
  const chiefHomes = factionChiefHomes(state, profileFor)
  const layout = new StartingVillageLayout(state, terrain, rules)
  state.players.forEach((player, index) => {
    if (options.skipPlayed && player.isPlayed) return
    if (!isSettlementOwner(player)) return
    const baseProfile = profileFor(player)
    if (!baseProfile) return
    populateStartingVillage({ state, player, index, rules, layout }, settlementProfile(player, baseProfile, chiefHomes))
  })
  return state
}

export function placeStartingHeroInVillage(
  state: SerializedSave,
  civilization: string,
  terrain: (OfflineTerrainCell | null | undefined)[][],
  rules: OfflineWorkRules
): void {
  const host = state.players.find(p => !p.isPlayed && p.civ === civilization)
  const center = host?.buildings?.find(
    b => ['TownCenter', 'Granary', 'FireCamp'].includes(b.type) && b.isBuilt && isLiving(b)
  )
  const hero = state.players.find(p => p.isPlayed)?.units?.find(u => u.type === 'Hero' && isLiving(u))
  if (!center || !hero) throw new Error('Tutorial hero requires a host village and a hero')
  const spatial = new OfflineWorldSpatial(terrain, state, (b, i) => Number(rules.buildingConfig(i, b.type).size) || 2)
  const point = spatial.findNear(center, 12)
  if (!point) throw new Error('No safe hero arrival cell in starting village')
  spatial.move(hero, point)
}
