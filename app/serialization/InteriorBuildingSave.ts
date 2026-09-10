import type { SaveEntityState } from '../types/save'
import { getStableInteriorHorseIndex } from '../lib/horses/stableInteriorHorseIdentity'

type InteriorSaveOwner = {
  label?: string
  factionId?: string | null
  name?: string
  buildings?: Pick<
    SaveEntityState,
    'i' | 'j' | 'label' | 'type' | 'isDead' | 'isDestroyed' | 'stableHorses' | 'horseAmount'
  >[]
}

export function interiorSaveSpaceId(
  owner: string,
  building: Pick<SaveEntityState, 'i' | 'j' | 'label' | 'type'>
): string {
  return `interior:${owner}:${building.label || `${building.i},${building.j},${building.type}`}`
}

/** Also migrates old default decorations whose space id was omitted from the save. */
export function groupInteriorBuildings(buildings: SaveEntityState[], owner: string): SaveEntityState[] {
  const records = buildings.map(building => ({
    ...building,
    ...(building.interiorBuildings ? { interiorBuildings: [...building.interiorBuildings] } : {}),
  }))
  const parents = new Map(records.map(building => [interiorSaveSpaceId(owner, building), building]))
  const roots: SaveEntityState[] = []
  for (const building of records) {
    const explicit = building.spaceId && building.spaceId !== 'outside' ? building.spaceId : null
    const legacy =
      !explicit &&
      typeof building.label === 'string' &&
      building.label.startsWith('interior:') &&
      building.label.includes(':default:')
        ? building.label.slice(0, building.label.lastIndexOf(':default:'))
        : null
    const space = explicit ?? legacy
    if (!space) {
      roots.push(building)
      continue
    }
    const parent = parents.get(space)
    if (!parent || parent === building)
      throw new Error(`Cannot restore interior building ${building.label ?? building.type}: missing parent ${space}`)
    if (parent.spaceId && parent.spaceId !== 'outside') throw new Error('Nested building interiors are not supported')
    parent.interiorBuildings ??= []
    if (building.label && parent.interiorBuildings.some(child => child.label === building.label)) {
      throw new Error(`Duplicate saved interior building ${building.label}`)
    }
    delete building.spaceId
    parent.interiorBuildings.push(building)
  }
  return roots
}

export function normalizeSavedInteriorBuildings(player: {
  label?: string
  factionId?: string
  name?: string
  buildings?: SaveEntityState[]
}): void {
  player.buildings = groupInteriorBuildings(
    player.buildings ?? [],
    player.label || player.factionId || player.name || 'owner'
  )
}

export function isDerivedInteriorHorse(
  animal: { type?: string; label?: string; tamingStatus?: string },
  players: InteriorSaveOwner[]
): boolean {
  if (typeof animal.label !== 'string' || animal.tamingStatus === 'wild') return false
  const index = getStableInteriorHorseIndex({ label: animal.label ?? '' })
  if (animal.type !== 'Horse' || index == null) return false
  return players.some(player =>
    (player.buildings ?? []).some(
      building =>
        building.type === 'Stable' &&
        !building.isDead &&
        !building.isDestroyed &&
        index < (building.stableHorses?.length ?? building.horseAmount ?? 0) &&
        animal.label ===
          `${interiorSaveSpaceId(player.label || player.factionId || player.name || 'owner', building)}:stable-horse:${index}`
    )
  )
}

export function savedBuildingsWithInteriors(buildings: SaveEntityState[]): SaveEntityState[] {
  return buildings.flatMap(building => [
    building,
    ...(!building.isDead && !building.isDestroyed ? (building.interiorBuildings ?? []) : []),
  ])
}

/** Group across every player: location and ownership are independent. */
export function groupPlayersInteriorBuildings<
  T extends { label?: string; factionId?: string | null; name?: string; type?: string; buildings?: SaveEntityState[] },
>(players: T[]): T[] {
  const key = (player: T) => player.label || player.factionId || player.name || 'owner'
  const result = players.map(player => ({
    ...player,
    buildings: (player.buildings ?? []).map(building => ({
      ...building,
      ...(building.interiorBuildings
        ? { interiorBuildings: building.interiorBuildings.map(child => ({ ...child })) }
        : {}),
    })),
  }))
  const parents = new Map(
    result.flatMap(player =>
      player.buildings.map(building => [interiorSaveSpaceId(key(player), building), building] as const)
    )
  )
  const ownerKeys = new Set(result.map(key))
  const bandits = result.find(player => player.type === 'Bandits')
  for (const player of result) {
    player.buildings = player.buildings.filter(building => {
      const space = building.spaceId && building.spaceId !== 'outside' ? building.spaceId : null
      if (!space) return true
      const parent = parents.get(space)
      if (!parent || parent === building || (parent.spaceId && parent.spaceId !== 'outside'))
        throw new Error(`Invalid interior parent: ${space}`)
      parent.interiorBuildings ??= []
      if (building.label && parent.interiorBuildings.some(child => child.label === building.label))
        throw new Error(`Duplicate interior building: ${building.label}`)
      building.interiorOwner = key(player)
      delete building.spaceId
      parent.interiorBuildings.push(building)
      return false
    })
  }
  for (const player of result)
    for (const building of player.buildings) {
      for (const child of building.interiorBuildings ?? []) {
        // Migrate the earlier neutral-owned bandit props once, preserving inventories.
        if (!child.interiorOwner && building.type === 'Cave' && child.label?.includes(':bandit:') && bandits)
          child.interiorOwner = key(bandits)
        if (child.interiorOwner && !ownerKeys.has(child.interiorOwner))
          throw new Error(`Missing interior owner: ${child.interiorOwner}`)
      }
    }
  for (const player of result) player.buildings = groupInteriorBuildings(player.buildings, key(player))
  return result
}

export function savedBuildingsOwnedBy(
  player: { label?: string; factionId?: string | null; name?: string; buildings?: SaveEntityState[] },
  players: (typeof player)[] = [player]
): SaveEntityState[] {
  const key = (owner: typeof player) => owner.label || owner.factionId || owner.name || 'owner'
  return players.flatMap(owner =>
    (owner.buildings ?? []).flatMap(building => [
      ...(key(owner) === key(player) ? [building] : []),
      ...(!building.isDead && !building.isDestroyed
        ? (building.interiorBuildings ?? []).filter(child => (child.interiorOwner || key(owner)) === key(player))
        : []),
    ])
  )
}
