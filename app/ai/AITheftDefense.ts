import { ACTION_TYPES, UNIT_TYPES } from '../constants'
import { isChiefUnit } from '../lib/chief'
import { hasInteriorCombatCapacity } from '../lib/buildings/interiorCombatCapacity'
import { getEntitySpaceId, sameMapSpace } from '../lib/mapSpaces'
import { playerSeesTarget } from '../lib/units/playerTargetKnowledge'
import { getBuildingInteriorSpaceForUnit } from '../../engine/services/BuildingInteriorSpaceLookup'
import { clearUnitSpacePortalRoute, routeUnitThroughSpacePortal } from '../services/SpacePortalSystem'
import type { BuildingInteriorRuntimeSpace } from '../../engine/services/BuildingInteriorSpaceTypes'
import type { UnitEntity } from '../types/entities'
import type { PlayerLike } from '../types/player'

const incidents = new WeakMap<
  PlayerLike,
  { actor: UnitEntity; space: BuildingInteriorRuntimeSpace; defenders: UnitEntity[]; expiresAt: number }
>()
const alive = (unit: UnitEntity) => !unit.isDead && !unit.isDestroyed && (unit.hitPoints ?? 1) > 0
const hostile = (owner: PlayerLike, actor: UnitEntity) =>
  Boolean(owner.isEnemy?.(actor.owner) || actor.owner?.isEnemy?.(owner))

/** The theft itself alerts the owner to this building, even without interior vision. */
export function reportInteriorTheft(owner: PlayerLike, actor: UnitEntity): void {
  if (!actor.context || !hostile(owner, actor)) return
  const space = getBuildingInteriorSpaceForUnit(actor)
  if (!space || space.building.owner?.label !== owner.label) return
  const existing = incidents.get(owner)
  if (existing?.actor === actor && existing.space === space) {
    existing.expiresAt = (actor.context.scheduler?.elapsedMs ?? 0) + 30000
    return
  }
  const defenders = (owner.units ?? [])
    .filter(unit => {
      if (!alive(unit) || unit.controlMode === 'hero' || unit.action === ACTION_TYPES.train) return false
      if (!isChiefUnit(unit) && unit.type !== UNIT_TYPES.villager) return false
      if ((unit.hitPoints ?? 1) <= (unit.totalHitPoints ?? 1) * 0.35) return false
      if (sameMapSpace(unit, actor)) return true
      return (
        getEntitySpaceId(unit) === space.entryPortal.sourceSpaceId &&
        Math.abs(unit.i - space.building.i) + Math.abs(unit.j - space.building.j) <= 12
      )
    })
    .sort(
      (a, b) =>
        Number(isChiefUnit(b)) - Number(isChiefUnit(a)) ||
        Number(sameMapSpace(b, actor)) - Number(sameMapSpace(a, actor)) ||
        Math.abs(a.i - space.building.i) +
          Math.abs(a.j - space.building.j) -
          Math.abs(b.i - space.building.i) -
          Math.abs(b.j - space.building.j)
    )
    .slice(0, 4)
  incidents.set(owner, { actor, space, defenders, expiresAt: (actor.context.scheduler?.elapsedMs ?? 0) + 30000 })
  handleInteriorTheftDefense(owner)
}

export function handleInteriorTheftDefense(owner: PlayerLike): boolean {
  const incident = incidents.get(owner)
  if (!incident) return false
  const { actor, space, defenders } = incident
  const context = actor.context
  if (
    !context ||
    !alive(actor) ||
    !hostile(owner, actor) ||
    space.building.isDead ||
    space.building.isDestroyed ||
    (context.scheduler?.elapsedMs ?? 0) >= incident.expiresAt ||
    !defenders.some(alive)
  ) {
    incidents.delete(owner)
    for (const unit of defenders) {
      if (!alive(unit)) continue
      clearUnitSpacePortalRoute(unit)
      unit.stop?.()
      if (context && getEntitySpaceId(unit) === space.id && !space.building.isDestroyed) {
        routeUnitThroughSpacePortal(context, unit, space.exitPortal, {
          onTransferred: () => unit.affectNewDest?.(),
        })
      } else {
        unit.affectNewDest?.()
      }
    }
    return false
  }
  const seen = playerSeesTarget(owner, actor)
  if (seen) incident.expiresAt = (context.scheduler?.elapsedMs ?? 0) + 30000
  for (const unit of defenders) {
    if (!alive(unit) || unit.spacePortalState) continue
    if (sameMapSpace(unit, actor)) {
      if (seen && (unit.dest !== actor || unit.action !== ACTION_TYPES.attack)) {
        unit.sendToAttack?.(actor, { keepPrevious: true })
      }
      continue
    }
    // Search the alerted building; leave again if the thief escaped through its door.
    const entering = getEntitySpaceId(unit) === space.entryPortal.sourceSpaceId && getEntitySpaceId(actor) === space.id
    const exiting = getEntitySpaceId(unit) === space.id && getEntitySpaceId(actor) === space.exitPortal.targetSpaceId
    if (!entering && !exiting) continue
    const hasRoom = () => hasInteriorCombatCapacity(context, space, unit)
    if (entering && !hasRoom()) continue
    routeUnitThroughSpacePortal(context, unit, entering ? space.entryPortal : space.exitPortal, {
      combatTarget: actor,
      shouldContinue: () =>
        incidents.get(owner) === incident &&
        alive(actor) &&
        hostile(owner, actor) &&
        getEntitySpaceId(actor) === (entering ? space.id : space.exitPortal.targetSpaceId),
      canTransfer: entering ? hasRoom : undefined,
      onTransferred: () => {
        if (alive(actor) && hostile(owner, actor) && sameMapSpace(unit, actor) && playerSeesTarget(owner, actor)) {
          unit.sendToAttack?.(actor, { keepPrevious: true })
        }
      },
    })
  }
  return true
}

export function isInteriorTheftDefender(unit: { owner?: PlayerLike | null }): boolean {
  return Boolean(unit.owner && incidents.get(unit.owner)?.defenders.includes(unit as UnitEntity))
}
