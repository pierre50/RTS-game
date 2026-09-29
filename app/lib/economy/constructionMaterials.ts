import type { ResourceAmount } from '../../types/common'

export type ConstructionMaterials = {
  cost: ResourceAmount
  delivered: ResourceAmount
  consumed: ResourceAmount
}
export type MaterialSite = {
  constructionMaterials?: ConstructionMaterials
  hitPoints?: number
  totalHitPoints?: number
  isBuilt?: boolean
}
const FOOD = ['food', 'berry', 'wheat', 'meat'] as const

export function materialAmount(resources: ResourceAmount, key: keyof ResourceAmount): number {
  return key === 'food' ? FOOD.reduce((n, food) => n + (resources[food] ?? 0), 0) : (resources[key] ?? 0)
}

export function takeMaterial(resources: ResourceAmount, key: keyof ResourceAmount, amount: number): number {
  let remaining = Math.max(0, amount)
  for (const name of key === 'food' ? FOOD : [key]) {
    const taken = Math.min(resources[name] ?? 0, remaining)
    if (taken > 0) resources[name] = (resources[name] ?? 0) - taken
    remaining -= taken
  }
  return amount - remaining
}

export function createConstructionMaterials(cost: ResourceAmount = {}): ConstructionMaterials {
  return { cost: { ...cost }, delivered: {}, consumed: {} }
}

export function remainingConstructionMaterials(site: MaterialSite): ResourceAmount {
  const result: ResourceAmount = {}
  const state = site.constructionMaterials
  if (!state || site.isBuilt) return result // Legacy sites were paid for when placed.
  for (const [key, cost] of Object.entries(state.cost)) {
    const resource = key as keyof ResourceAmount
    const missing = Math.max(0, cost - (state.consumed[resource] ?? 0) - (state.delivered[resource] ?? 0))
    if (missing) result[resource] = missing
  }
  return result
}

/** Every recipe item contributes the same share of construction; ingredients can be used separately. */
export function advanceMaterialConstruction(
  site: MaterialSite,
  requestedHP: number,
  stores: ResourceAmount[] = []
): number {
  stores = [...new Set(stores)]
  const before = site.hitPoints ?? 1
  const total = site.totalHitPoints ?? 0
  const state = site.constructionMaterials
  if (!state || site.isBuilt) return Math.min(total, requestedHP)
  if (!(total > 1)) return before
  const entries = Object.entries(state.cost) as [keyof ResourceAmount, number][]
  const cost = entries.reduce((sum, [, n]) => sum + Math.max(0, n), 0)
  if (!cost) return Math.min(total, requestedHP)
  const used = entries.reduce((sum, [key, n]) => sum + Math.min(n, state.consumed[key] ?? 0), 0)
  const available = entries.reduce(
    (sum, [key, n]) =>
      sum +
      Math.min(
        Math.max(0, n - (state.consumed[key] ?? 0)),
        (state.delivered[key] ?? 0) + stores.reduce((n, bag) => n + materialAmount(bag, key), 0)
      ),
    0
  )
  const next = Math.max(before, Math.min(total, requestedHP, 1 + ((used + available) / cost) * (total - 1)))
  if (next <= before) return before
  let due = Math.max(0, Math.ceil(cost * ((next - 1) / (total - 1)) - 1e-9) - used)
  for (const [key, n] of entries) {
    let remaining = Math.min(due, Math.max(0, n - (state.consumed[key] ?? 0)))
    const delivered = Math.min(state.delivered[key] ?? 0, remaining)
    if (delivered) state.delivered[key] = (state.delivered[key] ?? 0) - delivered
    remaining -= delivered
    let taken = delivered
    for (const bag of stores) {
      const amount = takeMaterial(bag, key, Math.min(remaining, materialAmount(bag, key)))
      taken += amount
      remaining -= amount
    }
    if (taken) state.consumed[key] = (state.consumed[key] ?? 0) + taken
    due -= taken
  }
  return next
}

/** Report missing alternatives only when none of the carried ingredients can advance the site. */
export function missingConstructionMaterialsForNextPoint(site: MaterialSite, bag: ResourceAmount = {}): ResourceAmount {
  if (!site.constructionMaterials || site.isBuilt) return {}
  const preview = { ...site, constructionMaterials: structuredClone(site.constructionMaterials) }
  if (advanceMaterialConstruction(preview, (site.hitPoints ?? 1) + 1, [{ ...bag }]) > (site.hitPoints ?? 1)) return {}
  const missing: ResourceAmount = {}
  for (const [name, count] of Object.entries(remainingConstructionMaterials(site)))
    if (count > 0) missing[name as keyof ResourceAmount] = count
  return missing
}

/** Each ingredient is an alternative useful load; the pickup/gather action enforces total bag capacity. */
export function constructionBagNeeds(site: MaterialSite, bag: ResourceAmount, room: number): ResourceAmount {
  const result: ResourceAmount = {}
  for (const [name, count] of Object.entries(remainingConstructionMaterials(site))) {
    const key = name as keyof ResourceAmount
    const missing = Math.min(Math.max(0, room), Math.max(0, count - materialAmount(bag, key)))
    if (missing) result[key] = missing
  }
  return result
}
