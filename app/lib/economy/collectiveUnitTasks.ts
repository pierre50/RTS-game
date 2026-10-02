import { DAILY_CONSUMPTION_PER_VILLAGER } from '../../constants'
import type { ResourceAmount } from '../../types/common'
import { hasIronMiningPickaxe } from '../resources/miningEquipment'
import type { CollectiveMember, CollectiveSite } from './collectiveConstruction'
import { belongsToSettlement } from './collectiveConstruction'
import {
  canAdvanceConstruction,
  carriesMaterial,
  claimCollectiveJob,
  type ConstructionBoard,
  type SettlementPlan,
} from './collectiveSettlementPlan'
import { assignConstructionWork, constructionAssignment } from './constructionAssignments'
import { constructionBagNeeds, materialAmount, missingConstructionMaterialsForNextPoint } from './constructionMaterials'
import { planDepotPickup, type DepotPickup } from './depotPickup'
import { personalFoodReserve } from './villagerProvisions'

export type CollectiveTask = { job: string; site?: CollectiveSite; pickup?: DepotPickup }
type AcceptsJob<T> = (unit: T, job: string) => boolean
type UnitPlan<T extends CollectiveMember> = {
  plan: SettlementPlan
  unit: T
  acceptsJob: AcceptsJob<T>
  bag: ResourceAmount
  room: number
  site: CollectiveSite | undefined
  needed: ResourceAmount
  transport: ResourceAmount
}

const hasMissingTask = (plan: SettlementPlan, unit: CollectiveMember) =>
  Boolean(unit.collectiveTask && (plan.missing[unit.collectiveTask] ?? 0) > 0)

export function orderedSettlementWorkers<T extends CollectiveMember>(plan: SettlementPlan, group: T[]): T[] {
  return [...group].sort((a, b) => Number(hasMissingTask(plan, b)) - Number(hasMissingTask(plan, a)))
}

/** Finish an active collection batch before delivering: one useful item is not a full trip. */
export function planUnitTask<T extends CollectiveMember>(
  plan: SettlementPlan,
  unit: T,
  acceptsJob: AcceptsJob<T>
): CollectiveTask | undefined {
  const bag = unit.inventory?.resources ?? {}
  const room = plan.carryRemaining(unit)
  const board = unitBoard(plan, unit, bag, room, acceptsJob)
  const job: UnitPlan<T> = {
    plan,
    unit,
    acceptsJob,
    bag,
    room,
    site: board?.site,
    needed: board?.needed ?? {},
    transport: board?.transport ?? {},
  }
  const urgent = urgentFoodTask(job)
  if (urgent) return urgent
  const loadNeeds = boardLoadNeeds(job)
  return (
    deliveryTask(job, loadNeeds) ??
    pickupTask(job, loadNeeds) ??
    ingredientTask(job, loadNeeds) ??
    stockTask(job) ??
    builderTask(job)
  )
}

const ironReady = (plan: SettlementPlan, unit: CollectiveMember, key: string) =>
  key !== 'iron' || hasIronMiningPickaxe({ ...unit, owner: plan.owner })

function unitBoard<T extends CollectiveMember>(
  plan: SettlementPlan,
  unit: T,
  bag: ResourceAmount,
  room: number,
  acceptsJob: AcceptsJob<T>
): ConstructionBoard | undefined {
  const preferred = plan.cargoSites.get(unit)
  const candidates = [...plan.boards].sort((a, b) => Number(b.site === preferred) - Number(a.site === preferred))
  return candidates.find(
    board =>
      (board.prepaid && (plan.builders.get(board.site) ?? 0) < 2) ||
      (board.site === preferred && Object.keys(board.needed).some(key => carriesMaterial(bag, key))) ||
      (room > 0 &&
        Object.entries(board.transport).some(
          ([key, amount]) => amount > 0 && acceptsJob(unit, key) && ironReady(plan, unit, key)
        ))
  )
}

function urgentFoodTask<T extends CollectiveMember>(job: UnitPlan<T>): CollectiveTask | undefined {
  const { plan, unit } = job
  const food = materialAmount(job.bag, 'food')
  const urgentFood = DAILY_CONSUMPTION_PER_VILLAGER.food ?? 0
  if (!(job.acceptsJob(unit, 'food') && food < urgentFood && plan.carryRemaining(unit) > 0)) return undefined
  const pickup = planDepotPickup(
    plan.owner,
    unit,
    { food: (plan.sites.length ? urgentFood : personalFoodReserve()) - food },
    building => belongsToSettlement(plan.owner, plan.anchor, building),
    plan.reserved
  )
  claimCollectiveJob(plan, unit, 'food')
  return { job: 'food', ...(pickup ? { pickup } : {}) }
}

