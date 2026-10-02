import type { PlayerOptions } from '../../players/Player'
import type { MapGenerationMap, MapSettlement } from '../MapGenerationTypes'

export function findHeroOnlyStart(
  map: MapGenerationMap,
  settlementStarts: MapSettlement[],
  humanConfig: PlayerOptions | undefined
): { i: number; j: number } {
  const humanCiv = humanConfig?.civ
  const matchingSettlement = humanCiv ? settlementStarts.find(settlement => settlement.civ === humanCiv)?.local : null

  const center = Math.floor(map.size / 2)
  const canUse = (i: number, j: number) => {
    const cell = map.grid[i]?.[j]
    return Boolean(cell && !cell.solid && !cell.has && !cell.border && !cell.waterBorder && cell.category !== 'Water')
  }
  if (matchingSettlement && canUse(matchingSettlement.i, matchingSettlement.j)) return matchingSettlement
  for (let radius = 0; radius <= Math.max(8, Math.ceil(map.size / 2)); radius += 1) {
    for (let di = -radius; di <= radius; di += 1) {
      for (let dj = -radius; dj <= radius; dj += 1) {
        if (Math.max(Math.abs(di), Math.abs(dj)) !== radius) continue
        const i = center + di
        const j = center + dj
        if (canUse(i, j)) return { i, j }
      }
    }
  }

  throw new Error('Cannot place hero: map has no available land cell')
}

export function shuffleSpawnIndexes(map: MapGenerationMap): number[] {
  const poses: number[] = []
  const randoms = Array.from(Array(map.playersPos.length).keys())
  for (let i = 0; i < map.playersPos.length; i++) {
    const pos = map.randomItem(randoms)
    poses.push(pos)
    randoms.splice(randoms.indexOf(pos), 1)
  }
  return poses
}
