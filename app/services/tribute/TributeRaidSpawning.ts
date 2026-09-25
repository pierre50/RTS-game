import { CELL_DEPTH, CELL_HEIGHT, CELL_WIDTH, FADE_DURATION_MS } from '../../constants'
import { cartesianToIsometric } from '../../lib/maths'
import { getBuildingContactDistance } from '../../lib/grid/cells'
import { createNonReservedPassageCellCondition } from '../../lib/buildings/passageCells'
import { fadeOut } from '../../lib/entities/entityFade'
import { setUnitOverheadIndicator } from '../../lib/entities/overheadIndicator'
import type { GameContextLike } from '../../types/context'
import type { RuntimeCell } from '../../types/map'
import type { UnitEntity } from '../../types/entities'
import type { FactionSave } from '../../types/save'
import {
  RAID_SPAWN_BUILDING_CLEARANCE,
  RAID_SPAWN_MAX_RADIUS,
  RAID_SPAWN_MIN_RADIUS,
  RAID_SPAWN_SEARCH_MARGIN,
  RAID_SPAWN_RADIUS_LIMIT,
  RAID_SPAWN_SEARCH_BUDGET,
  RAID_SPAWN_GROUP_RADIUS,
  RAID_SPAWN_CAMERA_MARGIN,
  getRaidCellDistance,
  isOpenRaidLandCell,
  type TributeRaidUnit,
} from './TributeRaidRules'

type SpawnDirection = { horizontal: 'east' | 'west' | null; vertical: 'north' | 'south' | null }
type SpawnOptions = { faction?: FactionSave | null }
const STEPS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const

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

/** One bounded flood establishes a local route; no map-edge scan or per-cell A* calls. */
export function findTributeRaidSpawnCells(
  context: GameContextLike,
  target: UnitEntity,
  count: number,
  options: SpawnOptions = {}
): RuntimeCell[] {
  const map = context.map
  const rect = context.controls?.getViewportMetrics?.()
  if (!map?.grid || !rect || !Number.isSafeInteger(count) || count <= 0 || count > 169) return []
  if ((target.spaceId ?? 'outside') !== 'outside' || map.mapType === 'interior') return []
  if (![rect.visibleLeft, rect.visibleTop, rect.visibleWidth, rect.visibleHeight].every(Number.isFinite)) return []
  const [heroX, heroFlatY] = cartesianToIsometric(target.i, target.j)
  const heroY = heroFlatY - (target.z ?? 0) * CELL_DEPTH
  // Expand only enough to clear the closest viewport edge, with room for the formation.
  const margin = RAID_SPAWN_CAMERA_MARGIN
  const distanceToHiddenLand = Math.max(
    0,
    Math.min(
      ((heroX - rect.visibleLeft + margin) * Math.SQRT2) / CELL_WIDTH,
      ((rect.visibleLeft + rect.visibleWidth + margin - heroX) * Math.SQRT2) / CELL_WIDTH,
      ((heroY - rect.visibleTop + margin) * Math.SQRT2) / CELL_HEIGHT,
      ((rect.visibleTop + rect.visibleHeight + margin - heroY) * Math.SQRT2) / CELL_HEIGHT
    )
  )
  const maxRadius = Math.min(
    RAID_SPAWN_RADIUS_LIMIT,
    Math.max(RAID_SPAWN_MAX_RADIUS, Math.ceil(distanceToHiddenLand) + RAID_SPAWN_GROUP_RADIUS * 2)
  )
  const searchRadius = maxRadius + RAID_SPAWN_SEARCH_MARGIN
  const nonPassage = createNonReservedPassageCellCondition(context)
  const buildings = (context.players ?? (target.owner ? [target.owner] : []))
    .flatMap(owner => owner.buildings ?? [])
    .filter(
      building =>
        !building.isDead &&
        !building.isDestroyed &&
        (building.spaceId ?? 'outside') === 'outside' &&
        getRaidCellDistance(building, target) <= searchRadius + (building.size ?? 1)
    )
  const key = (i: number, j: number) => `${i}:${j}`
  const visited = new Set<string>([key(target.i, target.j)])
  const reachable = new Map<string, RuntimeCell>()
  const queue: { i: number; j: number }[] = [{ i: target.i, j: target.j }]
  for (let head = 0; head < queue.length && head < RAID_SPAWN_SEARCH_BUDGET; head++) {
    const current = queue[head]
    for (const [di, dj] of STEPS) {
      const i = current.i + di,
        j = current.j + dj
      if (Math.abs(i - target.i) > searchRadius || Math.abs(j - target.j) > searchRadius) continue
      const id = key(i, j)
      if (visited.has(id) || visited.size >= RAID_SPAWN_SEARCH_BUDGET) continue
      visited.add(id)
      const cell = map.grid[i]?.[j]
      if (!isOpenRaidLandCell(cell)) continue
      reachable.set(id, cell)
      queue.push(cell)
    }
  }
  const candidates = [...reachable.values()].filter(cell => {
    const distance = getRaidCellDistance(cell, target)
    if (distance < RAID_SPAWN_MIN_RADIUS || distance > maxRadius || cell.inclined || !nonPassage(cell)) return false
    const [x, flatY] = cartesianToIsometric(cell.i, cell.j)
    const y = flatY - (cell.z ?? 0) * CELL_DEPTH
    const margin = RAID_SPAWN_CAMERA_MARGIN
    if (
      x >= rect.visibleLeft - margin &&
      x <= rect.visibleLeft + rect.visibleWidth + margin &&
      y >= rect.visibleTop - margin &&
      y <= rect.visibleTop + rect.visibleHeight + margin
    )
      return false
    return buildings.every(
      building =>
        getRaidCellDistance(cell, building) >
        getBuildingContactDistance(building.size ?? 1) + RAID_SPAWN_BUILDING_CLEARANCE
    )
  })
  // Shuffle once, then retain the faction's approximate approach direction when known.
  for (let index = candidates.length - 1; index > 0; index--) {
    const other = Math.floor((map.random?.() ?? Math.random()) * (index + 1))
    ;[candidates[index], candidates[other]] = [candidates[other], candidates[index]]
  }
  const direction = factionSpawnDirection(context, options.faction)
  const score = (cell: RuntimeCell) =>
    (direction.horizontal === 'east' ? -cell.j : direction.horizontal === 'west' ? cell.j : 0) +
    (direction.vertical === 'south' ? -cell.i : direction.vertical === 'north' ? cell.i : 0)
  if (direction.horizontal || direction.vertical) candidates.sort((a, b) => score(a) - score(b))
  const allowed = new Map(candidates.map(cell => [key(cell.i, cell.j), cell]))
  // Limit formation attempts too. Every member shares a connected, safe local footprint.
  for (const entry of candidates.slice(0, 32)) {
    const group = [entry]
    const seen = new Set([key(entry.i, entry.j)])
    for (let head = 0; head < group.length && group.length < count; head++) {
      for (const [di, dj] of STEPS) {
        const i = group[head].i + di,
          j = group[head].j + dj
        const id = key(i, j),
          cell = allowed.get(id)
        if (!cell || seen.has(id) || Math.max(Math.abs(i - entry.i), Math.abs(j - entry.j)) > RAID_SPAWN_GROUP_RADIUS)
          continue
        seen.add(id)
        group.push(cell)
        if (group.length === count) break
      }
    }
    if (group.length === count) return group
  }
  return []
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
