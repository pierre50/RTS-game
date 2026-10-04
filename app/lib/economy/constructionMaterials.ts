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
  totalHitPoints: number
  constructionTime: number
}
export type MaterialSite = {
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

/** Freeze the legacy conversion before health can change. */
export function initializeConstructionProgress(site: MaterialSite): void {
  if (site.constructionProgress == null && (site.isBuilt || site.totalHitPoints != null)) {
    site.constructionProgress = constructionProgress({ ...site, buildingUpgrade: undefined })
  }
  if (site.buildingUpgrade) {
    site.buildingUpgrade.constructionProgress = constructionProgress(site)
    delete site.buildingUpgrade.hitPoints
  }
}

/** Renovation work is independent of the health and availability of the building. */
export function constructionWorkSite(site: MaterialSite): MaterialSite {
  return site.buildingUpgrade
    ? {
        ...site,
        ...site.buildingUpgrade,
        constructionProgress: constructionProgress(site),
        isBuilt: false,
        buildingUpgrade: undefined,
      }
    : site
}
export function hasConstructionWork(site: MaterialSite): boolean {
  return (!site.isBuilt || Boolean(site.buildingUpgrade)) && !site.isDead && !site.isDestroyed
}
export function constructionWorkPoints(site: MaterialSite): number {
  if (site.isBuilt && !site.buildingUpgrade) return site.hitPoints ?? 0 // Repairs use health.
  return constructionProgress(site) * (site.buildingUpgrade?.totalHitPoints ?? site.totalHitPoints ?? 0)
}
export function constructionProgressPercentage(site: MaterialSite): number {
  return 100 * constructionProgress(site)
}

/** Commit work separately from health; construction adds structure without erasing prior damage. */
export function applyConstructionWork(site: MaterialSite, points: number): void {
  if (site.isDead || site.isDestroyed || (site.hitPoints ?? 1) <= 0) return
  if (site.isBuilt && !site.buildingUpgrade) {
    site.hitPoints = Math.min(site.totalHitPoints ?? 0, points)
    return
  }
  initializeConstructionProgress(site)
  const work = site.buildingUpgrade ?? site
  const total = work.totalHitPoints ?? 0
  if (!(total > 0)) return
  const before = constructionProgress(site)
  const after = Math.max(before, Math.min(1, points / total))
  work.constructionProgress = after
  if (!site.buildingUpgrade) {
    const structure = Math.max(0, total - 1)
    const damage = 1 + before * structure - (site.hitPoints ?? 1)
    site.hitPoints = Math.min(total, 1 + after * structure - (Math.abs(damage) < 1e-9 ? 0 : damage))
  }
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
  const total = site.totalHitPoints ?? 0
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
