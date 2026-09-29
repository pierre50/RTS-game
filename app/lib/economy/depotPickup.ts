import { communalStoreBuilding } from './constructionStores'
import { isDeliveryTargetRejected } from '../resources/resourceDeliveryRecovery'
import { materialAmount } from './constructionMaterials'
import { getUnitResourceCarryRemaining } from '../resources/resourceDelivery'
import type { ResourceAmount } from '../../types/common'
import type { UnitEntity } from '../../types/entities'
import type { CollectiveMember, CollectiveSite } from './collectiveTasks'

export type DepotPickup = { building: CollectiveSite; resources: ResourceAmount }

/** Plan a bounded load; only actual arrival at the chest transfers ownership. */
export function planDepotPickup(
  owner: { label?: string; buildings?: CollectiveSite[]; units?: CollectiveMember[] },
  unit: CollectiveMember,
  needs: ResourceAmount,
  accepts: (building: CollectiveSite) => boolean,
  reserved = new Map<ResourceAmount, ResourceAmount>()
): DepotPickup | undefined {
  const buildings = owner.buildings ?? []
  const stores = [
    ...new Set(
      buildings.flatMap(building => [
        building,
        ...((building as CollectiveSite & { interiorBuildings?: CollectiveSite[] }).interiorBuildings ?? []),
      ])
    ),
  ]
  const capacity = getUnitResourceCarryRemaining(unit as unknown as UnitEntity)
  if (capacity <= 0) return
  for (const store of stores.sort(
    (a, b) => Math.hypot(a.i - unit.i, a.j - unit.j) - Math.hypot(b.i - unit.i, b.j - unit.j)
  )) {
    const building = communalStoreBuilding(store, owner) as CollectiveSite | undefined
    if (
      !building ||
      isDeliveryTargetRejected(unit as UnitEntity, building) ||
      !['StoragePit', 'Granary'].includes(building.type) ||
      building.isBuilt === false ||
      building.isDead ||
      building.isDestroyed ||
      store.isDead ||
      store.isDestroyed ||
      !accepts(building)
    )
      continue
    const stock = store.inventory?.resources
    if (!stock) continue
    const resources: ResourceAmount = {}
    let room = capacity
    for (const [name, count] of Object.entries(needs)) {
      const key = name as keyof ResourceAmount
      if ((key === 'food') !== (building.type === 'Granary')) continue
      const enRoute = (owner.units ?? [])
        .filter(member => member !== unit)
        .reduce((total, member) => {
          const pending = pendingDepotPickup(member)
          return total + (pending && pending.label === building.label ? materialAmount(pending.resources, key) : 0)
        }, 0)
      const available = Math.max(
        0,
        materialAmount(stock, key) - materialAmount(reserved.get(stock) ?? {}, key) - enRoute
      )
      const take = Math.min(room, count, available)
      if (take <= 0) continue
      resources[key] = take
      room -= take
    }
    if (room === capacity) continue
    const claim = reserved.get(stock) ?? {}
    for (const [key, value] of Object.entries(resources))
      claim[key as keyof ResourceAmount] = (claim[key as keyof ResourceAmount] ?? 0) + value
    reserved.set(stock, claim)
    return { building, resources }
  }
}

/** Preserve concrete food types and never exceed either stock or bag capacity. */
export function withdrawDepotResources(unit: CollectiveMember, stock: ResourceAmount, request: ResourceAmount): number {
  unit.inventory ??= {}
  const bag = (unit.inventory.resources ??= {})
  let room = getUnitResourceCarryRemaining(unit as unknown as UnitEntity)
  let moved = 0
  for (const [name, amount] of Object.entries(request)) {
    let remaining = Math.max(0, amount)
    const keys = name === 'food' ? ['food', 'wheat', 'berry', 'meat'] : [name]
    for (const name of keys) {
      const key = name as keyof ResourceAmount
      const taken = Math.min(room, remaining, Math.max(0, stock[key] ?? 0))
      if (taken <= 0) continue
      stock[key] = (stock[key] ?? 0) - taken
      bag[key] = (bag[key] ?? 0) + taken
      room -= taken
      remaining -= taken
      moved += taken
    }
  }
  return moved
}

export function pendingDepotPickup(unit: CollectiveMember): { label?: string; resources: ResourceAmount } | undefined {
  const member = unit as CollectiveMember & {
    resourceDeliveryState?: { building?: { label?: string } | null; pickup?: ResourceAmount } | null
    resourceDelivery?: { building?: string | [number, number, string?] | null; pickup?: ResourceAmount }
  }
  if (member.resourceDeliveryState?.pickup)
    return { label: member.resourceDeliveryState.building?.label, resources: member.resourceDeliveryState.pickup }
  const saved = member.resourceDelivery
  if (saved?.pickup)
    return { label: typeof saved.building === 'string' ? saved.building : saved.building?.[2], resources: saved.pickup }
}
