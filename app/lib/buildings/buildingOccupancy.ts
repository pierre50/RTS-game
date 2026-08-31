import { BUILDING_TYPES } from '../../constants'
import type { BuildingEntity, UnitEntity } from '../../types/entities'
import type { RuntimeCell, RuntimeMap } from '../../types/map'
import { sameBuilding } from './identity'
import { getInteriorExitCell } from './interiorExits'

const DEFAULT_BUILDING_SHELTER_CAPACITY: Record<string, number> = {
  [BUILDING_TYPES.house]: 5,
  [BUILDING_TYPES.townCenter]: 10,
}

export function getBuildingShelterCapacity(building: Pick<BuildingEntity, 'shelterCapacity' | 'type'> | null | undefined): number {
  if (!building) return 0
  const configured = Number(building.shelterCapacity)
  if (Number.isFinite(configured) && configured > 0) return Math.floor(configured)
  return DEFAULT_BUILDING_SHELTER_CAPACITY[building.type] ?? 0
}

function countBuildingShelterOccupants(
  building: BuildingEntity,
  units: UnitEntity[] = building.owner?.units ?? [],
  options: { exclude?: UnitEntity | null } = {}
): number {
  return units.reduce((count, unit) => {
    if (unit === options.exclude || unit.isDead || unit.isDestroyed) return count
    const state = unit.shelterState
    if (!state || state.location !== 'shelter' || state.status !== 'inside') return count
    return sameBuilding(state.shelter, building) ? count + 1 : count
  }, 0)
}

export function hasBuildingShelterCapacity(
  building: BuildingEntity,
  units: UnitEntity[] = building.owner?.units ?? [],
  options: { exclude?: UnitEntity | null; reserved?: number } = {}
): boolean {
  const capacity = getBuildingShelterCapacity(building)
  if (capacity <= 0) return false
  return countBuildingShelterOccupants(building, units, options) + (options.reserved ?? 0) < capacity
}

function isInteriorSleepCell(cell: RuntimeCell | null | undefined, exit: RuntimeCell | null): cell is RuntimeCell {
  if (!cell || cell === exit) return false
  if (exit && cell.i === exit.i && cell.j === exit.j) return false
  return !cell.has && !cell.solid && !cell.border && !cell.terrainHidden && cell.category !== 'Water'
}

function interiorSleepScore(cell: RuntimeCell, exit: RuntimeCell | null, center: number): number {
  const exitDistance = exit ? Math.abs(cell.i - exit.i) + Math.abs(cell.j - exit.j) : 0
  const cornerBias = Math.abs(cell.i - center)
  return exitDistance * 100 + cornerBias
}

export function findInteriorSleepCell(map: RuntimeMap | null | undefined): RuntimeCell | null {
  if (!map) return null
  const exit = getInteriorExitCell(map)
  const center = Math.round(map.size / 2)
  let best: RuntimeCell | null = null
  let bestScore = -Infinity

  for (let i = 0; i <= map.size; i += 1) {
    for (let j = 0; j <= map.size; j += 1) {
      const cell = map.grid[i]?.[j]
      if (!isInteriorSleepCell(cell, exit)) continue
      const score = interiorSleepScore(cell, exit, center)
      if (score > bestScore) {
        best = cell
        bestScore = score
      }
    }
  }

  return best
}
