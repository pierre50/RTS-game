import { isBuildingInteriorRuntimeSpace } from '../../../engine/services/BuildingInteriorSpaceLookup'
import { canUnitEnterBuildingInterior } from '../../lib/buildings/interiorAccess'
import { getInstancePath } from '../../lib/grid/movement'
import { getEntitySpaceId, getMapSpace, sameCellMapSpace } from '../../lib/mapSpaces'
import type { UnitEntity, UnitRestState } from '../../types/entities'
import type { RuntimeCell, RuntimeMapSpacePortal } from '../../types/map'
import { routeUnitThroughSpacePortal } from '../spacePortal/SpacePortalSystem'

type RestLeg = { from: RuntimeCell; to: RuntimeCell; portal?: RuntimeMapSpacePortal }

/** Rest uses the same doors in both directions, including between two interiors. */
export function getRestRoute(unit: UnitEntity, target: RuntimeCell): RestLeg[] | null {
  const map = unit.context?.map
  if (!map) return null
  let from = getMapSpace(map, unit.spaceId)?.grid[unit.i]?.[unit.j] ?? unit.currentCell ?? map.grid[unit.i]?.[unit.j]
  if (!from) return null
  const legs: RestLeg[] = []
  let spaceId = getEntitySpaceId(unit)
  const targetSpaceId = target.spaceId || 'outside'
  const visited = new Set<string>()
  while (spaceId !== targetSpaceId) {
    if (visited.has(spaceId)) return null
    visited.add(spaceId)
    const space = getMapSpace(map, spaceId === 'outside' ? targetSpaceId : spaceId)
    if (!isBuildingInteriorRuntimeSpace(space)) return null
    const building = space.building
    if (
      !building ||
      building.owner !== unit.owner ||
      !building.isBuilt ||
      building.isDead ||
      building.isDestroyed ||
      !canUnitEnterBuildingInterior(unit, building)
    )
      return null
    const portal = space.portals?.find(
      p => p.sourceSpaceId === spaceId && (spaceId !== 'outside' || p.targetSpaceId === targetSpaceId)
    )
    if (!portal?.sourceCell || !portal.targetCell) return null
    legs.push({ from, to: portal.sourceCell, portal })
    from = portal.targetCell
    spaceId = portal.targetSpaceId
  }
  legs.push({ from, to: target })
  return legs
}

export function getRestTravelPathLength(unit: UnitEntity, target: RuntimeCell): number | null {
  const legs = getRestRoute(unit, target)
  if (!legs) return null
  let length = 0
  for (const leg of legs) {
    if (leg.from.i === leg.to.i && leg.from.j === leg.to.j) continue
    const traveller = { ...unit, i: leg.from.i, j: leg.from.j, spaceId: leg.from.spaceId, currentCell: leg.from }
    const path = getInstancePath(traveller, leg.to.i, leg.to.j, unit.context!.map)
    if (!path.length) return null
    length += path.length
  }
  return length
}

export function routeUnitToRestTarget(unit: UnitEntity, state: UnitRestState): boolean {
  const target = state.targetCell
  if (!target || !unit.context) return false
  const route = getRestRoute(unit, target)
  if (!route) return false
  state.startedAtMs = unit.context.scheduler?.elapsedMs ?? 0
  const portal = route[0]?.portal
  if (portal)
    return routeUnitThroughSpacePortal(unit.context, unit, portal, {
      shouldContinue: () =>
        unit.shelterState === state &&
        !unit.isDead &&
        !unit.isDestroyed &&
        !state.restTarget?.isDead &&
        !state.restTarget?.isDestroyed,
      onTransferred: () => {
        if (unit.shelterState === state) routeUnitToRestTarget(unit, state)
      },
    })
  if (!sameCellMapSpace(unit, target)) return false
  unit.sendToEvt?.(target, null, { forceRepath: true, preserveAutonomy: true })
  return true
}
