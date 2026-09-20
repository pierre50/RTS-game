export type GridPoint = { i: number; j: number }
type ElevationCell = { z?: number }

// A building footprint (plus clearance) may never straddle a relief step, even when each
// individual cell passes its own solid/border/inclined checks — only the ramp tile between
// two levels is marked "inclined", so every other cell must still share one elevation.
function footprintSharesElevation<TCell extends ElevationCell>(cells: readonly TCell[]): boolean {
  if (!cells.length) return false
  const groundLevel = cells[0].z
  return cells.every(cell => cell.z === groundLevel)
}

// Shared by every building-site search (live grid and offline village-planning alike): scans the
// square block a footprint would occupy (plus its clearance margin) and requires every cell to be
// individually buildable AND all at the same elevation. Each caller supplies its own per-cell
// buildability rule (solid/border/inclined for the live grid, naturalCell/occupancy for the offline
// planner) since those two systems track terrain and occupancy in genuinely different data shapes.
export function isFootprintBuildable(
  center: GridPoint,
  radius: number,
  isCellBuildable: (point: GridPoint) => boolean,
  elevationAt: (point: GridPoint) => number | undefined
): boolean {
  const cells: ElevationCell[] = []
  for (let i = center.i - radius; i <= center.i + radius; i++) {
    for (let j = center.j - radius; j <= center.j + radius; j++) {
      const point = { i, j }
      if (!isCellBuildable(point)) return false
      cells.push({ z: elevationAt(point) })
    }
  }
  return footprintSharesElevation(cells)
}
