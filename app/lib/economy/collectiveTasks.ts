import { assignConstructionWork, constructionAssignment } from './constructionAssignments'
import { DAILY_CONSUMPTION_PER_VILLAGER } from '../../constants'
import type { ResourceAmount } from '../../types/common'
import type { UnitEntity } from '../../types/entities'
import { hasIronMiningPickaxe } from '../resources/miningEquipment'
import { getUnitResourceCarryRemaining } from '../resources/resourceDelivery'
import type { CollectiveMember, CollectiveSite, Owner } from './collectiveConstruction'
import {
  activeConstructionSite,
  belongsToSettlement,
  collectiveAnchor,
  collectivePosition,
} from './collectiveConstruction'
import { collectiveNeeds } from './collectiveNeeds'
import { settlementAvailableStock, settlementStockGoals } from './collectiveStock'
import {
  advanceMaterialConstruction,
  constructionBagNeeds,
  materialAmount,
  missingConstructionMaterialsForNextPoint,
  remainingConstructionMaterials,
} from './constructionMaterials'
import { pendingDepotPickup, planDepotPickup, type DepotPickup } from './depotPickup'
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
export {
  setSettlementDepotPolicy,
  settlementDepotPolicy,
  settlementPopulation,
  settlementStockGoals,
} from './collectiveStock'
export type CollectiveTask = { job: string; site?: CollectiveSite; pickup?: DepotPickup }

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
    const inhabitants = members.filter(
      unit =>
        unit.type === 'Villager' &&
        !unit.isDead &&
        !unit.isDestroyed &&
        belongsToSettlement(owner, anchor, collectivePosition(unit))
    )
    const sites = (owner.buildings ?? []).filter(
      site => !site.isBuilt && !site.isDead && !site.isDestroyed && belongsToSettlement(owner, anchor, site)
    )
    const boards = sites.map(site => ({
      site,
      needed: remainingConstructionMaterials(site),
      transport: {} as ResourceAmount,
      prepaid:
        advanceMaterialConstruction(
          {
            ...site,
            constructionMaterials: site.constructionMaterials ? structuredClone(site.constructionMaterials) : undefined,
          },
          (site.hitPoints ?? 1) + 1,
          []
        ) > (site.hitPoints ?? 1),
    }))
    const cargoSites = new Map<CollectiveMember, CollectiveSite>()
    const unreservedCargo = new Map(boards.map(board => [board.site, { ...board.needed }]))
    for (const member of inhabitants) {
      const bag = member.inventory?.resources ?? {}
      const preferred = constructionAssignment(member)?.site
      const useful = (site: CollectiveSite) =>
        Object.entries(unreservedCargo.get(site) ?? {}).some(
          ([key, amount]) => amount > 0 && materialAmount(bag, key as keyof ResourceAmount) > 0
        )
      const hasCargo = boards.some(board =>
        Object.keys(board.needed).some(key => materialAmount(bag, key as keyof ResourceAmount) > 0)
      )
      const site =
        (preferred && sites.includes(preferred) && useful(preferred) ? preferred : sites.find(useful)) ??
        (!hasCargo ? (sites.find(site => site === preferred) ?? sites[0]) : undefined)
      if (!site) continue
      cargoSites.set(member, site)
      const remaining = unreservedCargo.get(site)!
      for (const key of Object.keys(remaining) as (keyof ResourceAmount)[])
        remaining[key] = Math.max(0, (remaining[key] ?? 0) - materialAmount(bag, key))
    }
    for (const board of boards)
      board.transport = unclaimedTransportNeeds(
        board.needed,
        inhabitants.filter(member => cargoSites.get(member) === board.site)
      )
    const stock = settlementAvailableStock(owner, anchor, inhabitants)
    const goals = settlementStockGoals(owner, anchor, sites[0])
    for (const site of sites.slice(1))
      for (const [key, amount] of Object.entries(remainingConstructionMaterials(site)))
        goals[key as keyof ResourceAmount] = (goals[key as keyof ResourceAmount] ?? 0) + amount
    const missing = Object.fromEntries(
      collectiveNeeds(inhabitants.length, goals, stock).map(need => [need.resource, need.missing])
    )
    // Preserve ongoing useful jobs, and reserve work already undertaken outside this dispatch.
    const claim = (unit: CollectiveMember, job: string) => {
      missing[job] = Math.max(
        0,
        (missing[job] ?? 0) - Math.max(0, getUnitResourceCarryRemaining(unit as unknown as UnitEntity))
      )
    }
    for (const unit of inhabitants) {
      const job = unit.collectiveTask ?? unit.autonomousJob
      if (!group.includes(unit as T) && job && !unit.inactif && missing[job] > 0) claim(unit, job)
    }
    const reserved = new Map<ResourceAmount, ResourceAmount>()
    for (const member of inhabitants.filter(member => !group.includes(member as T))) {
      const assignment = constructionAssignment(member)
      const board = boards.find(board => board.site === cargoSites.get(member))
      const key = member.collectiveTask as keyof ResourceAmount | undefined
      if (board && key && !member.inactif && board.transport[key])
        board.transport[key] = Math.max(
          0,
          (board.transport[key] ?? 0) -
            Math.min(
              getUnitResourceCarryRemaining(member as unknown as UnitEntity),
              assignment?.target != null
                ? Math.max(0, assignment.target - materialAmount(member.inventory?.resources ?? {}, key))
                : Infinity
            )
        )
    }
    const builders = new Map<CollectiveSite, number>()
    const ordered = [...group].sort(
      (a, b) =>
        Number(Boolean(b.collectiveTask && missing[b.collectiveTask] > 0)) -
        Number(Boolean(a.collectiveTask && missing[a.collectiveTask] > 0))
    )
    for (const unit of ordered) {
      // Finish an active collection batch before delivering: one useful item is not a full trip.
      const bag = unit.inventory?.resources ?? {}
      const room = getUnitResourceCarryRemaining(unit as unknown as UnitEntity)
      const preferred = cargoSites.get(unit)
      const candidates = [...boards].sort((a, b) => Number(b.site === preferred) - Number(a.site === preferred))
      const board = candidates.find(
        board =>
          (board.prepaid && (builders.get(board.site) ?? 0) < 2) ||
          (board.site === preferred &&
            Object.keys(board.needed).some(key => materialAmount(bag, key as keyof ResourceAmount) > 0)) ||
          (room > 0 &&
            Object.entries(board.transport).some(
              ([key, amount]) =>
                amount > 0 && acceptsJob(unit, key) && (key !== 'iron' || hasIronMiningPickaxe({ ...unit, owner }))
            ))
      )
      const site = board?.site
      const needed = board?.needed ?? {}
      const transportNeeds = board?.transport ?? {}
      const acceptsDepot = (building: CollectiveSite) => belongsToSettlement(owner, anchor, building)
      const food = materialAmount(bag, 'food')
      const urgentFood = DAILY_CONSUMPTION_PER_VILLAGER.food ?? 0
      if (
        acceptsJob(unit, 'food') &&
        food < urgentFood &&
        getUnitResourceCarryRemaining(unit as unknown as UnitEntity) > 0
      ) {
        const pickup = planDepotPickup(
          owner,
          unit,
          { food: (sites.length ? urgentFood : personalFoodReserve()) - food },
          acceptsDepot,
          reserved
        )
        result.set(unit, { job: 'food', ...(pickup ? { pickup } : {}) })
        claim(unit, 'food')
        continue
      }
      const loadNeeds = site
        ? constructionBagNeeds(site, bag, getUnitResourceCarryRemaining(unit as unknown as UnitEntity))
        : {}
      for (const key of Object.keys(loadNeeds) as (keyof ResourceAmount)[]) {
        loadNeeds[key] = Math.min(loadNeeds[key] ?? 0, transportNeeds[key] ?? 0)
        if (!loadNeeds[key]) delete loadNeeds[key]
      }
      const bringing =
        site &&
        Object.entries(needed).some(([key, n]) => n > 0 && materialAmount(bag, key as keyof ResourceAmount) > 0) &&
        !Object.keys(missingConstructionMaterialsForNextPoint(site, bag)).length
      const gathering = unit.collectiveTask && unit.collectiveTask !== 'construction' && !unit.inactif
      const gatheringKey = unit.collectiveTask as keyof ResourceAmount | undefined
      const stillNeeded = gatheringKey
        ? site
          ? (transportNeeds[gatheringKey] ?? 0)
          : Math.max(0, (goals[gatheringKey] ?? 0) - materialAmount(stock, gatheringKey))
        : 0
      const assignment = constructionAssignment(unit)
      const quotaReady =
        assignment?.resource &&
        assignment.target != null &&
        materialAmount(bag, assignment.resource) >= assignment.target
      const batchReady =
        quotaReady ||
        (site && unit.autonomousJob !== 'construction' && unit.action === 'delivery') ||
        !gathering ||
        stillNeeded <= 0 ||
        (site && !loadNeeds[gatheringKey!]) ||
        getUnitResourceCarryRemaining(unit as unknown as UnitEntity) <= 0
      if (bringing && batchReady) {
        result.set(unit, { job: 'construction', site })
        assignConstructionWork(unit, { site })
        continue
      }
      const pickup = site ? planDepotPickup(owner, unit, loadNeeds, acceptsDepot, reserved) : undefined
      if (pickup && site) {
        result.set(unit, { job: 'construction', site, pickup })
        assignConstructionWork(unit, { site })
        for (const [key, count] of Object.entries(pickup.resources))
          transportNeeds[key as keyof ResourceAmount] = Math.max(
            0,
            (transportNeeds[key as keyof ResourceAmount] ?? 0) - count
          )
        continue
      }
      if (site && Object.keys(loadNeeds).length) {
        const ingredient = Object.keys(loadNeeds).find(
          key =>
            acceptsJob(unit, key) &&
            (transportNeeds[key as keyof ResourceAmount] ?? 0) > 0 &&
            (key !== 'iron' || hasIronMiningPickaxe({ ...unit, owner }))
        )
        if (ingredient) {
          const key = ingredient as keyof ResourceAmount
          const amount = Math.min(room, transportNeeds[key] ?? 0, loadNeeds[key] ?? 0)
          transportNeeds[key] = Math.max(0, (transportNeeds[key] ?? 0) - amount)
          assignConstructionWork(unit, { site, resource: key, target: materialAmount(bag, key) + amount })
          result.set(unit, { job: ingredient, site })
          claim(unit, ingredient)
          continue
        }
      }
      const eligible = (key: string) =>
        acceptsJob(unit, key) &&
        (!sites.length || key === 'food') &&
        missing[key] > 0 &&
        room > 0 &&
        (key !== 'iron' || hasIronMiningPickaxe({ ...unit, owner }))
      const resource = eligible('food')
        ? 'food'
        : unit.collectiveTask && eligible(unit.collectiveTask)
          ? unit.collectiveTask
          : Object.keys(missing).find(eligible)
      if (resource) {
        result.set(unit, { job: resource, ...(site ? { site } : {}) })
        claim(unit, resource)
        continue
      }
      if (site && (builders.get(site) ?? 0) < 2) {
        const preview = {
          ...site,
          constructionMaterials: site.constructionMaterials ? structuredClone(site.constructionMaterials) : undefined,
        }
        if (advanceMaterialConstruction(preview, (site.hitPoints ?? 1) + 1, []) > (site.hitPoints ?? 1)) {
          result.set(unit, { job: 'construction', site })
          builders.set(site, (builders.get(site) ?? 0) + 1)
          assignConstructionWork(unit, { site })
        }
      }
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
  const members = (owner.units ?? []).filter(
    member =>
      !member.isDead &&
      !member.isDestroyed &&
      member.type === 'Villager' &&
      belongsToSettlement(owner, anchor, collectivePosition(member))
  )
  const site = activeConstructionSite(owner, unit)
  if (limitToBag && site && resource !== 'food' && !isFoodReserveResource(resource)) {
    const assignment = constructionAssignment(unit)
    const quota =
      assignment?.resource === resource && assignment.target != null
        ? Math.max(0, assignment.target - materialAmount(unit.inventory?.resources ?? {}, resource))
        : Infinity
    return Math.min(
      quota,
      constructionBagNeeds(
        site,
        unit.inventory?.resources ?? {},
        getUnitResourceCarryRemaining(unit as unknown as UnitEntity)
      )[resource] ?? 0
    )
  }
  const foodResource = isFoodReserveResource(resource)
  const goals = settlementStockGoals(owner, anchor, site)
  const stock = settlementAvailableStock(owner, anchor, members)
  const comfort = Math.max(0, (goals[resource] ?? 0) - (stock[resource] ?? 0))
  const essential = foodResource ? Math.max(0, (goals.food ?? 0) - (stock.food ?? 0)) : 0
  const personal =
    (resource === 'food' || foodResource) &&
    materialAmount(unit.inventory?.resources ?? {}, 'food') < (DAILY_CONSUMPTION_PER_VILLAGER.food ?? 0)
      ? (site ? (DAILY_CONSUMPTION_PER_VILLAGER.food ?? 0) : personalFoodReserve()) -
        materialAmount(unit.inventory?.resources ?? {}, 'food')
      : 0
  if (site && (resource === 'food' || foodResource))
    return Math.max(personal, goals[resource] && resource !== 'food' ? comfort : 0)
  return Math.max(comfort, essential, personal)
}

function unclaimedTransportNeeds(needed: ResourceAmount, inhabitants: CollectiveMember[]): ResourceAmount {
  const transportNeeds = { ...needed }
  for (const member of inhabitants)
    for (const key of Object.keys(transportNeeds) as (keyof ResourceAmount)[])
      transportNeeds[key] = Math.max(
        0,
        (transportNeeds[key] ?? 0) -
          materialAmount(member.inventory?.resources ?? {}, key) -
          materialAmount(pendingDepotPickup(member)?.resources ?? {}, key)
      )

  return transportNeeds
}
