import { CELL_HEIGHT, CELL_WIDTH } from '../../constants/gridGeometry'

type ReliefCell = {
  i: number
  j: number
  z?: number | null
}
type ReliefMap = { grid: Array<Array<ReliefCell | null | undefined> | undefined> }

// Ground-space limits calibrated against the straight faces of texture copy.png.
// They describe geometry, never whether a light/dark face is uphill or downhill.
const BACK_START = -1 - 24.5 / 64
const BACK_END = -1 + 21.5 / 64
const FRONT_START = 1 + 1 / 64
const FRONT_END = 1 + 7 / 64
const EASE_FRACTION = 0.15

/** Ease only the ends. Unlike smoothstep, the bounded middle derivative cannot
 * fold the rear face's projected trajectory back on itself (y - height * 16).
 */
function ramp(value: number, start: number, end: number): number {
  const t = Math.max(0, Math.min(1, (value - start) / (end - start)))
  const speed = 1 / (1 - EASE_FRACTION)
  if (t < EASE_FRACTION) return (speed * t * t) / (2 * EASE_FRACTION)
  if (t > 1 - EASE_FRACTION) return 1 - (speed * (1 - t) ** 2) / (2 * EASE_FRACTION)
  return speed * (t - EASE_FRACTION / 2)
}

function terraceCoverage(offset: number): number {
  return ramp(offset, BACK_START, BACK_END) * (1 - ramp(offset, FRONT_START, FRONT_END))
}

/** A terrace is the union of its elevated cells. Shared faces therefore have
 * one height, including corners, saddles and crossings. Taking the union at
 * each elevation avoids the false valleys created by blending sprite profiles.
 * Coordinates and elevations are logical terrain data, independent of rendering
 * and of which cell currently owns the moving entity.
 */
export function getReliefLevelAtPoint(
  map: ReliefMap | null | undefined,
  point: { x: number; y: number },
  fallback?: ReliefCell | null
): number {
  const i = point.x / CELL_WIDTH + point.y / CELL_HEIGHT
  const j = point.y / CELL_HEIGHT - point.x / CELL_WIDTH
  const current = map?.grid[Math.round(i)]?.[Math.round(j)] ?? fallback
  const base = current?.z ?? 0
  if (!map) return base

  const terraces: Array<{ height: number; coverage: number }> = []
  // Only cells whose support contains this point can contribute (at most 3x3).
  for (let ci = Math.ceil(i - FRONT_END); ci <= Math.floor(i - BACK_START); ci++) {
    const row = map.grid[ci]
    if (!row) continue
    const coverageI = terraceCoverage(i - ci)
    for (let cj = Math.ceil(j - FRONT_END); cj <= Math.floor(j - BACK_START); cj++) {
      const height = row[cj]?.z
      if (height == null || height <= base) continue
      const coverage = Math.min(coverageI, terraceCoverage(j - cj))
      if (coverage > 0) terraces.push({ height, coverage })
    }
  }
  // Integrate nested elevation layers without assuming integer terrain heights.
  terraces.sort((a, b) => b.coverage - a.coverage)
  let level = base
  let highest = base
  for (const terrace of terraces) {
    if (terrace.height <= highest) continue
    level += (terrace.height - highest) * terrace.coverage
    highest = terrace.height
  }
  return level
}

/** Apply the sampled ground height once, using the caller's resolved map space. */
export function syncEntityRelief(
  map: ReliefMap | null | undefined,
  entity: { x: number; y: number; currentCell?: ReliefCell | null; applyReliefLift?: (level: number) => void },
  fallback: ReliefCell | null | undefined = entity.currentCell
): void {
  entity.applyReliefLift?.(getReliefLevelAtPoint(map, entity, fallback))
}
