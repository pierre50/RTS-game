import { canUnitUseCellAsIdleDestination, createReservedPassageCellLookup } from '../../lib/buildings/passageCells'
import { usableVisitBuilding, VISIT_RADIUS } from '../IdleVillageDestinations'
import type { GameContextLike } from '../../types/context'
import type { BuildingEntity, UnitEntity } from '../../types/entities'
import type { GridPosition } from '../../types/grid'
import type { RuntimeCell } from '../../types/map'
import type { PlayerLike } from '../../types/player'

const NIGHT_PATROL_HOME_TYPES = ['TownCenter', 'Granary', 'FireCamp']
const VISIT_CENTER_TYPES = ['TownCenter', 'FireCamp', 'House']
export const INTERIOR_MILITARY_VISIT_TYPES = ['Barracks', 'ArcheryRange', 'Stable']

function hypot(a: GridPosition, b: GridPosition): number {
  return Math.hypot(a.i - b.i, a.j - b.j)
}

export function visitLimit(owner: PlayerLike): number {
  return owner.settlementType === 'outpost' ? 2 : owner.settlementType === 'city' ? 6 : 4
}

function nightPatrolRadius(owner: PlayerLike | undefined): number {
  return owner?.settlementType === 'outpost' ? 12 : owner?.settlementType === 'city' ? 24 : 18
}

export function findNightPatrolHome(unit: UnitEntity): GridPosition | undefined {
  return (
    unit.villageHome ??
    unit.owner?.buildings.find(
      building => usableVisitBuilding(building) && NIGHT_PATROL_HOME_TYPES.includes(building.type)
    )
  )
}

export function filterNightPatrolCells(
  context: GameContextLike,
  unit: UnitEntity,
  home: GridPosition,
  cells: RuntimeCell[],
  reserved: ReadonlySet<unknown>
): RuntimeCell[] {
  const radius = nightPatrolRadius(unit.owner)
  const passages = createReservedPassageCellLookup(context)
  return cells.filter(
    cell =>
      hypot(cell, home) <= radius &&
      hypot(cell, unit) >= 4 &&
      !reserved.has(cell) &&
      canUnitUseCellAsIdleDestination(unit, cell, { passageLookup: passages })
  )
}

export function findVisitCenters(unit: UnitEntity, owner: PlayerLike): BuildingEntity[] {
  const centers = owner.buildings.filter(
    b => usableVisitBuilding(b) && VISIT_CENTER_TYPES.includes(b.type) && hypot(unit, b) <= VISIT_RADIUS
  )
  return centers.sort((a, b) => hypot(a, unit) - hypot(b, unit))
}

export function resolveVisitHome(
  unit: UnitEntity,
  centers: BuildingEntity[],
  previousHome: GridPosition | undefined
): GridPosition {
  const fixedHome = previousHome && hypot(previousHome, unit) <= VISIT_RADIUS ? previousHome : undefined
  return (
    unit.villageHome ??
    fixedHome ??
    centers.find(b => b.type === 'TownCenter') ??
    centers[0] ?? { i: unit.i, j: unit.j }
  )
}

export function rotateVisitChoices(
  buildings: BuildingEntity[],
  start: number,
  previous: BuildingEntity | undefined
): BuildingEntity[] {
  return [...buildings.slice(start), ...buildings.slice(0, start)].sort(
    (a, b) => Number(a === previous) - Number(b === previous)
  )
}

export function filterNearbyStrollCells(
  context: GameContextLike,
  unit: UnitEntity,
  home: GridPosition,
  cells: RuntimeCell[],
  hasCenters: boolean
): RuntimeCell[] {
  const passages = createReservedPassageCellLookup(context)
  return cells.filter(
    cell =>
      hypot(cell, home) <= (hasCenters ? VISIT_RADIUS : 6) &&
      hypot(cell, unit) <= 3 &&
      canUnitUseCellAsIdleDestination(unit, cell, { passageLookup: passages })
  )
}
