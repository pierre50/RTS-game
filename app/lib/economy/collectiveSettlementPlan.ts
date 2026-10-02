import type { ResourceAmount } from '../../types/common'
import type { CollectiveMember, CollectiveSite, Owner, Point } from './collectiveConstruction'
import { belongsToSettlement, collectivePosition } from './collectiveConstruction'
import { collectiveNeeds } from './collectiveNeeds'
import { settlementAvailableStock, settlementStockGoals } from './collectiveStock'
import { constructionAssignment } from './constructionAssignments'
import {
  advanceMaterialConstruction,
  constructionWorkPoints,
  hasConstructionWork,
  materialAmount,
  remainingConstructionMaterials,
} from './constructionMaterials'
import { pendingDepotPickup } from './depotPickup'

export type CarryRemaining = (unit: CollectiveMember) => number
export type ConstructionBoard = {
  site: CollectiveSite
  needed: ResourceAmount
  transport: ResourceAmount
  prepaid: boolean
}
export type SettlementPlan = {
  owner: Owner
  anchor: Point
  group: readonly CollectiveMember[]
  inhabitants: CollectiveMember[]
  sites: CollectiveSite[]
  boards: ConstructionBoard[]
  cargoSites: Map<CollectiveMember, CollectiveSite>
  missing: Record<string, number>
  reserved: Map<ResourceAmount, ResourceAmount>
  builders: Map<CollectiveSite, number>
  carryRemaining: CarryRemaining
}

export const carriesMaterial = (bag: ResourceAmount, key: string): boolean =>
  materialAmount(bag, key as keyof ResourceAmount) > 0

export function settlementVillagers(owner: Owner, anchor: Point, members: CollectiveMember[]): CollectiveMember[] {
  return members.filter(
    unit =>
      unit.type === 'Villager' &&
      !unit.isDead &&
      !unit.isDestroyed &&
      belongsToSettlement(owner, anchor, collectivePosition(unit))
  )
}

/** Stored materials already cover the next work point. */
export function canAdvanceConstruction(site: CollectiveSite): boolean {
  const preview = {
    ...site,
    constructionMaterials: site.constructionMaterials ? structuredClone(site.constructionMaterials) : undefined,
  }
  return advanceMaterialConstruction(preview, constructionWorkPoints(site) + 1, []) > constructionWorkPoints(site)
}

export function createSettlementPlan(
  owner: Owner,
  anchor: Point,
  group: readonly CollectiveMember[],
  members: CollectiveMember[],
  carryRemaining: CarryRemaining
): SettlementPlan {
  const inhabitants = settlementVillagers(owner, anchor, members)
  const sites = (owner.buildings ?? []).filter(
    site => hasConstructionWork(site) && !site.isDead && !site.isDestroyed && belongsToSettlement(owner, anchor, site)
  )
  const boards: ConstructionBoard[] = sites.map(site => ({
    site,
    needed: remainingConstructionMaterials(site),
    transport: {},
    prepaid: canAdvanceConstruction(site),
  }))
  const cargoSites = assignCargoSites(inhabitants, sites, boards)
  const stock = settlementAvailableStock(owner, anchor, inhabitants)
  const goals = constructionStockGoals(owner, anchor, sites)
  const missing = Object.fromEntries(
    collectiveNeeds(inhabitants.length, goals, stock).map(need => [need.resource, need.missing])
  )
  const plan: SettlementPlan = {
    owner,
    anchor,
    group,
    inhabitants,
    sites,
    boards,
    cargoSites,
    missing,
    reserved: new Map(),
    builders: new Map(),
    carryRemaining,
  }
  // Preserve ongoing useful jobs, and reserve work already undertaken outside this dispatch.
  for (const unit of inhabitants) {
    const job = unit.collectiveTask ?? unit.autonomousJob
    if (!group.includes(unit) && job && !unit.inactif && (missing[job] ?? 0) > 0) claimCollectiveJob(plan, unit, job)
  }
  for (const member of inhabitants.filter(member => !group.includes(member))) reserveMemberTransport(plan, member)
  return plan
}

export function claimCollectiveJob(plan: SettlementPlan, unit: CollectiveMember, job: string): void {
  plan.missing[job] = Math.max(0, (plan.missing[job] ?? 0) - Math.max(0, plan.carryRemaining(unit)))
}

function constructionStockGoals(owner: Owner, anchor: Point, sites: CollectiveSite[]): ResourceAmount {
  const goals = settlementStockGoals(owner, anchor, sites[0])
  for (const site of sites.slice(1))
    for (const [key, amount] of Object.entries(remainingConstructionMaterials(site)))
      goals[key as keyof ResourceAmount] = (goals[key as keyof ResourceAmount] ?? 0) + amount
  return goals
}

function cargoSite(
  member: CollectiveMember,
  sites: CollectiveSite[],
  boards: ConstructionBoard[],
  unreservedCargo: Map<CollectiveSite, ResourceAmount>
): CollectiveSite | undefined {
  const bag = member.inventory?.resources ?? {}
  const preferred = constructionAssignment(member)?.site
  const useful = (site: CollectiveSite) =>
    Object.entries(unreservedCargo.get(site) ?? {}).some(([key, amount]) => amount > 0 && carriesMaterial(bag, key))
  const hasCargo = boards.some(board => Object.keys(board.needed).some(key => carriesMaterial(bag, key)))
  return (
    (preferred && sites.includes(preferred) && useful(preferred) ? preferred : sites.find(useful)) ??
    (!hasCargo ? (sites.find(site => site === preferred) ?? sites[0]) : undefined)
  )
}

function assignCargoSites(
  inhabitants: CollectiveMember[],
  sites: CollectiveSite[],
  boards: ConstructionBoard[]
): Map<CollectiveMember, CollectiveSite> {
  const cargoSites = new Map<CollectiveMember, CollectiveSite>()
  const unreservedCargo = new Map(boards.map(board => [board.site, { ...board.needed }]))
  for (const member of inhabitants) {
    const site = cargoSite(member, sites, boards, unreservedCargo)
    if (!site) continue
    cargoSites.set(member, site)
    const bag = member.inventory?.resources ?? {}
    const remaining = unreservedCargo.get(site) ?? {}
    for (const key of Object.keys(remaining) as (keyof ResourceAmount)[])
      remaining[key] = Math.max(0, (remaining[key] ?? 0) - materialAmount(bag, key))
  }
  for (const board of boards)
    board.transport = unclaimedTransportNeeds(
      board.needed,
      inhabitants.filter(member => cargoSites.get(member) === board.site)
    )
  return cargoSites
}

function reserveMemberTransport(plan: SettlementPlan, member: CollectiveMember): void {
  const assignment = constructionAssignment(member)
  const board = plan.boards.find(board => board.site === plan.cargoSites.get(member))
  const key = member.collectiveTask as keyof ResourceAmount | undefined
  if (!board || !key || member.inactif || !board.transport[key]) return
  const quota =
    assignment?.target != null
      ? Math.max(0, assignment.target - materialAmount(member.inventory?.resources ?? {}, key))
      : Infinity
  board.transport[key] = Math.max(0, (board.transport[key] ?? 0) - Math.min(plan.carryRemaining(member), quota))
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
