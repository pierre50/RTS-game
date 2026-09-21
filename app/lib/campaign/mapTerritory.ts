import { PLAYER_TYPES } from '../../constants'
import type { GameContextLike } from '../../types/context'
import { isTerritoryTownCenter } from '../buildings/townCenterClaim'

type TerritoryEntity = {
  type?: string
  hitPoints?: number
  isDead?: boolean
  isDestroyed?: boolean
  isBuilt?: boolean
  action?: string | null
  combatMode?: string | null
}

export type TerritoryPlayer = {
  label?: string
  factionId?: string | null
  civ?: string
  name?: string
  color?: string
  colorHex?: string
  type?: string
  isPlayed?: boolean
  units?: TerritoryEntity[]
  buildings?: TerritoryEntity[]
}

export function territoryPlayerKey(player: TerritoryPlayer): string | undefined {
  return player.factionId || player.civ || player.label
}

export function findMapTerritoryOwner<T extends TerritoryPlayer>(players: readonly T[]): T | null {
  // Territory follows the completed center, independently of units, defeat or native settlement.
  return (
    players.find(
      player =>
        player.type !== PLAYER_TYPES.bandits &&
        player.type !== PLAYER_TYPES.gaia &&
        player.buildings?.some(isTerritoryTownCenter)
    ) ?? null
  )
}

export function currentMapTerritoryOwner(context: Pick<GameContextLike, 'map' | 'players'>) {
  return findMapTerritoryOwner(context.players ?? [])
}

export function constructionTerritoryBlocker(
  context: Pick<GameContextLike, 'map' | 'players'>,
  player: TerritoryPlayer
): TerritoryPlayer | null {
  const owner = currentMapTerritoryOwner(context)
  if (!owner || owner === player || (owner.label && owner.label === player.label)) return null
  // Multiple regional instances of the same faction share their territory.
  if (owner.factionId && owner.factionId === player.factionId) return null
  return owner
}
