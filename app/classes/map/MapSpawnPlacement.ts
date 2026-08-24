import { getZoneInGridWithCondition } from '../../lib'
import type { GridPosition } from '../../types/grid'
import type { RuntimeCell } from '../../types/map'
import type { MapGenerationMap } from './MapGenerationTypes'

export function findPlayerPlaces(map: MapGenerationMap): GridPosition[] {
  const results: GridPosition[] = []
  const playerCount = map.positionsCount
  const searchHalf = Math.max(6, Math.floor(map.size * 0.06))
  const zoneRadius = map.size < 64 ? 2 : 5
  const border = Math.min(12, Math.max(2, Math.floor(map.size * 0.08)))
  let minDistance = Math.max(16, Math.floor((map.size / Math.max(playerCount, 2)) * 0.55))

  const farEnoughFromOtherSpawns = (position: GridPosition) =>
    results.every(
      existing => !existing || (existing.i - position.i) ** 2 + (existing.j - position.j) ** 2 >= minDistance ** 2
    )

  const canUseCell = (cell: RuntimeCell) => !cell.border && !cell.solid && !cell.inclined && cell.category !== 'Water'

  for (let index = 0; index < playerCount; index++) {
    let found = null

    for (let relaxation = 0; relaxation < 3 && !found; relaxation++) {
      const attempts = 80
      for (let attempt = 0; attempt < attempts && !found; attempt++) {
        const ci = map.randomRange(border, map.size - border)
        const cj = map.randomRange(border, map.size - border)
        const candidate = getZoneInGridWithCondition(
          {
            minX: Math.max(border, ci - searchHalf),
            maxX: Math.min(map.size - border, ci + searchHalf),
            minY: Math.max(border, cj - searchHalf),
            maxY: Math.min(map.size - border, cj + searchHalf),
          },
          map.grid,
          zoneRadius,
          canUseCell
        )
        if (candidate && farEnoughFromOtherSpawns(candidate)) found = candidate
      }
      minDistance = Math.max(10, Math.floor(minDistance * 0.75))
    }

    if (!found) {
      found = getZoneInGridWithCondition(
        {
          minX: border,
          maxX: map.size - border,
          minY: border,
          maxY: map.size - border,
        },
        map.grid,
        zoneRadius,
        canUseCell
      )
    }

    if (found) results.push(found)
  }

  return results
}
