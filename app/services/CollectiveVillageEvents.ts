import { constructionAssignment } from '../lib/economy/constructionAssignments'
import { UNIT_TYPES, DAILY_CONSUMPTION_PER_VILLAGER } from '../constants'
import type { PlayerLike } from '../types/player'
import {
  activeConstructionSite,
  collectiveAnchor,
  belongsToSettlement,
  collectivePosition,
} from '../lib/economy/collectiveConstruction'
import { collectiveNeeds, COLLECTIVE_WORK_POLICY } from '../lib/economy/collectiveNeeds'
import { settlementAvailableStock, settlementStockGoals } from '../lib/economy/collectiveStock'
import { constructionBagNeeds, materialAmount } from '../lib/economy/constructionMaterials'
import { getUnitResourceCarryRemaining } from '../lib/resources/resourceDelivery'
import { planDepotPickup } from '../lib/economy/depotPickup'
import { villagerAutonomySuspension } from '../lib/units/autonomy/villagerAutonomyAvailability'

/** Observe semantic changes, not footsteps, animation frames or individual resource increments.
 * The existing monitor collects them together; only a changed event snapshot requests a new plan.
 */
/** @public Loaded by tests/autonomy-recovery-regressions.test.cjs (loadTsModule). */
export function collectiveVillageEventSnapshot(owner: PlayerLike): string {
  const members = (owner.units ?? []).filter(
    unit => unit.type === UNIT_TYPES.villager && !unit.isDead && !unit.isDestroyed
  )
  const settlements = new Map<object, unknown>()
  const units = members.map(unit => {
    const anchor = collectiveAnchor(owner, unit)
    // Settlement identity is stable while walking: don't put unit coordinates in the snapshot.
    const site = activeConstructionSite(owner, unit)
    const key = site ?? anchor
    if (!settlements.has(key)) {
      const locals = members.filter(member => belongsToSettlement(owner, anchor, collectivePosition(member)))
      settlements.set(
        key,
        collectiveNeeds(
          locals.length,
          settlementStockGoals(owner, anchor, site),
          settlementAvailableStock(owner, anchor, locals)
        ).map(need => [need.resource, Math.ceil(need.missing / COLLECTIVE_WORK_POLICY.deliveryBatch)])
      )
    }
    const remaining = getUnitResourceCarryRemaining(unit)
    const bag = unit.inventory?.resources ?? {}
    const foodNeeded = Math.max(0, (DAILY_CONSUMPTION_PER_VILLAGER.food ?? 0) - materialAmount(bag, 'food'))
    const pickupNeeds = foodNeeded ? { food: foodNeeded } : site ? constructionBagNeeds(site, bag, remaining) : {}
    const pickup =
      remaining > 0 && Object.keys(pickupNeeds).length
        ? planDepotPickup(owner, unit, pickupNeeds, building => belongsToSettlement(owner, anchor, building))
        : undefined
    const assignment = constructionAssignment(unit)
    return [
      assignment?.resource && assignment.target != null
        ? materialAmount(bag, assignment.resource) >= assignment.target
        : false,
      unit.label,
      unit.type,
      unit.lastMealAt,
      unit.followingHero,
      unit.controlMode,
      villagerAutonomySuspension(unit),
      Boolean(unit.inactif),
      unit.collectiveTask,
      unit.autonomousJob,
      unit.action === 'attack' || unit.action === 'flee' || unit.action === 'train',
      unit.trainingTargetType,
      unit.resourceDeliveryState?.phase,
      unit.autonomyBlockedJob,
      pickup
        ? [pickup.building.label, pickup.building.i, pickup.building.j, Object.keys(pickup.resources).sort()]
        : null,
      remaining <= 0,
      materialAmount(bag, 'food') < (DAILY_CONSUMPTION_PER_VILLAGER.food ?? 0),
      site ? Object.keys(constructionBagNeeds(site, bag, remaining)).sort() : null,
      site
        ? Object.keys(site.constructionMaterials?.cost ?? {})
            .filter(resource => (bag[resource as keyof typeof bag] ?? 0) > 0)
            .sort()
        : null,
    ]
  })
  return JSON.stringify([
    (owner.buildings ?? []).map(building => [
      building.label,
      building.type,
      building.isBuilt,
      building.buildingUpgrade?.targetLevel,
      building.isDead,
      building.isDestroyed,
      building.reservePolicy,
      building.constructionMaterials?.cost,
    ]),
    [...settlements.values()],
    units,
  ])
}

const settled = new WeakMap<PlayerLike, string>()
export function hasCollectiveVillageEvent(owner: PlayerLike): boolean {
  return settled.get(owner) !== collectiveVillageEventSnapshot(owner)
}
export function settleCollectiveVillageEvents(owner: PlayerLike): void {
  settled.set(owner, collectiveVillageEventSnapshot(owner))
}
