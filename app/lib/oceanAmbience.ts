type OceanAmbienceCell = {
  category?: string
  waterBorder?: boolean
}

type OceanAmbienceGrid = Array<Array<OceanAmbienceCell | undefined> | undefined>

type OceanAmbiencePosition = {
  i: number
  j: number
}

export const OCEAN_AMBIENCE_RADIUS_CELLS = 8
export const OCEAN_AMBIENCE_MAX_VOLUME = 0.34
export const OCEAN_AMBIENCE_LERP_PER_SECOND = 1.8

export function isOceanAmbienceCell(cell: OceanAmbienceCell | null | undefined): boolean {
  return Boolean(cell?.waterBorder || cell?.category === 'Water')
}

export function getNearestOceanAmbienceDistance(
  grid: OceanAmbienceGrid,
  position: OceanAmbiencePosition,
  radius = OCEAN_AMBIENCE_RADIUS_CELLS
): number | null {
  const safeRadius = Math.max(0, Math.floor(radius))
  let nearestDistance = Infinity

  for (let di = -safeRadius; di <= safeRadius; di++) {
    const maxDj = safeRadius - Math.abs(di)
    const i = position.i + di
    const row = grid[i]
    if (!row) continue

    for (let dj = -maxDj; dj <= maxDj; dj++) {
      const distance = Math.abs(di) + Math.abs(dj)
      if (distance >= nearestDistance) continue
      if (isOceanAmbienceCell(row[position.j + dj])) nearestDistance = distance
    }
  }

  return nearestDistance === Infinity ? null : nearestDistance
}

export function getOceanAmbienceTargetVolume(
  grid: OceanAmbienceGrid,
  position: OceanAmbiencePosition | null | undefined,
  radius = OCEAN_AMBIENCE_RADIUS_CELLS
): number {
  if (!position) return 0
  const distance = getNearestOceanAmbienceDistance(grid, position, radius)
  if (distance == null || distance > radius) return 0

  return ((radius + 1 - distance) / (radius + 1)) * OCEAN_AMBIENCE_MAX_VOLUME
}