function boardLoadNeeds<T extends CollectiveMember>(job: UnitPlan<T>): ResourceAmount {
  if (!job.site) return {}
  const loadNeeds = constructionBagNeeds(job.site, job.bag, job.plan.carryRemaining(job.unit))
  for (const key of Object.keys(loadNeeds) as (keyof ResourceAmount)[]) {
    loadNeeds[key] = Math.min(loadNeeds[key] ?? 0, job.transport[key] ?? 0)
    if (!loadNeeds[key]) delete loadNeeds[key]
  }
  return loadNeeds
}

function batchReady<T extends CollectiveMember>(job: UnitPlan<T>, loadNeeds: ResourceAmount): boolean {
  const { unit } = job
  const assignment = constructionAssignment(unit)
  if (
    assignment?.resource &&
    assignment.target != null &&
    materialAmount(job.bag, assignment.resource) >= assignment.target
  )
    return true
  if (unit.autonomousJob !== 'construction' && unit.action === 'delivery') return true
  const task = unit.collectiveTask
  if (!task || task === 'construction' || unit.inactif) return true
  const key = task as keyof ResourceAmount
  return (job.transport[key] ?? 0) <= 0 || !loadNeeds[key] || job.plan.carryRemaining(unit) <= 0
}

function deliveryTask<T extends CollectiveMember>(
  job: UnitPlan<T>,
  loadNeeds: ResourceAmount
): CollectiveTask | undefined {
  const { site, bag } = job
  const bringing =
    site &&
    Object.entries(job.needed).some(([key, n]) => n > 0 && carriesMaterial(bag, key)) &&
    !Object.keys(missingConstructionMaterialsForNextPoint(site, bag)).length
  if (!site || !bringing || !batchReady(job, loadNeeds)) return undefined
  assignConstructionWork(job.unit, { site })
  return { job: 'construction', site }
}

function pickupTask<T extends CollectiveMember>(
  job: UnitPlan<T>,
  loadNeeds: ResourceAmount
): CollectiveTask | undefined {
  const { plan, site, transport } = job
  if (!site) return undefined
  const pickup = planDepotPickup(
    plan.owner,
    job.unit,
    loadNeeds,
    building => belongsToSettlement(plan.owner, plan.anchor, building),
    plan.reserved
  )
  if (!pickup) return undefined
  assignConstructionWork(job.unit, { site })
  for (const [key, count] of Object.entries(pickup.resources))
    transport[key as keyof ResourceAmount] = Math.max(0, (transport[key as keyof ResourceAmount] ?? 0) - count)
  return { job: 'construction', site, pickup }
}

function ingredientTask<T extends CollectiveMember>(
  job: UnitPlan<T>,
  loadNeeds: ResourceAmount
): CollectiveTask | undefined {
  const { plan, unit, site, transport } = job
  if (!site || !Object.keys(loadNeeds).length) return undefined
  const ingredient = Object.keys(loadNeeds).find(
    key => job.acceptsJob(unit, key) && (transport[key as keyof ResourceAmount] ?? 0) > 0 && ironReady(plan, unit, key)
  )
  if (!ingredient) return undefined
  const key = ingredient as keyof ResourceAmount
  const amount = Math.min(job.room, transport[key] ?? 0, loadNeeds[key] ?? 0)
  transport[key] = Math.max(0, (transport[key] ?? 0) - amount)
  assignConstructionWork(unit, { site, resource: key, target: materialAmount(job.bag, key) + amount })
  claimCollectiveJob(plan, unit, ingredient)
  return { job: ingredient, site }
}

function stockTask<T extends CollectiveMember>(job: UnitPlan<T>): CollectiveTask | undefined {
  const { plan, unit, site } = job
  const eligible = (key: string) =>
    job.acceptsJob(unit, key) &&
    (!plan.sites.length || key === 'food') &&
    (plan.missing[key] ?? 0) > 0 &&
    job.room > 0 &&
    ironReady(plan, unit, key)
  const resource = eligible('food')
    ? 'food'
    : unit.collectiveTask && eligible(unit.collectiveTask)
      ? unit.collectiveTask
      : Object.keys(plan.missing).find(eligible)
  if (!resource) return undefined
  claimCollectiveJob(plan, unit, resource)
  return { job: resource, ...(site ? { site } : {}) }
}

function builderTask<T extends CollectiveMember>(job: UnitPlan<T>): CollectiveTask | undefined {
  const { plan, site } = job
  if (!site || (plan.builders.get(site) ?? 0) >= 2 || !canAdvanceConstruction(site)) return undefined
  plan.builders.set(site, (plan.builders.get(site) ?? 0) + 1)
  assignConstructionWork(job.unit, { site })
  return { job: 'construction', site }
}
