import { notifyVillageStateChanged } from '../units/villageStateEvents'
import { DAILY_CONSUMPTION_PER_VILLAGER } from '../../constants'
import type { ResourceAmount } from '../../types/common'
import { hasIronMiningPickaxe } from '../resources/miningEquipment'
import { getStorageCapacity } from '../resources/storagePolicy'
import type { CollectiveMember, CollectiveSite, Owner, Point } from './collectiveConstruction'
import { belongsToSettlement, collectivePosition } from './collectiveConstruction'
import { COLLECTIVE_WORK_POLICY } from './collectiveNeeds'
import { materialAmount, remainingConstructionMaterials, takeMaterial } from './constructionMaterials'
import { constructionStores } from './constructionStores'
import {
  defaultDepotReservePolicy,
  normalizeDepotReservePolicy,
  reserveAmounts,
  type DepotReservePolicy,
} from './depotReserves'
import { personalFoodReserve } from './villagerProvisions'

export function settlementPopulation(
  owner: Owner & { units?: CollectiveMember[]; population?: number },
  anchor: Point
): number {
  const local = (owner.units ?? []).filter(
    unit =>
      !unit.isDead &&
      !unit.isDestroyed &&
      unit.type !== 'Hero' &&
      belongsToSettlement(owner, anchor, collectivePosition(unit))
  ).length
  return local || owner.population || 0
}

/** Carried provisions cover meals, but never masquerade as the depot's extra reserve. */
export function settlementAvailableStock(owner: Owner, anchor: Point, members: CollectiveMember[]): ResourceAmount {
  const stock: ResourceAmount = {}
  let food = 0
  for (const bag of constructionStores(owner, anchor)) {
    food += materialAmount(bag, 'food')
    for (const [key, amount] of Object.entries(bag))
      stock[key as keyof ResourceAmount] = (stock[key as keyof ResourceAmount] ?? 0) + amount
  }
  for (const member of members) {
    const bag = { ...member.inventory?.resources }
    food += materialAmount(bag, 'food')
    takeMaterial(bag, 'food', personalFoodReserve())
    for (const [key, amount] of Object.entries(bag))
      stock[key as keyof ResourceAmount] = (stock[key as keyof ResourceAmount] ?? 0) + amount
  }
  stock.food = food
  return stock
}

export function settlementDepotPolicy(owner: Owner, building: CollectiveSite): DepotReservePolicy {
  const peers = (owner.buildings ?? []).filter(
    other =>
      other.type === building.type && !other.isDead && !other.isDestroyed && belongsToSettlement(owner, building, other)
  )
  const configured = peers.find(other => other.reservePolicy)?.reservePolicy
  const policy = configured ?? defaultDepotReservePolicy(building.type)
  return normalizeDepotReservePolicy({ ...policy, target: getStorageCapacity(building.type) }, building.type)
}

export function setSettlementDepotPolicy(owner: Owner, building: CollectiveSite, policy: DepotReservePolicy): void {
  notifyVillageStateChanged(owner)
  for (const other of owner.buildings ?? []) {
    if (
      other.type === building.type &&
      !other.isDead &&
      !other.isDestroyed &&
      belongsToSettlement(owner, building, other)
    )
      other.reservePolicy = structuredClone(policy)
  }
}

/** Construction and meal needs remain active even with every comfort share disabled. */
export function settlementStockGoals(owner: Owner, anchor: Point, site?: CollectiveSite): ResourceAmount {
  const depots = (owner.buildings ?? []).filter(
    building =>
      building.isBuilt && !building.isDead && !building.isDestroyed && belongsToSettlement(owner, anchor, building)
  )
  const population = settlementPopulation(owner, anchor)
  const needs: ResourceAmount = site ? remainingConstructionMaterials(site) : {}
  if (!site) {
    for (const depot of depots.filter(building => ['StoragePit', 'Granary'].includes(building.type))) {
      for (const [key, amount] of Object.entries(reserveAmounts(settlementDepotPolicy(owner, depot), depot.type)))
        if (amount > 0) needs[key as keyof ResourceAmount] = (needs[key as keyof ResourceAmount] ?? 0) + amount
    }
  }
  if (
    !site &&
    needs.iron &&
    !hasIronMiningPickaxe({ owner }) &&
    !(owner.units ?? []).some(
      unit => belongsToSettlement(owner, anchor, collectivePosition(unit)) && hasIronMiningPickaxe({ ...unit, owner })
    )
  )
    needs.iron = 0
  needs.food = Math.max(
    needs.food ?? 0,
    population * (DAILY_CONSUMPTION_PER_VILLAGER.food ?? 0) * COLLECTIVE_WORK_POLICY.foodReserveDays
  )
  return needs
}
