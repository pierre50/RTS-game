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
  constructionPaused?: boolean
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
  return (
    (!site.isBuilt || Boolean(site.buildingUpgrade)) && !site.constructionPaused && !site.isDead && !site.isDestroyed
  )
}
export function constructionWorkPoints(site: MaterialSite): number {
  return constructionProgress(site) * constructionWorkTotal(site)
}
export function constructionProgressPercentage(site: MaterialSite): number {
  return 100 * constructionProgress(site)
}

/** Construction never heals damage. Completed buildings are repaired separately. */
export function applyConstructionWork(site: MaterialSite, points: number): void {
  if (
    site.constructionPaused ||
    site.isDead ||
    site.isDestroyed ||
    (site.hitPoints ?? 1) <= 0 ||
    (site.isBuilt && !site.buildingUpgrade)
  )
    return
  if (!constructionMaterialsReady(site)) return
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

/** Materials are reserved at the site without completing any construction work. */
export function deliverConstructionMaterials(site: MaterialSite, stores: ResourceAmount[]): ResourceAmount {
  const delivered: ResourceAmount = {}
  if (!hasConstructionWork(site) || (site.hitPoints ?? 1) <= 0 || !site.constructionMaterials) return delivered
  const state = site.constructionMaterials
  for (const [name, missing] of Object.entries(remainingConstructionMaterials(site))) {
    const key = name as keyof ResourceAmount
    let remaining = missing
    for (const bag of new Set(stores)) {
      const amount = takeMaterial(bag, key, remaining)
      if (amount > 0) {
        state.delivered[key] = (state.delivered[key] ?? 0) + amount
        delivered[key] = (delivered[key] ?? 0) + amount
        remaining -= amount
      }
      if (remaining <= 0) break
    }
  }
  return delivered
}

/** Legacy prepaid sites and zero-cost projects can start immediately. */
export function constructionMaterialsReady(site: MaterialSite): boolean {
  return Object.keys(remainingConstructionMaterials(site)).length === 0
}

/** Work starts only after the entire recipe is on site; no personal or depot stock is withdrawn here. */
export function advanceMaterialConstruction(site: MaterialSite, requestedWork: number): number {
  const before = constructionWorkPoints(site)
  if (!hasConstructionWork(site) || (site.hitPoints ?? 1) <= 0 || !constructionMaterialsReady(site)) return before
  const next = Math.max(before, Math.min(constructionWorkTotal(site), requestedWork))
  if (next <= before) return before
  const state = site.constructionMaterials
  if (state) {
    // Commit the reserved recipe once when work begins. Legacy consumed amounts remain paid.
    for (const [name, cost] of Object.entries(state.cost)) {
      const key = name as keyof ResourceAmount
      const amount = Math.max(0, cost - (state.consumed[key] ?? 0))
      if (amount > 0) {
        state.delivered[key] = Math.max(0, (state.delivered[key] ?? 0) - amount)
        state.consumed[key] = (state.consumed[key] ?? 0) + amount
      }
    }
  }
  return next
}

/** All remaining ingredients must be delivered before a builder can work. Carried cargo is not on site. */
export function missingConstructionMaterialsForNextPoint(site: MaterialSite): ResourceAmount {
  return remainingConstructionMaterials(site)
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
