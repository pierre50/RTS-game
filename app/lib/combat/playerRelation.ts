import { PLAYER_TYPES } from '../../constants'
import { factionIdForCivilization } from '../campaign/playerRoster'
import { isNeutralPlayer } from '../playerState'
import type { GameContextLike } from '../../types/context'
import type { PlayerLike } from '../../types/player'
import type { FactionRelationState } from '../../types/save'

/** Relation to the active player, shared by the map legend and territory HUD. */
export function playerRelation(
  context: Pick<GameContextLike, 'player' | 'getCampaignFactions'>,
  owner: PlayerLike
): FactionRelationState {
  const viewer = context.player
  if (owner === viewer || owner.isPlayed) return 'allied'
  if (isNeutralPlayer(owner) || isNeutralPlayer(viewer)) return 'neutral'
  if (viewer?.factionId && viewer.factionId === owner.factionId) return 'allied'
  // Respect actual hostility, including retaliation and legacy games without factions.
  if (viewer && (owner.isEnemy?.(viewer) || viewer.isEnemy?.(owner))) return 'hostile'
  if (owner.type === PLAYER_TYPES.bandits) return 'hostile'
  const factions = context.getCampaignFactions?.()
  const factionId = owner.factionId ?? (owner.civ ? factionIdForCivilization(owner.civ) : undefined)
  const faction = factionId ? factions?.[factionId] : undefined
  if (faction) return faction.relationState
  if (viewer?.team != null && viewer.team === owner.team) return 'allied'
  return owner.diplomacy ?? 'neutral'
}
