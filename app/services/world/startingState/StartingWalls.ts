import type { OfflineWorldSpatial } from '../offline/OfflineWorldSpatial'
import type { SaveGridPoint } from '../../../types/save'

export function addStartingWalls(
  radius: number | undefined,
  wallSize: number,
  center: SaveGridPoint,
  spatial: OfflineWorldSpatial,
  addBuilding: (type: string, point: SaveGridPoint) => void
): void {
  if (radius === undefined) return
  if (!Number.isInteger(radius) || radius < 4 || radius > 100) throw new Error('Invalid starting wall radius')
  const size = Number(wallSize) || 0
  const footprint = Math.ceil(size / 2)
  for (let di = -radius; di <= radius; di++) {
    const dj = radius - Math.abs(di)
    for (const offset of dj ? [-dj, dj] : [0]) {
      // Leave cardinal entrances wider than the wall footprint for village access.
      if (Math.abs(di) <= footprint + 1 || Math.abs(offset) <= footprint + 1) continue
      const point = { i: center.i + di, j: center.j + offset }
      // Scenic perimeter segments are optional where terrain or buildings intersect.
      if (naturalFootprint(spatial, point, footprint)) addBuilding('SmallWall', point)
    }
  }
}

function naturalFootprint(spatial: OfflineWorldSpatial, point: SaveGridPoint, footprint: number): boolean {
  let free = true
  for (let i = point.i - footprint; i <= point.i + footprint; i++)
    for (let j = point.j - footprint; j <= point.j + footprint; j++) if (!spatial.naturalCell({ i, j })) free = false
  return free
}
