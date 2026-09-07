import { CELL_HEIGHT, CELL_WIDTH } from '../constants'

export type LocalMapLayout = { columns: number; rows: number }

export function createLocalMapLayout(sourceSize: number): LocalMapLayout {
  const columns = Math.ceil((sourceSize + 1) / 2) + 1
  return { columns, rows: 4 * (columns - 1) + 1 }
}

// Keep the ordinary isometric lattice: only its occupied footprint changes.
export function localToGrid(column: number, row: number, layout: LocalMapLayout): { i: number; j: number } {
  return {
    i: column + Math.ceil(row / 2),
    j: layout.columns - 1 - column + Math.floor(row / 2),
  }
}

export function gridToLocal(i: number, j: number, layout: LocalMapLayout): { column: number; row: number } {
  const row = i + j - (layout.columns - 1)
  return { column: i - Math.ceil(row / 2), row }
}

export function getLocalMapBounds(layout: LocalMapLayout): {
  left: number
  top: number
  right: number
  bottom: number
} {
  const halfWidth = ((layout.columns - 1) * CELL_WIDTH) / 2
  const top = ((layout.columns - 1) * CELL_HEIGHT) / 2
  return { left: -halfWidth, right: halfWidth, top, bottom: top + ((layout.rows - 1) * CELL_HEIGHT) / 2 }
}

export function blueprintToLocalGrid(i: number, j: number, layout: LocalMapLayout): { i: number; j: number } {
  return localToGrid(Math.floor(j / 2), i * 2 + (j % 2), layout)
}
