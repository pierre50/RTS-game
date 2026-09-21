import { BUILDING_TYPES } from '../../constants'

type ClaimBuilding = {
  type?: string
  isBuilt?: boolean
  isDead?: boolean
  isDestroyed?: boolean
  hitPoints?: number
}

type ClaimPlayer = {
  factionId?: string | null
  buildings?: ClaimBuilding[]
}

function isLivingTownCenter(building: ClaimBuilding): boolean {
  return (
    building.type === BUILDING_TYPES.townCenter &&
    !building.isDead &&
    !building.isDestroyed &&
    (building.hitPoints == null || building.hitPoints > 0)
  )
}

export function isTerritoryTownCenter(building: ClaimBuilding): boolean {
  return isLivingTownCenter(building) && building.isBuilt === true && (building.hitPoints ?? 0) > 0
}

export function townCenterLimitReached(owner: ClaimPlayer, players: readonly ClaimPlayer[]): boolean {
  return [owner, ...players].some(player =>
    player.buildings?.some(
      building =>
        isLivingTownCenter(building) &&
        (building.isBuilt || player === owner || Boolean(owner.factionId && owner.factionId === player.factionId))
    )
  )
}

/** Completion callbacks run sequentially: the first completed center removes competing sites
 * before another worker can finish them, including during the same simulation update. */
export function competingTownCenterSites<T extends ClaimBuilding>(
  winner: ClaimBuilding,
  players: readonly { buildings?: T[] }[]
): T[] {
  if (!isTerritoryTownCenter(winner)) return []
  return players.flatMap(player =>
    (player.buildings ?? []).filter(
      building => building !== winner && isLivingTownCenter(building) && !building.isBuilt
    )
  )
}
