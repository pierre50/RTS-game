import type { MapBlueprint } from '../../classes/map/MapGenerationTypes'

// Compatibility for interiors created on demand, without a generated blueprint.
export function createInteriorWallEdges(
  floor: number[][],
  size: number,
  exits: { i: number; j: number }[]
): NonNullable<MapBlueprint['walls']> {
  const sides = [
    [-1, 0],
    [0, -1],
    [0, 1],
    [1, 0],
  ]
  const walls: NonNullable<MapBlueprint['walls']> = []
  for (let i = 0; i <= size; i++) {
    for (let j = 0; j <= size; j++) {
      if (floor[i]?.[j] !== 1 || exits.some(exit => exit.i === i && exit.j === j)) continue
      const exposed = sides.flatMap(([di, dj], side) => (floor[i + di]?.[j + dj] === 1 ? [] : [side]))
      for (const side of exposed) walls.push({ i, j, side })
    }
  }
  return walls
}
