import { FADE_DURATION_MS } from '../../constants'
import { getCellsAroundPoint } from '../../lib'
import { getBuildingContactDistance } from '../../lib/grid/cells'
import { createNonReservedPassageCellCondition } from '../../lib/buildings/passageCells'
import { fadeOut } from '../../lib/entities/entityFade'
import { setUnitOverheadIndicator } from '../../lib/entities/overheadIndicator'
import { findInstancePath } from '../Pathfinding'
import type { GameContextLike } from '../../types/context'
import type { BuildingEntity } from '../../types/entities'
import type { RuntimeCell, RuntimeMap } from '../../types/map'
import type { UnitEntity } from '../../types/entities'
import type { FactionSave } from '../../types/save'
import {
  RAID_SPAWN_BUILDING_CLEARANCE,
  RAID_SPAWN_EDGE_BAND,
  RAID_SPAWN_MAX_RADIUS,
  RAID_SPAWN_MIN_RADIUS,
  getRaidCellDistance,
  isOpenRaidLandCell,
  type TributeRaidUnit,
} from './TributeRaidRules'

type SpawnDirection = {
  horizontal: 'east' | 'west' | null
  vertical: 'north' | 'south' | null
}

type SpawnOptions = {
  faction?: FactionSave | null
}

function isAwayFromOwnedBuildings(cell: RuntimeCell, buildings: readonly BuildingEntity[]): boolean {
  return buildings.every(building => {
    if (building.isDead || building.isDestroyed) return true
    const distance = getRaidCellDistance(cell, building)
    const minDistance = getBuildingContactDistance(building.size ?? 1) + RAID_SPAWN_BUILDING_CLEARANCE
    return distance > minDistance
  })
}

function factionSpawnDirection(context: GameContextLike, faction?: FactionSave | null): SpawnDirection {
  const currentRegion = context.map?.worldRegion
  const settlements = context.map?.worldManifest?.settlements ?? []
  const settlement = faction
    ? settlements.find(
        entry =>
          typeof entry === 'object' &&
          entry &&
          ('factionId' in entry || 'civ' in entry) &&
          ((entry as { factionId?: string | null }).factionId === faction.id ||
            (entry as { civ?: string }).civ === faction.civilization)
      )
    : null
  const settlementRegion =
    settlement && typeof settlement === 'object' && 'region' in settlement
      ? (settlement as { region?: { x?: number; y?: number } }).region
      : null

  if (!currentRegion || typeof settlementRegion?.x !== 'number' || typeof settlementRegion?.y !== 'number') {
    return { horizontal: null, vertical: null }
  }

  const dx = settlementRegion.x - currentRegion.x
  const dy = settlementRegion.y - currentRegion.y
  return {
    horizontal: dx < 0 ? 'west' : dx > 0 ? 'east' : null,
    vertical: dy < 0 ? 'north' : dy > 0 ? 'south' : null,
  }
}

function edgeScore(cell: RuntimeCell, grid: RuntimeMap['grid'], direction: SpawnDirection): number {
  const maxI = grid.length - 1
  const maxJ = Math.max(0, (grid[cell.i]?.length ?? 1) - 1)
  let score = 0
  if (direction.vertical === 'north') score += cell.i
  else if (direction.vertical === 'south') score += maxI - cell.i
  else score += Math.min(cell.i, maxI - cell.i)

  if (direction.horizontal === 'west') score += cell.j
  else if (direction.horizontal === 'east') score += maxJ - cell.j
  else score += Math.min(cell.j, maxJ - cell.j)

  const cornerDistance = Math.min(cell.i, maxI - cell.i) + Math.min(cell.j, maxJ - cell.j)
  return score + cornerDistance * 0.2
}

function getEdgeSpawnCandidates(
  grid: RuntimeMap['grid'],
  canSpawnOnCell: (cell: RuntimeCell) => boolean,
  direction: SpawnDirection
): RuntimeCell[] {
  const candidates: RuntimeCell[] = []
  const maxI = grid.length - 1
  for (const row of grid) {
    if (!row) continue
    const maxJ = row.length - 1
    for (const cell of row) {
      if (!cell || !canSpawnOnCell(cell)) continue
      const onEdge =
        cell.i <= RAID_SPAWN_EDGE_BAND ||
        cell.j <= RAID_SPAWN_EDGE_BAND ||
        maxI - cell.i <= RAID_SPAWN_EDGE_BAND ||
        maxJ - cell.j <= RAID_SPAWN_EDGE_BAND
      if (onEdge) candidates.push(cell)
    }
  }
  return candidates.sort((a, b) => edgeScore(a, grid, direction) - edgeScore(b, grid, direction))
}

