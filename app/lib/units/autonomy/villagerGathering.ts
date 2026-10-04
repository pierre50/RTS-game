import { BUILDING_TYPES } from '../../../constants'
import type { BuildingEntity, UnitEntity } from '../../../types/entities'
import type { RuntimeCell } from '../../../types/map'
import { canUnitUseCellAsIdleDestination, createReservedPassageCellLookup } from '../../buildings/passageCells'
import { belongsToSettlement, collectiveAnchor } from '../../economy/collectiveConstruction'
import { getCellsAroundPoint } from '../../grid/cells'
import { getInstancePath } from '../../grid/movement'
import { getEntitySpaceGrid, sameMapSpace } from '../../mapSpaces'
import { villagerAutonomySuspension } from './villagerAutonomyAvailability'

const RETRY_MS = 10000
const MAX_PATH_CHECKS = 8
const gathering = new WeakMap<UnitEntity, { anchor: BuildingEntity; cell: RuntimeCell }>()
const retryAt = new WeakMap<UnitEntity, number>()

function atCell(unit: UnitEntity, cell: RuntimeCell): boolean {
  return sameMapSpace(unit, cell) && unit.i === cell.i && unit.j === cell.j
}

/** Only our own movement remains interruptible by collective work. */
export function isVillagerGathering(unit: UnitEntity): boolean {
  const state = gathering.get(unit)
  if (!state) return false
  if (
    villagerAutonomySuspension(unit) ||
    unit.action ||
    unit.autonomousJob ||
    (unit.dest !== state.cell && !(unit.inactif && atCell(unit, state.cell)))
  ) {
    clearVillagerGathering(unit)
    return false
  }
  return true
}

export function clearVillagerGathering(unit: UnitEntity): void {
  gathering.delete(unit)
  retryAt.delete(unit)
}

function usableAnchor(unit: UnitEntity, building: BuildingEntity): boolean {
  return Boolean(
    building.owner === unit.owner &&
      building.isBuilt &&
      !building.isDead &&
      !building.isDestroyed &&
      sameMapSpace(unit, building)
  )
}

function hasSpace(unit: UnitEntity, cell: RuntimeCell): boolean {
  return !(unit.owner?.units ?? []).some(other => {
    if (other === unit || other.isDead || other.isDestroyed || !sameMapSpace(other, cell)) return false
    const reserved = isVillagerGathering(other) ? gathering.get(other)?.cell : null
    return [other, reserved].some(
      point => point && Math.max(Math.abs(point.i - cell.i), Math.abs(point.j - cell.j)) < 2
    )
  })
}

/** Called only after the collective planner found no useful task. No extra scheduler or saved order. */
export function gatherIdleVillager(unit: UnitEntity): void {
  if (villagerAutonomySuspension(unit) || unit.autonomousJob || unit.collectiveTask || unit.action) return
  const current = isVillagerGathering(unit) ? gathering.get(unit) : null
  if (current) {
    if (usableAnchor(unit, current.anchor) && canUnitUseCellAsIdleDestination(unit, current.cell)) return
    clearVillagerGathering(unit)
    unit.stop?.()
  }
  if (!unit.inactif || unit.dest || unit.path?.length) return
  const owner = unit.owner
  const map = unit.context?.map
  if (!owner || !map || !unit.sendToEvt) return
  const now = unit.context?.scheduler?.elapsedMs ?? 0
  if (now < (retryAt.get(unit) ?? 0)) return
  retryAt.set(unit, now + RETRY_MS)
  const grid = getEntitySpaceGrid(unit, map)
  if (!grid) return
  const home = collectiveAnchor(owner, unit)
  const anchors = owner.buildings
    .filter(
      building =>
        [BUILDING_TYPES.fireCamp, BUILDING_TYPES.townCenter].includes(building.type) &&
        usableAnchor(unit, building) &&
        belongsToSettlement(owner, home, building)
    )
    .sort(
      (a, b) =>
        Number(b.type === BUILDING_TYPES.fireCamp) - Number(a.type === BUILDING_TYPES.fireCamp) ||
        Math.hypot(a.i - unit.i, a.j - unit.j) - Math.hypot(b.i - unit.i, b.j - unit.j)
    )
  const passageLookup = createReservedPassageCellLookup(unit.context)
  for (const anchor of anchors) {
    const minRadius = Math.ceil((anchor.size ?? 1) / 2) + 1
    const cells = getCellsAroundPoint(
      anchor.i,
      anchor.j,
      grid,
      minRadius + 4,
      cell =>
        Math.max(Math.abs(cell.i - anchor.i), Math.abs(cell.j - anchor.j)) >= minRadius &&
        canUnitUseCellAsIdleDestination(unit, cell, { passageLookup }) &&
        hasSpace(unit, cell)
    ).sort((a, b) => Math.hypot(a.i - unit.i, a.j - unit.j) - Math.hypot(b.i - unit.i, b.j - unit.j))
    for (const cell of cells.slice(0, MAX_PATH_CHECKS)) {
      if (!atCell(unit, cell) && !getInstancePath(unit, cell.i, cell.j, map).length) continue
      gathering.set(unit, { anchor, cell })
      if (!atCell(unit, cell)) unit.sendToEvt(cell, null, { preserveAutonomy: true })
      return
    }
  }
}
