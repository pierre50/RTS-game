import type { BuildingEntity } from '../../types/entities'

export type KnownBuildingsContext = {
  player?: { buildings?: BuildingEntity[] | null } | null
  players?: Array<{ buildings?: BuildingEntity[] | null }> | null
}

export function getKnownBuildings(context: KnownBuildingsContext): BuildingEntity[] {
  const buildings: BuildingEntity[] = []
  const seen = new Set<BuildingEntity | string>()
  const players = context.players?.length ? context.players : context.player ? [context.player] : []

  for (const player of players) {
    for (const building of player.buildings ?? []) {
      const key = building.label || building
      if (seen.has(key)) continue
      seen.add(key)
      buildings.push(building)
    }
  }

  return buildings
}
