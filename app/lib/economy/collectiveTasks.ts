import { DAILY_CONSUMPTION_PER_VILLAGER } from '../../constants'
import type { ResourceAmount } from '../../types/common'
import type { UnitEntity } from '../../types/entities'
import { getUnitResourceCarryRemaining } from '../resources/resourceDelivery'
import type { CollectiveMember, CollectiveSite, Owner, Point } from './collectiveConstruction'
import {
  activeConstructionSite,
  belongsToSettlement,
  collectiveAnchor,
  collectivePosition,
} from './collectiveConstruction'
import { createSettlementPlan, settlementVillagers } from './collectiveSettlementPlan'
import { settlementAvailableStock, settlementStockGoals } from './collectiveStock'
import { orderedSettlementWorkers, planUnitTask, type CollectiveTask } from './collectiveUnitTasks'
import { constructionAssignment } from './constructionAssignments'
import { constructionBagNeeds, materialAmount } from './constructionMaterials'
import { isFoodReserveResource } from './depotReserves'
import { personalFoodReserve } from './villagerProvisions'
export {
  type CollectiveMember,
  type CollectiveSite,
  activeConstructionSite,
  belongsToSettlement,
  collectiveAnchor,
  readyConstructionSite,
} from './collectiveConstruction'
export { setSettlementDepotPolicy, settlementDepotPolicy } from './collectiveStock'
export type { CollectiveTask } from './collectiveUnitTasks'

const carryRemaining = (unit: CollectiveMember) => getUnitResourceCarryRemaining(unit as unknown as UnitEntity)

/** One ordered board per settlement. Cargo and claims are counted once, before dispatch. */
export function planCollectiveTasks<T extends CollectiveMember>(
  owner: Owner,
  workers: T[],
  members: CollectiveMember[] = workers,
  acceptsJob: (unit: T, job: string) => boolean = () => true
): Map<T, CollectiveTask> {
  const result = new Map<T, CollectiveTask>()
  const pending = new Set(workers)
  for (const first of workers) {
    if (!pending.has(first)) continue
    const anchor = collectiveAnchor(owner, first)
    const group = workers.filter(
      unit => pending.has(unit) && belongsToSettlement(owner, anchor, collectivePosition(unit))
    )
    group.forEach(unit => pending.delete(unit))
    const plan = createSettlementPlan(owner, anchor, group, members, carryRemaining)
    for (const unit of orderedSettlementWorkers(plan, group)) {
      const task = planUnitTask(plan, unit, acceptsJob)
      if (task) result.set(unit, task)
    }
  }
  for (const unit of result.keys()) {
    if (unit.collectiveTask && unit.collectiveHome) continue
    const home = collectiveAnchor(owner, unit)
    unit.collectiveHome = { i: home.i, j: home.j, spaceId: home.spaceId ?? 'outside' }
  }
  return result
}

/** Cap a harvest at the remaining local need, including cargo already gathered. */
export function collectiveHarvestBudget(
  owner: Owner & { units?: CollectiveMember[] },
  unit: CollectiveMember,
  resource: keyof ResourceAmount,
  limitToBag = true
): number {
  if (!unit.collectiveTask) return Infinity
  const anchor = collectiveAnchor(owner, unit)
  const members = settlementVillagers(owner, anchor, owner.units ?? [])
  const site = activeConstructionSite(owner, unit)
  if (limitToBag && site && resource !== 'food' && !isFoodReserveResource(resource))
    return constructionHarvestBudget(unit, site, resource)
  return stockHarvestBudget(owner, anchor, members, unit, resource, site)
}

function constructionHarvestBudget(
  unit: CollectiveMember,
  site: CollectiveSite,
  resource: keyof ResourceAmount
): number {
  const assignment = constructionAssignment(unit)
  const quota =
    assignment?.resource === resource && assignment.target != null
      ? Math.max(0, assignment.target - materialAmount(unit.inventory?.resources ?? {}, resource))
      : Infinity
  return Math.min(
    quota,
    constructionBagNeeds(site, unit.inventory?.resources ?? {}, carryRemaining(unit))[resource] ?? 0
  )
}

function stockHarvestBudget(
  owner: Owner,
  anchor: Point,
  members: CollectiveMember[],
  unit: CollectiveMember,
  resource: keyof ResourceAmount,
  site: CollectiveSite | undefined
): number {
  const foodResource = isFoodReserveResource(resource)
  const goals = settlementStockGoals(owner, anchor, site)
  const stock = settlementAvailableStock(owner, anchor, members)
  const comfort = Math.max(0, (goals[resource] ?? 0) - (stock[resource] ?? 0))
  const essential = foodResource ? Math.max(0, (goals.food ?? 0) - (stock.food ?? 0)) : 0
  const personal = resource === 'food' || foodResource ? personalFoodBudget(unit, site) : 0
  if (site && (resource === 'food' || foodResource))
    return Math.max(personal, goals[resource] && resource !== 'food' ? comfort : 0)
  return Math.max(comfort, essential, personal)
}

function personalFoodBudget(unit: CollectiveMember, site: CollectiveSite | undefined): number {
  const daily = DAILY_CONSUMPTION_PER_VILLAGER.food ?? 0
  const carried = materialAmount(unit.inventory?.resources ?? {}, 'food')
  return carried < daily ? (site ? daily : personalFoodReserve()) - carried : 0
}
