import { SETTLEMENT_PROFILES, defaultSettlementType } from '../../../config/settlementProfiles'
import { PLAYER_TYPES } from '../../../constants'
import { getBuildingConfigForLevel } from '../../../lib/buildings/buildingLevel'
import type { OfflineWorkRules } from '../offline/OfflineWorldWork'
import type { SavePlayerState, SerializedSave, VillageStartProfile } from '../../../types/save'

export type ProfileFor = (player: SavePlayerState) => VillageStartProfile | undefined
type ChiefHomes = Map<string | undefined, SavePlayerState>

/** Keep the settlement's visual level; stats fall back to the latest authored tier. */
export function startingBuilding(rules: OfflineWorkRules, playerIndex: number, type: string, requestedLevel: number) {
  const base = rules.buildingConfig(playerIndex, type)
  const level = base.levelStats || type === 'Forge' ? requestedLevel : 0
  return { level, config: getBuildingConfigForLevel(base, level) }
}

export function settlementAnchorType(profile: VillageStartProfile): string {
  return profile.settlementType === 'outpost'
    ? 'FireCamp'
    : profile.settlementType === 'village'
      ? 'Granary'
      : 'TownCenter'
}

/** Neutral and bandit owners also have a civilization for their assets, not a village to upgrade. */
export const isSettlementOwner = (player: SavePlayerState): boolean =>
  player.type === PLAYER_TYPES.human || player.type === PLAYER_TYPES.ai

export function startingProfileResolver(profiles: Record<string, VillageStartProfile>): ProfileFor {
  return player =>
    profiles[player.civ ?? ''] ??
    (player.type === PLAYER_TYPES.ai
      ? SETTLEMENT_PROFILES[player.settlementType ?? defaultSettlementType(player.civ ?? player.label ?? '')]
      : undefined)
}

/** Replace only freshly generated baselines, before reserving their footprints. */
export function replaceGeneratedBaselines(
  state: SerializedSave,
  profileFor: ProfileFor,
  rules: OfflineWorkRules,
  skipPlayed: boolean | undefined
): void {
  state.players.forEach((player, index) => {
    if (!isSettlementOwner(player)) return
    if (skipPlayed && player.isPlayed) return
    const profile = profileFor(player)
    if (!profile?.settlementType) return
    player.settlementType = profile.settlementType
    player.developmentMode = profile.developmentMode ?? 'static'
    const center = player.buildings?.find(b => b.type === 'TownCenter')
    if (!center) return
    player.units = []
    center.inventory = { resources: {} }
    const type = settlementAnchorType(profile)
    const { level, config } = startingBuilding(rules, index, type, profile.buildingLevel)
    Object.assign(center, {
      type,
      buildingLevel: level,
      size: Number(config.size) || 1,
      hitPoints: Number(config.totalHitPoints),
      totalHitPoints: Number(config.totalHitPoints),
    })
    player.buildings = [center]
    player.hasBuilt = [center.type]
  })
}

// An owner represents one settlement; several owners may share a faction.
const factionKey = (player: SavePlayerState) => player.factionId ?? player.civ ?? player.label

export function factionChiefHomes(state: SerializedSave, profileFor: ProfileFor): ChiefHomes {
  const chiefHomes: ChiefHomes = new Map()
  for (const player of state.players) {
    if (player.type !== PLAYER_TYPES.ai || !profileFor(player)?.units.Chief) continue
    const previous = chiefHomes.get(factionKey(player))
    if (!previous || (player.settlementType === 'city' && previous.settlementType !== 'city'))
      chiefHomes.set(factionKey(player), player)
  }
  return chiefHomes
}

export function settlementProfile(
  player: SavePlayerState,
  baseProfile: VillageStartProfile,
  chiefHomes: ChiefHomes
): VillageStartProfile {
  const secondary =
    player.type === PLAYER_TYPES.ai && baseProfile.units.Chief && chiefHomes.get(factionKey(player)) !== player
  const profile = secondary
    ? {
        ...baseProfile,
        units: { ...baseProfile.units, Chief: 0, Fantassin: Math.max(0, (baseProfile.units.Fantassin ?? 0) - 2) },
      }
    : baseProfile
  if (!Number.isInteger(profile.buildingLevel) || profile.buildingLevel < 0 || profile.buildingLevel > 2)
    throw new Error('Invalid village starting building level')
  for (const count of [...Object.values(profile.buildings), ...Object.values(profile.units)]) {
    if (!Number.isInteger(count) || count < 0 || count > 200) throw new Error('Invalid village starting count')
  }
  return profile
}
