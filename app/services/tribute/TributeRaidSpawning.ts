import { FADE_DURATION_MS } from '../../constants'
import { getCellsAroundPoint, getFreeLandCellAroundInstance } from '../../lib'
import { createNonReservedPassageCellCondition } from '../../lib/buildings/passageCells'
import { fadeOut } from '../../lib/entities/entityFade'
import { setUnitOverheadIndicator } from '../../lib/entities/overheadIndicator'
import type { GameContextLike } from '../../types/context'
import type { RuntimeCell } from '../../types/map'
import type { UnitEntity } from '../../types/entities'
import {
  RAID_SPAWN_MAX_RADIUS,
  RAID_SPAWN_MIN_RADIUS,
  isOpenRaidLandCell,
  type TributeRaidUnit,
} from '../TributeRaidRules'

export function findTributeRaidSpawnCells(context: GameContextLike, target: UnitEntity, count: number): RuntimeCell[] {
  const grid = context.map?.grid
  if (!grid) return []
  const cells: RuntimeCell[] = []
  const nonPassageCell = createNonReservedPassageCellCondition(context)
  for (let distance = RAID_SPAWN_MIN_RADIUS; distance <= RAID_SPAWN_MAX_RADIUS; distance++) {
    const ring = getCellsAroundPoint(
      target.i,
      target.j,
      grid,
      distance,
      cell => isOpenRaidLandCell(cell) && nonPassageCell(cell)
    )
    ring.sort(() => (context.map.random?.() ?? Math.random()) - 0.5)
    for (const cell of ring) {
      if (cells.includes(cell)) continue
      cells.push(cell)
      if (cells.length >= count) return cells
    }
  }
  const fallback = getFreeLandCellAroundInstance(target, grid, undefined, nonPassageCell)
  if (fallback) cells.push(fallback)
  return cells
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
