import { toolActivityAnchor, constructionToolPreparation, equipOwnedTool } from '../supplies/toolPreparation'
import { resolveResource } from '../../../classes/resources/CompactResourceSet'
import { collectGroundResource } from '../../hero/heroGroundCollection'
import { isHeroInteractionTargetReachable } from '../../hero/heroActionRange'
import { groundToolPlan } from '../supplies/groundToolRecovery'
import { knownResources } from '../autonomy/villagerKnownTargets'
import { VILLAGE_ACTIVITY_RADIUS } from '../../../config/villageActivity'
import { getUnitResourceCapacityRemaining } from '../../resources/resourceDelivery'
import { villagerAutonomySuspension } from '../autonomy/villagerAutonomyAvailability'
import { runAutonomyPlan, hasPendingAutonomyPlan } from '../../../services/AutonomyPlanningQueue'
import { planResourceApproach } from '../autonomy/villagerAutonomyTargeting'
import type { UnitEntity } from '../../../types/entities'

const gathering = new WeakMap<UnitEntity, 'wood' | 'stone'>()
const retries = new WeakMap<UnitEntity, number>()
const rejected = new WeakMap<UnitEntity, Map<string, number>>()
const targetKey = (target: { i: number; j: number; spaceId?: string | null }) =>
  `${target.spaceId ?? 'outside'}:${target.i}:${target.j}`
/** Small, known, local trips. No remote extraction and no replacement of explicit player orders. */
export function seekGroundToolMaterials(unit: UnitEntity): boolean {
  if (hasPendingAutonomyPlan(unit)) return true
  const previousTarget = unit.dest
  if (
    !unit.followingHero &&
    !unit.action &&
    unit.collectiveHome &&
    previousTarget &&
    ['GroundWood', 'GroundStone'].includes(previousTarget.type) &&
    Math.hypot(previousTarget.i - unit.collectiveHome.i, previousTarget.j - unit.collectiveHome.j) >
      VILLAGE_ACTIVITY_RADIUS &&
    constructionToolPreparation(unit, unit.owner)
  ) {
    unit.autonomousJob = null
    unit.stop?.()
  }
  const missing = groundToolPlan(unit)?.missing ?? []
  const material = gathering.get(unit)
  if (material && (!missing.includes(material) || !constructionToolPreparation(unit, unit.owner))) {
    gathering.delete(unit)
    if (unit.action === (material === 'wood' ? 'chopwood' : 'minestone')) {
      unit.autonomousJob = null
      unit.stop?.()
    }
  }
  if (
    unit.followingHero ||
    unit.isChief ||
    unit.campPatrolAnchor ||
    unit.banditCampAnchor ||
    unit.actionLocked ||
    unit.combatMode ||
    !unit.inactif ||
    unit.action ||
    unit.dest ||
    unit.path?.length ||
    villagerAutonomySuspension(unit)
  )
    return false
  if (!missing.length) return false
  const anchor = toolActivityAnchor(unit, unit.owner)
  if (constructionToolPreparation(unit, unit.owner))
    unit.collectiveHome = { i: anchor.i, j: anchor.j, spaceId: anchor.spaceId }
  const now = unit.context?.scheduler?.elapsedMs ?? 0
  if (now < (retries.get(unit) ?? 0)) return false
  retries.set(unit, now + 10000)
  const area = { i: anchor.i, j: anchor.j, radius: VILLAGE_ACTIVITY_RADIUS }
  const useful = missing.filter(material => getUnitResourceCapacityRemaining(unit, material) >= 1)
  if (!useful.length) return unit.sendToDelivery?.() === true
  const failures = rejected.get(unit) ?? new Map<string, number>()
  rejected.set(unit, failures)
  for (const [key, until] of failures) if (until <= now) failures.delete(key)
  return runAutonomyPlan(
    unit,
    function* (incremental) {
      const types = useful.map(material => (material === 'wood' ? 'GroundWood' : 'GroundStone'))
      const targets = knownResources(unit, types, 16, area)
        .filter(
          target =>
            Math.hypot(target.i - anchor.i, target.j - anchor.j) <= area.radius && !failures.has(targetKey(target))
        )
        .sort((a, b) => Math.hypot(a.i - unit.i, a.j - unit.j) - Math.hypot(b.i - unit.i, b.j - unit.j))
      if (incremental) yield
      // Bound pathfinding attempts per retry; compare both needed materials before choosing.
      for (const record of targets.slice(0, 3)) {
        const target = resolveResource(record)
        if (target.isDestroyed || target.isDead || (target.quantity ?? 0) <= 0) continue
        if (isHeroInteractionTargetReachable(unit, null, target)) {
          if (collectGroundResource(unit, target)) {
            retries.delete(unit)
            return true
          }
        } else {
          const route = yield* planResourceApproach(unit, target, '', incremental)
          if (
            !target.isDestroyed &&
            !target.isDead &&
            (target.quantity ?? 0) > 0 &&
            route.length !== null &&
            route.valid()
          ) {
            const sent: unknown = route.commit(() => unit.sendToEvt?.(target, null))
            if (sent === true || (sent !== false && unit.dest === target)) {
              retries.delete(unit)
              unit.collectiveHome = { i: anchor.i, j: anchor.j, spaceId: anchor.spaceId }
              return true
            }
          }
        }
        failures.set(targetKey(target), (unit.context?.scheduler?.elapsedMs ?? now) + 30000)
      }
      if (targets.length) return false
      for (const material of useful) {
        if (equipOwnedTool(unit, material === 'wood' ? 'axe' : 'pickaxe')) {
          const target = knownResources(unit, material === 'wood' ? 'Tree' : 'Stone', 3, area).find(
            target => Math.hypot(target.i - anchor.i, target.j - anchor.j) <= VILLAGE_ACTIVITY_RADIUS
          )
          if (target) {
            const resolved = resolveResource(target)
            const route = yield* planResourceApproach(
              unit,
              resolved,
              material === 'wood' ? 'chopwood' : 'minestone',
              incremental
            )
            if (
              resolved.isDestroyed ||
              resolved.isDead ||
              (resolved.quantity ?? 0) <= 0 ||
              route.length === null ||
              !route.valid()
            )
              continue
            const sent = route.commit(() =>
              material === 'wood' ? unit.sendToTree?.(resolved) : unit.sendToStone?.(resolved)
            )
            if (sent !== false) {
              unit.collectiveHome = { i: anchor.i, j: anchor.j, spaceId: anchor.spaceId }
              gathering.set(unit, material)
              return true
            }
          }
        }
      }
      return false
    },
    (_accepted, cancelled) => {
      if (cancelled) retries.delete(unit)
    }
  )
}
