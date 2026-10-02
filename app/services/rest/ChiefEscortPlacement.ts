import { isLivingChief } from '../../lib/chief'
import { isChiefEscort, getChiefAudienceBuilding } from '../../lib/units/chiefEscort'
import { createReservedPassageCellLookup } from '../../lib/buildings/passageCells'
import { getEntitySpaceGrid, sameMapSpace } from '../../lib/mapSpaces'
import { getBuildingInteriorSpaceForUnit } from '../../../engine/services/BuildingInteriorSpaceLookup'
import { hasInteriorCombatRoute } from '../../lib/units/interiorCombat'
import { isUnitRestWakeLocked } from './UnitRestRules'
import { placeUnitAtCell, stopUnitForRest } from './UnitRestState'
import type { GameContextLike } from '../../types/context'
import type { UnitEntity } from '../../types/entities'
import type { RuntimeCell } from '../../types/map'

/** Activation/time jumps only: establish the escort's post before checking its daily rest. */
export function settleChiefEscortAtPost(unit: UnitEntity, context: GameContextLike): boolean {
  if (!isChiefEscort(unit) || unit.isDead || unit.isDestroyed) return false
  const chief = unit.owner?.units.find(isLivingChief)
  if (!chief || getChiefAudienceBuilding(chief, context)) return false
  for (const member of [chief, unit]) {
    if (
      member.pendingOrder ||
      member.spacePortalState ||
      member.lookingAtHero ||
      member.combatMode ||
      member.action === 'attack' ||
      member.action === 'flee' ||
      member.waitingForEnergyAction ||
      hasInteriorCombatRoute(member) ||
      isUnitRestWakeLocked(member) ||
      (member.actionLocked && !member.shelterState) ||
      Boolean((member as UnitEntity & { factionExpedition?: unknown }).factionExpedition) ||
      Boolean((member.dest as UnitEntity | null)?.owner && member.owner?.isEnemy?.((member.dest as UnitEntity).owner))
    )
      return false
  }
  const anchor = chief.shelterState?.shelter ?? getBuildingInteriorSpaceForUnit(chief)?.building ?? chief
  // Interior visits and portal transfers keep their normal, explicit movement rules.
  if (!sameMapSpace(unit, anchor)) return false
  const radius = anchor === chief ? 2 : (anchor.size ?? 2) + 1
  const passages = createReservedPassageCellLookup(context)
  const grid = getEntitySpaceGrid(anchor, context.map)
  if (!grid) return false
  const valid = (cell: RuntimeCell): boolean =>
    Math.hypot(cell.i - anchor.i, cell.j - anchor.j) <= radius &&
    (!cell.solid || cell.has === unit) &&
    (!cell.has || cell.has === unit) &&
    !cell.border &&
    !cell.waterBorder &&
    !cell.inclined &&
    cell.category !== 'Water' &&
    (anchor.z == null || cell.z === anchor.z) &&
    !passages.has(cell)
  let target: RuntimeCell | undefined = grid[unit.i]?.[unit.j]
  if (!target || !valid(target)) {
    let nearest = Infinity
    target = undefined
    for (let i = Math.max(0, Math.floor(anchor.i - radius)); i <= Math.ceil(anchor.i + radius); i++) {
      for (let j = Math.max(0, Math.floor(anchor.j - radius)); j <= Math.ceil(anchor.j + radius); j++) {
        const cell = grid[i]?.[j]
        if (!cell || !valid(cell)) continue
        const distance = Math.hypot(i - anchor.i, j - anchor.j)
        if (distance < nearest) {
          target = cell
          nearest = distance
        }
      }
    }
  }
  if (!target) return false
  stopUnitForRest(unit)
  unit.dest = null
  unit.action = null
  if (unit.shelterState) {
    unit.shelterState.previousDest = null
    unit.shelterState.previousAction = null
  }
  if (unit.currentCell !== target) placeUnitAtCell(unit, target)
  return true
}
