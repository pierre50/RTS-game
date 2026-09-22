import { CELL_HEIGHT, CELL_WIDTH } from '../../constants'
import type { RenderableInstance } from '../../lib/grid/visibility'
import type { RuntimeCell } from '../../types/map'
import type { Viewport } from '../../types/geometry'
import type { CameraPoint } from './CameraMovement'

export type CameraVisibleCellsStats = {
  candidates: number
  exited: number
  margin: number
  samples: number
  stepX: number
  stepY: number
  updated: number
}

export type CameraCellSpace = {
  grid: RuntimeCell[][]
  origin: CameraPoint
  size: number
}

export function collectCameraCells(
  space: CameraCellSpace,
  viewport: Viewport,
  margin: number
): { cells: Set<RuntimeCell>; samples: number; stepX: number; stepY: number } {
  const cells = new Set<RuntimeCell>()
  const { visibleLeft, visibleTop, visibleWidth, visibleHeight } = viewport
  const localVisibleLeft = visibleLeft - space.origin.x
  const localVisibleTop = visibleTop - space.origin.y
  const startX = Math.floor(localVisibleLeft - margin)
  const endX = Math.floor(localVisibleLeft + visibleWidth + margin)
  const startY = Math.floor(localVisibleTop - margin)
  const endY = Math.floor(localVisibleTop + visibleHeight + margin)
  const stepX = CELL_WIDTH / 2
  const stepY = CELL_HEIGHT / 2
  const invCW = 1 / CELL_WIDTH
  const invCH = 1 / CELL_HEIGHT
  let samples = 0

  for (let i = startX; i <= endX; i += stepX) {
    for (let j = startY; j <= endY; j += stepY) {
      samples++
      const x = Math.min(Math.max(Math.round(i * invCW + j * invCH), 0), space.size)
      const y = Math.min(Math.max(Math.round(j * invCH - i * invCW), 0), space.size)
      const cell = space.grid[x]?.[y]
      if (cell) cells.add(cell)
    }
  }

  return { cells, samples, stepX, stepY }
}

export function collectCameraRenderCandidates(cells: Set<RuntimeCell>, candidates: Set<RenderableInstance>): number {
  let updated = 0
  for (const cell of cells) {
    cell.visible = true
    if (cell.has || cell.corpses.size) updated++
    if (cell.has?.isDestroyed) {
      cell.has = null
      cell.solid = false
    }
    if (cell.has) candidates.add(cell.has)
    for (const corpse of cell.corpses) candidates.add(corpse)
  }
  return updated
}

/** The render halo must never count as explored terrain. */
export function exploreCameraCells(
  cells: Iterable<RuntimeCell>,
  origin: CameraPoint,
  viewport: Viewport,
  views: { setViewed(i: number, j: number): boolean }
): number {
  let discovered = 0
  const right = viewport.visibleLeft + viewport.visibleWidth
  const bottom = viewport.visibleTop + viewport.visibleHeight
  for (const cell of cells) {
    const x = cell.x + origin.x
    const y = cell.y + origin.y
    const dx = Math.max(viewport.visibleLeft - x, 0, x - right)
    const dy = Math.max(viewport.visibleTop - y, 0, y - bottom)
    if (dx / (CELL_WIDTH / 2) + dy / (CELL_HEIGHT / 2) > 1) continue
    if (views.setViewed(cell.i, cell.j)) discovered++
  }
  return discovered
}
