import { canChiefEscortRest, getChiefAudienceBuilding, getChiefEscorts } from '../lib/units/chiefEscort'
import { isLivingChief } from '../lib/chief'
import { getPositionInGridAroundInstance } from '../lib/grid/placement'
import { getEntitySpaceGrid, sameMapSpace } from '../lib/mapSpaces'
import { sameBuilding } from '../lib/buildings/identity'
import { hasInteriorCombatRoute } from '../lib/units/interiorCombat'
import { getBuildingInteriorSpaceForUnit } from '../../engine/services/BuildingInteriorSpaceLookup'
import type { RuntimeCell } from '../types/map'
import type { GameContextLike } from '../types/context'
import type { UnitEntity } from '../types/entities'

function busy(unit: UnitEntity): boolean {
  return Boolean(
    unit.actionLocked ||
      unit.lookingAtHero ||
      unit.pendingOrder ||
      unit.spacePortalState ||
      hasInteriorCombatRoute(unit) ||
      unit.action === 'attack' ||
      unit.combatMode
  )
}

/** Receive the hero in the town center; the escort stays within two tiles of its chief. */
export function updateChiefEscorts(units: UnitEntity[], context: GameContextLike): number {
  let actions = 0
  for (const chief of units.filter(isLivingChief)) {
    if (chief.controlMode === 'hero') continue
    const interior = getBuildingInteriorSpaceForUnit(chief)
    const audience = getChiefAudienceBuilding(chief, context)
    if (!chief.shelterState && !busy(chief)) {
      if (audience && !sameBuilding(interior?.building, audience)) {
        if (context.routeUnitIntoBuildingInterior?.(chief, audience)) actions++
      } else if (!audience && interior?.building.type === 'TownCenter' && interior.building.owner === chief.owner) {
        context.routeInteriorUnitToExit?.(chief)
      }
    }
    for (const escort of getChiefEscorts(chief)) {
      if (escort.shelterState) {
        if (canChiefEscortRest(escort)) continue
        context.unitRest?.wakeRestingUnitsInstant?.([escort])
      }
      if (busy(escort)) continue
      const escortInterior = getBuildingInteriorSpaceForUnit(escort)
      if (audience && !sameBuilding(escortInterior?.building, audience)) {
        if (context.routeUnitIntoBuildingInterior?.(escort, audience)) actions++
        continue
      }
      if (!audience && escortInterior) {
        if (escortInterior.building.type === 'TownCenter' && escortInterior.building.owner === chief.owner)
          context.routeInteriorUnitToExit?.(escort)
        continue
      }
      if (chief.action === 'attack' && chief.dest && sameMapSpace(chief, escort)) {
        if (escort.dest !== chief.dest || escort.action !== 'attack') {
          escort.sendTo?.(chief.dest, 'attack')
          actions++
        }
        continue
      }
      const anchor =
        audience && interior && sameMapSpace(chief, escort)
          ? chief
          : (chief.shelterState?.shelter ?? interior?.building ?? chief)
      if (!sameMapSpace(escort, anchor)) continue
      const radius = anchor === chief ? 2 : (anchor.size ?? 2) + 1
      if (Math.hypot(escort.i - anchor.i, escort.j - anchor.j) <= radius) continue
      if (
        escort.path?.length &&
        escort.dest &&
        sameMapSpace(escort.dest, anchor) &&
        Math.hypot(escort.dest.i - anchor.i, escort.dest.j - anchor.j) <= radius
      )
        continue
      const grid = getEntitySpaceGrid(escort, context.map)
      if (!grid) continue
      const cell = getPositionInGridAroundInstance(
        anchor,
        grid,
        [1, radius],
        0,
        false,
        cell => Math.hypot(cell.i - anchor.i, cell.j - anchor.j) <= radius
      )
      if (!cell) continue
      escort.sendTo?.(cell as RuntimeCell)
      actions++
    }
  }
  return actions
}
