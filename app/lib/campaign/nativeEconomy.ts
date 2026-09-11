type NativeEconomyPlayer = {
  type?: string
  isPlayed?: boolean
  civ?: string
  factionId?: string | null
  buildings?: { type: string; isBuilt?: boolean; isDead?: boolean; isDestroyed?: boolean }[]
  context?: { map?: { mapType?: string; settlements?: unknown[] } }
}

/** Economic familiarity grants no viewers and no knowledge of other players. */
export function knowsNativeResources(player: NativeEconomyPlayer | undefined): boolean {
  if (!player || player.type !== 'AI' || player.isPlayed) return false
  const map = player.context?.map
  if (!map || map.mapType === 'interior') return false
  if (!player.buildings?.some(b => b.type === 'TownCenter' && b.isBuilt && !b.isDead && !b.isDestroyed)) return false
  return (map.settlements ?? []).some(value => {
    const settlement = value as { kind?: string; civ?: string; factionId?: string }
    return (
      settlement &&
      (settlement.kind === 'village' || settlement.kind === 'city') &&
      (settlement.factionId
        ? settlement.factionId === player.factionId
        : Boolean(settlement.civ && settlement.civ === player.civ))
    )
  })
}
