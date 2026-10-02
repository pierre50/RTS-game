import { BUILDING_TYPES } from '../../constants/entities'
import { CELL_HEIGHT, CELL_WIDTH } from '../../constants/gridGeometry'
import { CELL_DEPTH } from '../../constants/relief'

type Furniture = {
  type: string
  i: number
  j: number
  size: number
  placementMirrored?: boolean
  isBuilt?: boolean
  isDead?: boolean
  isDestroyed?: boolean
}

type SurfaceGrid = Array<Array<object | null | undefined> | undefined>

// Separate from cell.has: units can occupy a traversable piece of furniture.
const surfaces = new WeakMap<object, Furniture>()

// Bedroll frame: 144x96, anchor (72,80). The mattress plane is a diamond
// centred at (71,60), with half-diagonals (46,23). Project it back to ground
// space by adding its 8px height. Placement still reserves the full 2x2 cells;
// those cells are not the visible mattress and must not define its surface.
const BED_HEIGHT_PIXELS = 8
const BED_CENTER_X = -1
const BED_GROUND_CENTER_Y = -12
const BED_HALF_WIDTH = 46
const BED_HALF_HEIGHT = 23
// A short step at the mattress edge, independent of terrain slope speed.
const BED_STEP_TRANSITION_PIXELS = 3
const BED_EDGE_NORMAL_LENGTH = Math.hypot(1 / BED_HALF_WIDTH, 1 / BED_HALF_HEIGHT)

export function registerFurnitureSurface(cell: object, furniture: Furniture): void {
  if (furniture.type === BUILDING_TYPES.campBedroll) surfaces.set(cell, furniture)
}

export function removeFurnitureSurface(cell: object, furniture: Furniture): void {
  if (surfaces.get(cell) === furniture) surfaces.delete(cell)
}

function sampleSurface(cell: object | null | undefined, i: number, j: number): number {
  const furniture = cell && surfaces.get(cell)
  if (!furniture || !furniture.isBuilt || furniture.isDead || furniture.isDestroyed) return 0
  const mirror = furniture.placementMirrored ? -1 : 1
  const x = ((i - furniture.i - (j - furniture.j)) * CELL_WIDTH) / 2
  const y = ((i - furniture.i + (j - furniture.j)) * CELL_HEIGHT) / 2
  const edge =
    1 - Math.abs((x * mirror - BED_CENTER_X) / BED_HALF_WIDTH) - Math.abs((y - BED_GROUND_CENTER_Y) / BED_HALF_HEIGHT)
  const edgeDistance = edge / BED_EDGE_NORMAL_LENGTH
  const t = Math.max(0, Math.min(1, edgeDistance / BED_STEP_TRANSITION_PIXELS))
  return (BED_HEIGHT_PIXELS / CELL_DEPTH) * t * t * (3 - 2 * t)
}

/** Sample nearby furniture because the sprite extends beyond its anchor cell.
 * Taking the maximum preserves one surface across cell boundaries and overlaps.
 */
export function getFurnitureSurfaceLevel(
  grid: SurfaceGrid | null | undefined,
  i: number,
  j: number,
  fallback?: object | null
): number {
  if (!grid) return sampleSurface(fallback, i, j)
  let level = 0
  const centerI = Math.round(i)
  const centerJ = Math.round(j)
  for (let ci = centerI - 1; ci <= centerI + 1; ci++) {
    for (let cj = centerJ - 1; cj <= centerJ + 1; cj++) {
      level = Math.max(level, sampleSurface(grid[ci]?.[cj], i, j))
    }
  }
  return level
}

/** Feet position at the centre of the visible mattress, in flat map coordinates. */
export function getBedRestPoint(bed: Pick<Furniture, 'i' | 'j' | 'placementMirrored'>): { x: number; y: number } {
  return {
    x: ((bed.i - bed.j) * CELL_WIDTH) / 2 + BED_CENTER_X * (bed.placementMirrored ? -1 : 1),
    y: ((bed.i + bed.j) * CELL_HEIGHT) / 2 + BED_GROUND_CENTER_Y,
  }
}
