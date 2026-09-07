import { blueprintToLocalGrid, createLocalMapLayout, localToGrid } from '../../../lib/localMapLayout'
import type { MapBlueprint } from '../MapGenerationTypes'
import { normalizeLocalMapRelief } from './LocalMapRelief'

export function createSquareLocalBlueprint(source: MapBlueprint): MapBlueprint {
  if (
    source.preserveLegacyGrid ||
    source.localGridLayout ||
    source.kind === 'interior' ||
    source.mapType === 'interior'
  )
    return source
  const layout = createLocalMapLayout(source.size)
  const size = layout.columns - 1 + Math.ceil((layout.rows - 1) / 2)
  const terrain: MapBlueprint['terrain'] = Array.from({ length: size + 1 }, () => [])
  const relief: number[][] = Array.from({ length: size + 1 }, () => [])
  for (let row = 0; row < layout.rows; row++) {
    for (let column = 0; column < layout.columns; column++) {
      if (row % 2 === 1 && column === layout.columns - 1) continue
      const { i, j } = localToGrid(column, row, layout)
      const sourceI = Math.min(source.size, Math.floor(row / 2))
      const sourceJ = Math.min(source.size, column * 2 + (row % 2))
      terrain[i][j] = source.terrain[sourceI][sourceJ]
      relief[i][j] = source.relief?.[sourceI]?.[sourceJ] ?? 0
    }
  }
  const position = <T extends { i: number; j: number }>(value: T): T => ({
    ...value,
    ...blueprintToLocalGrid(value.i, value.j, layout),
  })
  const blueprint: MapBlueprint = {
    ...source,
    size,
    localGridLayout: layout,
    terrain,
    relief,
    spawns: source.spawns?.map(value => value && position(value)),
    resources: source.resources?.map(position),
    banditCampPositions: source.banditCampPositions?.map(position),
    settlements: source.settlements?.map(value => ({ ...value, local: position(value.local) })),
  }
  normalizeLocalMapRelief(blueprint)
  return blueprint
}
