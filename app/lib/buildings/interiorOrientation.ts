import type { MapBlueprint } from '../../classes/map/MapGenerationTypes'
import { definedProperties } from '../definedProperties'

/** Swapping grid axes reflects screen X while retaining height and normal sprite rendering. */
export function mirrorInteriorBlueprint(source: MapBlueprint): MapBlueprint {
  const position = <T extends { i: number; j: number }>(cell: T): T => ({ ...cell, i: cell.j, j: cell.i })
  const transpose = <T>(grid: T[][]): T[][] => {
    const result: T[][] = Array.from({ length: source.size + 1 }, () => [])
    grid.forEach((row, i) =>
      row.forEach((value, j) => {
        result[j][i] = value
      })
    )
    return result
  }
  const sides = [1, 0, 3, 2]
  return definedProperties({
    ...source,
    terrain: transpose(source.terrain),
    relief: source.relief && transpose(source.relief),
    floorMask: source.floorMask && transpose(source.floorMask),
    borderMask: source.borderMask && transpose(source.borderMask),
    walls: source.walls?.map(wall => ({ ...position(wall), side: sides[wall.side] })),
    spawns: source.spawns?.map(cell => cell && position(cell)),
    exits: source.exits?.map(cell => cell && position(cell)),
    resources: source.resources?.map(position),
    animals: source.animals?.map(position),
    banditCampPositions: source.banditCampPositions?.map(position),
    settlements: source.settlements?.map(settlement => ({ ...settlement, local: position(settlement.local) })),
  })
}
