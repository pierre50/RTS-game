import { canUnitUseCellAsIdleDestination, createReservedPassageCellLookup } from '../lib/buildings/passageCells'
import { getBuildingInteriorEntryCell, isBuildingInteriorSupported } from '../lib/buildings/interiors'
import type { GameContextLike } from '../types/context'
import type { BuildingEntity, UnitEntity } from '../types/entities'
import type { GridPosition } from '../types/grid'
import type { RuntimeCell } from '../types/map'

export const CIVIL_VISIT_TYPES = new Set([
  'House',
  'Market',
  'Temple',
  'TownCenter',
  'Granary',
  'StoragePit',
  'FireCamp',
  'Well',
])
export const MILITARY_VISIT_TYPES = new Set([
  'WatchTower',
  'Barracks',
  'ArcheryRange',
  'Stable',
  'TownCenter',
  'FireCamp',
])
export const VISIT_RADIUS = 30
export function usableVisitBuilding(building: BuildingEntity): boolean {
  return Boolean(
    building.isBuilt &&
      !building.isDead &&
      !building.isDestroyed &&
      (!building.spaceId || building.spaceId === 'outside')
  )
}

/** One bounded flood-fill shared by every candidate; never search across the continent. */
export function localVisitCells(context: GameContextLike, unit: UnitEntity, home: GridPosition): RuntimeCell[] {
  const grid = context.map.grid
  const origin = grid[unit.i]?.[unit.j]
  if (!origin) return []
  const queue = [origin],
    seen = new Set([origin])
  for (let n = 0; n < queue.length && queue.length < 512; n++) {
    const current = queue[n]
    for (const [di, dj] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const cell = grid[current.i + di]?.[current.j + dj]
      if (
        !cell ||
        seen.has(cell) ||
        cell.solid ||
        cell.has ||
        cell.border ||
        cell.waterBorder ||
        cell.category === 'Water' ||
        Math.abs((cell.z ?? 0) - (current.z ?? 0)) > 1 ||
        Math.hypot(cell.i - home.i, cell.j - home.j) > VISIT_RADIUS ||
        Math.hypot(cell.i - unit.i, cell.j - unit.j) > 18
      )
        continue
      seen.add(cell)
      queue.push(cell)
      if (queue.length >= 512) break
    }
  }
  return queue.slice(1)
}

export function visitDestination(
  context: GameContextLike,
  unit: UnitEntity,
  building: BuildingEntity,
  cells: RuntimeCell[],
  interior: boolean
): RuntimeCell | undefined {
  if (interior && isBuildingInteriorSupported(building)) {
    const entry = getBuildingInteriorEntryCell(building, context.map.grid)
    if (entry && (cells.includes(entry) || (entry.i === unit.i && entry.j === unit.j))) return entry
  }
  const passages = createReservedPassageCellLookup(context)
  const radius = Math.ceil((building.size ?? 2) / 2) + 2
  return cells
    .filter(
      cell =>
        Math.hypot(cell.i - building.i, cell.j - building.j) <= radius &&
        canUnitUseCellAsIdleDestination(unit, cell, { passageLookup: passages })
    )
    .sort((a, b) => Math.hypot(a.i - building.i, a.j - building.j) - Math.hypot(b.i - building.i, b.j - building.j))[0]
}
