import type { MapBlueprint } from '../../classes/map/MapGenerationTypes'
import { CELL_DEPTH } from '../../constants/relief'
import { CELL_HEIGHT, CELL_WIDTH } from '../../constants/gridGeometry'
import { getReliefAppearance } from './reliefAppearance'
import { EIGHT_NEIGHBOR_OFFSETS, getNeighborFlagsFromRing } from './topology'

// Pixel vertices of the terrain atlas: height, left corner Y, right corner Y.
// Top and bottom vertices are at the center column, at 0 and height - 1.
const PROFILES: Record<number, [number, number, number]> = {
  9: [17, 16, 16],
  10: [49, 32, 32],
  11: [33, 0, 16],
  12: [33, 16, 0],
  13: [17, 0, 16],
  14: [49, 16, 32],
  15: [17, 16, 0],
  16: [49, 32, 16],
  17: [17, 16, 16],
  18: [49, 32, 32],
  19: [33, 0, 16],
  20: [33, 16, 0],
  21: [17, 0, 0],
  22: [49, 16, 16],
  23: [33, 32, 16],
  24: [33, 16, 32],
}
const EDGES = [
  [0, 1],
  [1, 2],
  [0, 3],
  [3, 2],
]
type Wall = NonNullable<MapBlueprint['walls']>[number]

export function getInteriorFloorVertices(blueprint: MapBlueprint, i: number, j: number): number[][] {
  const z = blueprint.relief?.[i]?.[j] ?? 0
  const flags = getNeighborFlagsFromRing(
    EIGHT_NEIGHBOR_OFFSETS.map(([di, dj]) => (blueprint.relief?.[i + di]?.[j + dj] ?? z) > z)
  )
  const appearance = getReliefAppearance(flags)
  const [height, leftY, rightY] = (appearance && PROFILES[appearance.index]) || [33, 16, 16]
  const halfWidth = CELL_WIDTH / 2
  const halfHeight = CELL_HEIGHT / 2
  const centerX = (i - j) * halfWidth
  const topY = (i + j) * halfHeight - z * CELL_DEPTH - (appearance?.elevation ?? 0) - Math.floor(height / 2)
  return [
    [-halfWidth, leftY],
    [0, 0],
    [halfWidth, rightY],
    [0, height - 1],
  ].map(([x, y]) => [centerX + x, topY + y])
}

export function getInteriorWallGeometry(blueprint: MapBlueprint, wall: Wall) {
  const edge = EDGES[wall.side]
  if (!edge) return null
  const vertices = getInteriorFloorVertices(blueprint, wall.i, wall.j)
  const [left, right] = edge.map(index => vertices[index])
  const rise = right[1] - left[1]
  const frame = rise === 0 ? 4 : Math.abs(rise) > CELL_HEIGHT / 2 ? 2 : rise > 0 ? 0 : 3
  return {
    frame,
    flip: frame === 2 && rise > 0,
    x: left[0],
    y: Math.min(left[1], right[1]) - 100,
    width: CELL_WIDTH / 2 + 1,
    height: 101 + Math.abs(rise),
    polygon: [left, [left[0], left[1] - 100], [right[0], right[1] - 100], right],
    // Lighting depends on the world orientation, including horizontal ramp edges.
    tint: wall.side === 1 || wall.side === 2 ? 0xffffff : 0xbfbfbf,
    zIndex: wall.i + wall.j + (wall.side < 2 ? -0.5 : 0.5),
  }
}
