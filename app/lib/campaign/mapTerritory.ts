import { PLAYER_TYPES } from '../../constants'
import type { GameContextLike } from '../../types/context'
import { isPlayerEliminated } from '../playerState'

type TerritoryEntity = {
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

export type TerritorySettlement = {
  kind?: string
  civ?: string
  factionId?: string | null
  region?: { x: number; y: number }
}

export function territoryPlayerKey(player: TerritoryPlayer): string | undefined {
  return player.factionId || player.civ || player.label
}

function hasTerritoryBuildings(player: TerritoryPlayer): boolean {
  return Boolean(
    player.buildings?.some(building => !building.isDead && !building.isDestroyed && (building.hitPoints ?? 0) > 0)
  )
}

export function findMapTerritoryOwner<T extends TerritoryPlayer>(
  players: readonly T[],
  settlements: readonly TerritorySettlement[] = []
): T | null {
  const residents = players.filter(
    player =>
      player.type !== PLAYER_TYPES.bandits &&
      player.type !== PLAYER_TYPES.gaia &&
      // The hero is removed from regional saves while travelling; their base still owns the region.
      (!isPlayerEliminated(player) || (player.isPlayed && hasTerritoryBuildings(player)))
  )
  const native = residents.find(player =>
    Boolean(
      hasTerritoryBuildings(player) &&
        settlements.some(
          settlement =>
            (settlement.kind === 'village' || settlement.kind === 'city') &&
            (settlement.factionId
              ? settlement.factionId === player.factionId
              : Boolean(settlement.civ && settlement.civ === player.civ))
        )
    )
  )
  if (native) return native
  // A base claims an empty or conquered region; travelling units do not.
  return residents.find(hasTerritoryBuildings) ?? null
}

export function currentMapTerritoryOwner(context: Pick<GameContextLike, 'map' | 'players'>) {
  const region = context.map?.worldRegion
  const settlements = (context.map?.worldManifest?.settlements ?? []) as TerritorySettlement[]
  return findMapTerritoryOwner(
    context.players ?? [],
    settlements.filter(settlement => region && settlement.region?.x === region.x && settlement.region?.y === region.y)
  )
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
