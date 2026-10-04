import type { ResourceAmount } from '../../types/common'

export type ConstructionMaterials = {
  cost: ResourceAmount
  delivered: ResourceAmount
  consumed: ResourceAmount
}
export type BuildingUpgrade = {
  targetLevel: number
  /** Legacy saves only. */
  hitPoints?: number
  constructionProgress?: number
  /** Legacy renovation saves only. */
  totalHitPoints?: number
  constructionTime: number
}
export type MaterialSite = {
  constructionTime?: number
  constructionWorkRequired?: number
  /** Completed construction work, from 0 to 1, independent of health. */
  constructionProgress?: number
  buildingUpgrade?: BuildingUpgrade
  isDead?: boolean
  isDestroyed?: boolean
  constructionMaterials?: ConstructionMaterials
  hitPoints?: number
  totalHitPoints?: number
  isBuilt?: boolean
}
/** Read legacy saves without treating the initial health point as completed work. */
export function constructionProgress(site: MaterialSite): number {
  const work = site.buildingUpgrade ?? site
  if (!site.buildingUpgrade && site.isBuilt) return 1
  if (work.constructionProgress != null) return Math.max(0, Math.min(1, work.constructionProgress))
  const total = work.totalHitPoints ?? 0
  if (total <= 1) return 0
  return Math.max(0, Math.min(1, ((work.hitPoints ?? 1) - 1) / (total - 1)))
}

/** Convert legacy structural health once, preserving damage and completed work. */
export function initializeConstructionProgress(site: MaterialSite): void {
  if (site.constructionProgress == null && (site.isBuilt || site.totalHitPoints != null)) {
    site.constructionProgress = constructionProgress({ ...site, buildingUpgrade: undefined })
  }
  if (site.constructionWorkRequired == null && site.constructionTime != null && site.totalHitPoints != null) {
    if (
      !site.isBuilt &&
      !site.isDead &&
      !site.isDestroyed &&
      (site.hitPoints ?? 0) > 0 &&
      site.totalHitPoints != null
    ) {
      const progress = site.constructionProgress ?? 0
      site.hitPoints = Math.min(
        site.totalHitPoints,
        (site.hitPoints ?? 0) + (1 - progress) * Math.max(0, site.totalHitPoints - 1)
      )
    }
    site.constructionWorkRequired = Math.max(1, site.constructionTime)
  }
  if (site.buildingUpgrade) {
    site.buildingUpgrade.constructionProgress = constructionProgress(site)
    delete site.buildingUpgrade.hitPoints
    delete site.buildingUpgrade.totalHitPoints
  }
}

/** Work units are independent of health; one unmodified work impact supplies one unit. */
export function constructionWorkTotal(site: MaterialSite): number {
  return Math.max(
    1,
    site.buildingUpgrade?.constructionTime ?? site.constructionWorkRequired ?? site.constructionTime ?? 1
  )
}

/** Renovation work is independent of the health and availability of the building. */
function constructionWorkSite(site: MaterialSite): MaterialSite {
  return site.buildingUpgrade
    ? {
        ...site,
        ...site.buildingUpgrade,
        constructionProgress: constructionProgress(site),
        constructionWorkRequired: constructionWorkTotal(site),
        isBuilt: false,
        buildingUpgrade: undefined,
      }
    : site
}
export function hasConstructionWork(site: MaterialSite): boolean {
  return (!site.isBuilt || Boolean(site.buildingUpgrade)) && !site.isDead && !site.isDestroyed
}
export function constructionWorkPoints(site: MaterialSite): number {
  return constructionProgress(site) * constructionWorkTotal(site)
}
export function constructionProgressPercentage(site: MaterialSite): number {
  return 100 * constructionProgress(site)
}

/** Construction never heals damage. Completed buildings are repaired separately. */
export function applyConstructionWork(site: MaterialSite, points: number): void {
  if (site.isDead || site.isDestroyed || (site.hitPoints ?? 1) <= 0 || (site.isBuilt && !site.buildingUpgrade)) return
  initializeConstructionProgress(site)
  const work = site.buildingUpgrade ?? site
  work.constructionProgress = Math.max(constructionProgress(site), Math.min(1, points / constructionWorkTotal(site)))
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
  site = constructionWorkSite(site)
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
  requestedWork: number,
  stores: ResourceAmount[] = []
): number {
  site = constructionWorkSite(site)
  stores = [...new Set(stores)]
  const before = constructionWorkPoints(site)
  const total = constructionWorkTotal(site)
  const state = site.constructionMaterials
  if (!state || site.isBuilt) return Math.min(total, requestedWork)
  if (!(total > 0)) return before
  const entries = Object.entries(state.cost) as [keyof ResourceAmount, number][]
  const cost = entries.reduce((sum, [, n]) => sum + Math.max(0, n), 0)
  if (!cost) return Math.min(total, requestedWork)
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
  const next = Math.max(before, Math.min(total, requestedWork, ((used + available) / cost) * total))
  if (next - before <= 1e-9) return before
  let due = Math.max(0, Math.ceil(cost * (next / total) - 1e-9) - used)
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
  site = constructionWorkSite(site)
  if (!site.constructionMaterials || site.isBuilt) return {}
  const preview = { ...site, constructionMaterials: structuredClone(site.constructionMaterials) }
  if (
    advanceMaterialConstruction(preview, constructionWorkPoints(site) + 1, [{ ...bag }]) > constructionWorkPoints(site)
  )
    return {}
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