function getApproachCells(
  grid: RuntimeMap['grid'],
  target: UnitEntity,
  nonPassageCell: (cell: RuntimeCell) => boolean
): RuntimeCell[] {
  const approachCells: RuntimeCell[] = []
  for (let distance = 1; distance <= RAID_SPAWN_MIN_RADIUS; distance++) {
    approachCells.push(
      ...getCellsAroundPoint(target.i, target.j, grid, distance, cell => isOpenRaidLandCell(cell) && nonPassageCell(cell))
    )
    if (approachCells.length) return approachCells
  }
  return approachCells
}

function hasPathToTarget(
  context: GameContextLike,
  start: RuntimeCell,
  approachCells: RuntimeCell[]
): boolean {
  return approachCells.some(cell => {
    if (cell === start) return true
    return findInstancePath({ i: start.i, j: start.j, label: 'tribute-raid-spawn-probe' }, cell.i, cell.j, context.map)
      .length
  })
}

function appendReachableSpawnCellsFromRings(
  context: GameContextLike,
  cells: RuntimeCell[],
  origin: { i: number; j: number },
  minDistance: number,
  maxDistance: number,
  count: number,
  canSpawnOnCell: (cell: RuntimeCell) => boolean,
  approachCells: RuntimeCell[]
): RuntimeCell[] {
  for (let distance = minDistance; distance <= maxDistance && cells.length < count; distance++) {
    const ring = getCellsAroundPoint(origin.i, origin.j, context.map.grid, distance, cell => {
      return canSpawnOnCell(cell) && hasPathToTarget(context, cell, approachCells)
    })
    ring.sort(() => (context.map.random?.() ?? Math.random()) - 0.5)
    for (const cell of ring) {
      if (cells.includes(cell)) continue
      cells.push(cell)
      if (cells.length >= count) return cells
    }
  }
  return cells
}

function collectSpawnGroup(
  context: GameContextLike,
  entryCell: RuntimeCell,
  count: number,
  canSpawnOnCell: (cell: RuntimeCell) => boolean,
  approachCells: RuntimeCell[]
): RuntimeCell[] {
  const cells: RuntimeCell[] = [entryCell]
  return appendReachableSpawnCellsFromRings(
    context,
    cells,
    entryCell,
    1,
    RAID_SPAWN_EDGE_BAND,
    count,
    canSpawnOnCell,
    approachCells
  )
}

function findFallbackSpawnCells(
  context: GameContextLike,
  target: UnitEntity,
  count: number,
  canSpawnOnCell: (cell: RuntimeCell) => boolean,
  approachCells: RuntimeCell[]
): RuntimeCell[] {
  const cells: RuntimeCell[] = []
  return appendReachableSpawnCellsFromRings(
    context,
    cells,
    target,
    RAID_SPAWN_MIN_RADIUS,
    RAID_SPAWN_MAX_RADIUS,
    count,
    canSpawnOnCell,
    approachCells
  )
}

export function findTributeRaidSpawnCells(
  context: GameContextLike,
  target: UnitEntity,
  count: number,
  options: SpawnOptions = {}
): RuntimeCell[] {
  const grid = context.map?.grid
  if (!grid) return []
  const nonPassageCell = createNonReservedPassageCellCondition(context)
  const protectedBuildings = target.owner?.buildings ?? []
  const canSpawnOnCell = (cell: RuntimeCell) =>
    isOpenRaidLandCell(cell) && nonPassageCell(cell) && isAwayFromOwnedBuildings(cell, protectedBuildings)
  const approachCells = getApproachCells(grid, target, nonPassageCell)
  if (!approachCells.length) return []

  const direction = factionSpawnDirection(context, options.faction)
  const edgeCandidates = getEdgeSpawnCandidates(grid, canSpawnOnCell, direction)
  for (const entryCell of edgeCandidates) {
    if (!hasPathToTarget(context, entryCell, approachCells)) continue
    const group = collectSpawnGroup(context, entryCell, count, canSpawnOnCell, approachCells)
    if (group.length >= count) return group
  }

  return findFallbackSpawnCells(context, target, count, canSpawnOnCell, approachCells)
}

export function removeTributeRaidUnitFromRuntime(unit: TributeRaidUnit): void {
  unit.stop?.()
  setUnitOverheadIndicator(unit, null)
  const cell = unit.currentCell
  if (cell?.has === unit) {
    cell.has = null
    cell.solid = false
  }
  unit.context?.map?.removeFromInstanceBucket(unit)
  const ownerUnits = unit.owner?.units
  const index = ownerUnits?.indexOf(unit) ?? -1
  if (index >= 0) ownerUnits?.splice(index, 1)
  if (unit.owner) unit.owner.population = Math.max(0, (unit.owner.population ?? 0) - 1)
  fadeOut(unit, FADE_DURATION_MS, () => {
    unit.isDestroyed = true
    unit.context?.map?.removeChild(unit)
    unit.destroy?.({ children: true, texture: false })
  })
}
