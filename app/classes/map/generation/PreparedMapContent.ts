import { CELL_DEPTH } from '../../../constants'
import type { MapBlueprint } from '../MapGenerationTypes'
import type { TerrainMap, PatchBorderGroundType } from '../terrain/MapTerrainTypes'

export type PreparedTerrainCell = {
  i: number
  j: number
  water?: [string, string]
  relief?: [string, number]
  patches?: string[]
  ground?: PatchBorderGroundType
}
const caves = new WeakMap<object, NonNullable<MapBlueprint['caves']>>()

export function getPreparedCaves(map: object): NonNullable<MapBlueprint['caves']> {
  return caves.get(map) ?? []
}

const terrain = new WeakMap<object, PreparedTerrainCell[]>()
const animals = new WeakMap<object, NonNullable<MapBlueprint['animals']>>()

export function registerPreparedMapContent(map: object, blueprint: MapBlueprint): void {
  caves.delete(map)
  if (blueprint.caves) caves.set(map, blueprint.caves)
  terrain.delete(map)
  animals.delete(map)
  if (blueprint.terrainAppearance) terrain.set(map, blueprint.terrainAppearance)
  if (blueprint.animals) animals.set(map, blueprint.animals)
}

export function applyPreparedTerrain(
  map: Pick<TerrainMap, 'grid'>,
  entries: PreparedTerrainCell[],
  waterOnly = false
): void {
  for (const data of entries) {
    const cell = map.grid[data.i]?.[data.j]
    if (!cell) continue
    if (data.water) cell.setWaterBorder?.(...data.water)
    if (waterOnly) continue
    if (data.relief) cell.setReliefBorder?.(data.relief[0], data.relief[1] * CELL_DEPTH)
    for (const direction of data.patches ?? []) cell.setPatchBorder?.(direction, data.ground)
  }
}

export function consumePreparedTerrain(map: TerrainMap): boolean {
  const entries = terrain.get(map)
  if (!entries) return false
  terrain.delete(map)
  for (const row of map.grid) for (const cell of row) cell?.resetTerrainAppearance?.()
  applyPreparedTerrain(map, entries)
  return true
}

export function takePreparedAnimals(map: object): MapBlueprint['animals'] {
  const entries = animals.get(map)
  animals.delete(map)
  return entries
}
