import { createInteriorWallEdges } from '../../../lib/buildings/interiorWalls'
import { definedProperties } from '../../../lib/definedProperties'
import { blueprintToLocalGrid, createLocalMapLayout, localToGrid } from '../../../lib/localMapLayout'
import type { MapBlueprint } from '../MapGenerationTypes'

function createSparseGrid<T>(size: number): T[][] {
  return Array.from({ length: size + 1 }, () => [])
}

function transformGrid<T>(
  source: T[][] | undefined,
  sourceSize: number,
  layout: ReturnType<typeof createLocalMapLayout>,
  size: number,
  valueForSourceCell: (sourceI: number, sourceJ: number) => T | undefined
): T[][] | undefined {
  if (!source) return undefined
  const grid = createSparseGrid<T>(size)
  for (let row = 0; row < layout.rows; row++) {
    for (let column = 0; column < layout.columns; column++) {
      if (row % 2 === 1 && column === layout.columns - 1) continue
      const { i, j } = localToGrid(column, row, layout)
      const sourceI = Math.min(sourceSize, Math.floor(row / 2))
      const sourceJ = Math.min(sourceSize, column * 2 + (row % 2))
      const value = valueForSourceCell(sourceI, sourceJ)
      if (value != null) grid[i][j] = value
    }
  }
  return grid
}

export function createSquareLocalBlueprint(source: MapBlueprint): MapBlueprint {
  if (source.preserveLegacyGrid || source.localGridLayout) return source
  const layout = createLocalMapLayout(source.size)
  const size = layout.columns - 1 + Math.ceil((layout.rows - 1) / 2)
  const terrain =
    transformGrid(
      source.terrain,
      source.size,
      layout,
      size,
      (sourceI, sourceJ) => source.terrain[sourceI]?.[sourceJ]
    ) ?? createSparseGrid(size)
  const relief =
    transformGrid(
      source.relief,
      source.size,
      layout,
      size,
      (sourceI, sourceJ) => source.relief?.[sourceI]?.[sourceJ] ?? 0
    ) ?? createSparseGrid(size)
  const floorMask = transformGrid(
    source.floorMask,
    source.size,
    layout,
    size,
    (sourceI, sourceJ) => source.floorMask?.[sourceI]?.[sourceJ]
  )
  const borderMask = transformGrid(
    source.borderMask,
    source.size,
    layout,
    size,
    (sourceI, sourceJ) => source.borderMask?.[sourceI]?.[sourceJ]
  )
  const position = <T extends { i: number; j: number }>(value: T): T => ({
    ...value,
    ...blueprintToLocalGrid(value.i, value.j, layout),
  })
  const blueprint: MapBlueprint = definedProperties({
    ...source,
    size,
    localGridLayout: layout,
    terrain,
    relief,
    floorMask,
    borderMask,
    walls: floorMask
      ? createInteriorWallEdges(
          floorMask,
          size,
          (source.exits ?? []).flatMap(exit => (exit ? [position(exit)] : []))
        )
      : undefined,
    spawns: source.spawns?.map(value => value && position(value)),
    exits: source.exits?.map(value => value && position(value)),
    resources: source.resources?.map(position),
    banditCampPositions: source.banditCampPositions?.map(position),
    settlements: source.settlements?.map(value => ({ ...value, local: position(value.local) })),
  })
  return blueprint
}

function setInteriorCell<T>(grid: T[][], i: number, j: number, value: T): void {
  grid[i] ??= []
  grid[i][j] = value
}

function computeInteriorBorderMask(floorMask: number[][], size: number): number[][] {
  const borderMask = createSparseGrid<number>(size)
  for (let i = 0; i <= size; i += 1) {
    for (let j = 0; j <= size; j += 1) {
      if (floorMask[i]?.[j] !== 1) continue
      let touchesOutside = false
      for (let di = -1; di <= 1 && !touchesOutside; di += 1) {
        for (let dj = -1; dj <= 1; dj += 1) {
          if (di === 0 && dj === 0) continue
          const ni = i + di
          const nj = j + dj
          if (ni < 0 || nj < 0 || ni > size || nj > size || floorMask[ni]?.[nj] !== 1) {
            touchesOutside = true
            break
          }
        }
      }
      if (touchesOutside) setInteriorCell(borderMask, i, j, 1)
    }
  }
  return borderMask
}

/** A rounded rectangle in world coordinates projects along the two isometric axes. */
export function createIsometricInteriorBlueprint(source: MapBlueprint): MapBlueprint {
  if (source.localGridLayout || source.preserveLegacyGrid) return source
  const layout = createLocalMapLayout(source.size)
  const size = layout.columns - 1 + Math.ceil((layout.rows - 1) / 2)
  const terrain = createSparseGrid<MapBlueprint['terrain'][number][number]>(size)
  const relief = createSparseGrid<number>(size)
  const floorMask = createSparseGrid<number>(size)
  const center = Math.round(size / 2)
  const halfExtent = Math.floor((source.size - 3) / 2)
  const cornerRadius = 1.5

  for (let i = 0; i <= size; i += 1) {
    for (let j = 0; j <= size; j += 1) {
      const dx = Math.max(0, Math.abs(i - center) - halfExtent + cornerRadius)
      const dy = Math.max(0, Math.abs(j - center) - halfExtent + cornerRadius)
      const isFloor = dx * dx + dy * dy <= cornerRadius * cornerRadius
      setInteriorCell(terrain, i, j, isFloor ? 'Dirt' : 'Water')
      setInteriorCell(relief, i, j, 0)
      setInteriorCell(floorMask, i, j, isFloor ? 1 : 0)
    }
  }

  const borderMask = computeInteriorBorderMask(floorMask, size)
  // Midpoint of the front-left wall: one exposed edge and a straight approach.
  const exit = { i: center, j: center + halfExtent }
  setInteriorCell(borderMask, exit.i, exit.j, 0)
  const sourceExit = source.exits?.find(Boolean) as { i: number; j: number; id?: string } | undefined

  return definedProperties({
    ...source,
    size,
    preserveLegacyGrid: true,
    terrain,
    relief,
    floorMask,
    borderMask,
    walls: createInteriorWallEdges(floorMask, size, [exit]),
    spawns: [exit],
    exits: [{ ...exit, id: sourceExit?.id ?? 'main', direction: 'south' }],
    resources: [],
    floorShape: {
      type: 'rounded-isometric',
      center: { i: center, j: center },
      halfExtent,
      cornerRadius,
    },
  })
}
