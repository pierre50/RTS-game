import type { GameContextLike } from '../../types/context'
import type { BuildingEntity } from '../../types/entities'

export function getKnownBuildings(context: Pick<GameContextLike, 'player' | 'players'>): BuildingEntity[] {
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
