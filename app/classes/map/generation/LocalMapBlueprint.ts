import { blueprintToLocalGrid, createLocalMapLayout, gridToLocal, localToGrid } from '../../../lib/localMapLayout'
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
  const blueprint: MapBlueprint = {
    ...source,
    size,
    localGridLayout: layout,
    terrain,
    relief,
    floorMask,
    borderMask,
    spawns: source.spawns?.map(value => value && position(value)),
    exits: source.exits?.map(value => value && position(value)),
    resources: source.resources?.map(position),
    banditCampPositions: source.banditCampPositions?.map(position),
    settlements: source.settlements?.map(value => ({ ...value, local: position(value.local) })),
  }
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

function bottomLeftVisualFloorCell(
  floorMask: number[][],
  size: number,
  layout: ReturnType<typeof createLocalMapLayout>,
  centerColumn: number,
  centerRow: number,
  radiusColumns: number
): { i: number; j: number } {
  let best: { i: number; j: number; row: number; visualColumn: number } | null = null
  const targetColumn = centerColumn - radiusColumns * 0.45
  for (let i = 0; i <= size; i += 1) {
    for (let j = 0; j <= size; j += 1) {
      if (floorMask[i]?.[j] !== 1) continue
      const local = gridToLocal(i, j, layout)
      const visualColumn = local.column + (local.row % 2) / 2
      if (local.row <= centerRow || visualColumn >= centerColumn) continue
      const candidate = { i, j, row: local.row, visualColumn }
      if (!best) {
        best = candidate
        continue
      }
      const columnDistance = Math.abs(visualColumn - targetColumn)
      const bestColumnDistance = Math.abs(best.visualColumn - targetColumn)
      if (candidate.row > best.row || (candidate.row === best.row && columnDistance < bestColumnDistance)) {
        best = candidate
      }
    }
  }
  return best ?? { i: Math.round(size / 2), j: Math.round(size / 2) }
}

export function createRoundLocalInteriorBlueprint(source: MapBlueprint): MapBlueprint {
  if (source.localGridLayout) return source
  const layout = createLocalMapLayout(source.size)
  const size = layout.columns - 1 + Math.ceil((layout.rows - 1) / 2)
  const terrain = createSparseGrid<MapBlueprint['terrain'][number][number]>(size)
  const relief = createSparseGrid<number>(size)
  const floorMask = createSparseGrid<number>(size)
  const centerColumn = (layout.columns - 1) / 2
  const centerRow = (layout.rows - 1) / 2
  const radiusColumns = Math.max(2.25, Math.min(layout.columns / 2 - 0.65, (source.buildingSize ?? 2) + 1.35))
  const radiusRows = Math.min(centerRow - 1, radiusColumns * 2.55)
  const curvePower = 3

  for (let row = 0; row < layout.rows; row += 1) {
    for (let column = 0; column < layout.columns; column += 1) {
      if (row % 2 === 1 && column === layout.columns - 1) continue
      const { i, j } = localToGrid(column, row, layout)
      const visualColumn = column + (row % 2) / 2
      const dx = Math.abs((visualColumn - centerColumn) / radiusColumns)
      const dy = Math.abs((row - centerRow) / radiusRows)
      const isFloor = dx ** curvePower + dy ** curvePower <= 1
      setInteriorCell(terrain, i, j, isFloor ? 'Dirt' : 'Water')
      setInteriorCell(relief, i, j, 0)
      setInteriorCell(floorMask, i, j, isFloor ? 1 : 0)
    }
  }

  const borderMask = computeInteriorBorderMask(floorMask, size)
  const exit = bottomLeftVisualFloorCell(floorMask, size, layout, centerColumn, centerRow, radiusColumns)
  setInteriorCell(borderMask, exit.i, exit.j, 0)
  const sourceExit = source.exits?.find(Boolean) as ({ direction?: string; id?: string } & {
    i: number
    j: number
  }) | null

  return {
    ...source,
    size,
    localGridLayout: layout,
    terrain,
    relief,
    floorMask,
    borderMask,
    spawns: [exit],
    exits: [{ ...exit, ...(sourceExit?.id ? { id: sourceExit.id } : {}), ...(sourceExit?.direction ? { direction: sourceExit.direction } : {}) }],
    resources: [],
    floorShape: {
      type: 'round-local',
      center: { column: centerColumn, row: centerRow },
      radius: { columns: radiusColumns, rows: radiusRows },
      curvePower,
    },
  }
}
