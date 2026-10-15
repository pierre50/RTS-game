import { CELL_DEPTH } from '../constants'
import { isometricToCartesian, pointsDistance } from '../lib/maths'
import { getReliefLevelAtPoint } from '../lib/terrain/reliefSurface'
import type { Point } from '../types/grid'

type ReliefMap = Parameters<typeof getReliefLevelAtPoint>[0]

export type ProjectileVisualState = {
  id: string
  type: string
  spaceId: string
  cell: { i: number; j: number; z: number }
  position: { x: number; y: number; z: number }
  altitude: number
  visible: boolean
  sortOrder: number
}

export type ProjectileVisualSource = {
  label: string
  type: string
  spaceId?: string | null
  x: number
  y: number
  currentAltitude: number
  spawnOrigin: Point
  terrainOrigin: Point
  terrainDestination: Point
  totalDistance: number
  visible: boolean
  zIndex: number
}

/** Samples terrain under the shot independently of the height of its drawn sprite. */
export function projectileVisualState(source: ProjectileVisualSource, map: ReliefMap): ProjectileVisualState {
  const traveled = pointsDistance(source.spawnOrigin.x, source.spawnOrigin.y, source.x, source.y)
  const progress = Math.max(0, Math.min(1, traveled / Math.max(source.totalDistance, 1)))
  const groundPoint = {
    x: source.terrainOrigin.x + (source.terrainDestination.x - source.terrainOrigin.x) * progress,
    y: source.terrainOrigin.y + (source.terrainDestination.y - source.terrainOrigin.y) * progress,
  }
  const [i, j] = isometricToCartesian(groundPoint.x, groundPoint.y)
  const cell = map?.grid?.[i]?.[j]
  const groundZ = getReliefLevelAtPoint(map, groundPoint, cell)
  return {
    id: source.label,
    type: source.type,
    spaceId: source.spaceId ?? 'outside',
    cell: { i, j, z: cell?.z ?? groundZ },
    position: { x: source.x, y: source.y, z: groundZ + source.currentAltitude / CELL_DEPTH },
    altitude: source.currentAltitude,
    visible: source.visible,
    sortOrder: source.zIndex,
  }
}
