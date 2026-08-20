import { BUILDING_TYPES, FAMILY_TYPES, LOADING_FOOD_TYPES, RESOURCE_STOCKPILE_TYPES } from '../constants'
import { isHeroControlled } from './unitControl'
import type { BuildingEntity, RuntimeEntity, UnitEntity } from '../types/entities'

export type PlayerResourceKey = (typeof RESOURCE_STOCKPILE_TYPES)[keyof typeof RESOURCE_STOCKPILE_TYPES]

export type ResourceLoadMap = Record<string, number>

const CARRIED_RESOURCE_DISPLAY_ORDER: PlayerResourceKey[] = ['food', 'wood', 'stone', 'gold', 'copper', 'iron']

function normalizeResourceLoads(loads: UnitEntity['resourceLoads']): ResourceLoadMap {
  const normalized: ResourceLoadMap = {}
  for (const [type, amount] of Object.entries(loads ?? {})) {
    const value = Number(amount)
    if (type && Number.isFinite(value) && value > 0) normalized[type] = value
  }
  return normalized
}

function ensureHeroResourceLoads(unit: UnitEntity): ResourceLoadMap {
  const hasExplicitLoads = unit.resourceLoads != null
  const normalized = normalizeResourceLoads(unit.resourceLoads)
  if (!hasExplicitLoads && !Object.keys(normalized).length && unit.loadingType && (unit.loading ?? 0) > 0) {
    normalized[unit.loadingType] = unit.loading ?? 0
  }
  unit.resourceLoads = normalized
  return normalized
}

export function syncHeroResourceLoadState(unit: UnitEntity, preferredType?: string | null): void {
  if (!isHeroControlled(unit)) return
  const loads = ensureHeroResourceLoads(unit)
  const entries = Object.entries(loads)
  unit.loading = entries.reduce((total, [, amount]) => total + amount, 0)
  unit.loadingType =
    (preferredType && loads[preferredType] > 0 && preferredType) ||
    (unit.loadingType && loads[unit.loadingType] > 0 && unit.loadingType) ||
    entries[0]?.[0] ||
    null
}

export function getCarriedResourceEntries(unit: UnitEntity): [string, number][] {
  if (isHeroControlled(unit)) {
    syncHeroResourceLoadState(unit)
    return Object.entries(unit.resourceLoads ?? {}).filter((entry): entry is [string, number] => entry[1] > 0)
  }
  return unit.loadingType && (unit.loading ?? 0) > 0 ? [[unit.loadingType, unit.loading ?? 0]] : []
}

export function getTotalCarriedResources(unit: UnitEntity): number {
  return getCarriedResourceEntries(unit).reduce((total, [, amount]) => total + amount, 0)
}

export function getPrimaryCarriedResourceType(unit: UnitEntity): string | null {
  const entries = getCarriedResourceEntries(unit)
  if (unit.loadingType && entries.some(([type]) => type === unit.loadingType)) return unit.loadingType
  return entries[0]?.[0] ?? null
}

export function getDisplayedCarriedResourceEntries(unit: UnitEntity): [PlayerResourceKey, number][] {
  const totals = new Map<PlayerResourceKey, number>()
  for (const [loadingType, amount] of getCarriedResourceEntries(unit)) {
    const resourceKey = getPlayerResourceKey(loadingType)
    if (!resourceKey) continue
    totals.set(resourceKey, (totals.get(resourceKey) ?? 0) + amount)
  }

  return CARRIED_RESOURCE_DISPLAY_ORDER.flatMap(resourceKey => {
    const amount = totals.get(resourceKey) ?? 0
    return amount > 0 ? [[resourceKey, amount] as [PlayerResourceKey, number]] : []
  })
}

export function getCarriedResourceAmount(unit: UnitEntity, loadingType: string): number {
  if (isHeroControlled(unit)) return ensureHeroResourceLoads(unit)[loadingType] ?? 0
  return unit.loadingType === loadingType ? (unit.loading ?? 0) : 0
}

export function getCarriedResourceSpace(unit: UnitEntity, loadingType: string): number {
  if (isHeroControlled(unit)) return Number.POSITIVE_INFINITY
  const maxLoad = unit.loadingMax?.[loadingType] ?? Number.POSITIVE_INFINITY
  return Math.max(maxLoad - (unit.loading ?? 0), 0)
}

export function addCarriedResource(unit: UnitEntity, loadingType: string, amount: number): void {
  if (!(amount > 0)) return
  if (isHeroControlled(unit)) {
    const loads = ensureHeroResourceLoads(unit)
    loads[loadingType] = (loads[loadingType] ?? 0) + amount
    syncHeroResourceLoadState(unit, loadingType)
    return
  }
  unit.loading = (unit.loading ?? 0) + amount
  unit.loadingType = loadingType
}

export function clearCarriedResource(unit: UnitEntity, loadingType: string): void {
  if (isHeroControlled(unit)) {
    const loads = ensureHeroResourceLoads(unit)
    delete loads[loadingType]
    syncHeroResourceLoadState(unit)
    return
  }
  if (unit.loadingType !== loadingType) return
  unit.loading = 0
  unit.loadingType = null
}

export function clearCarriedResources(unit: UnitEntity): void {
  if (isHeroControlled(unit)) unit.resourceLoads = {}
  unit.loading = 0
  unit.loadingType = null
}

export function getPlayerResourceKey(loadingType: string | null | undefined): PlayerResourceKey | null {
  if (!loadingType) return null
  if (LOADING_FOOD_TYPES.includes(loadingType)) return 'food'
  return Object.values(RESOURCE_STOCKPILE_TYPES).find(resource => resource === loadingType) ?? null
}

export function buildingAcceptsResourceType(building: BuildingEntity, loadingType: string): boolean {
  return building.type === BUILDING_TYPES.townCenter || Boolean(building.accept?.includes(loadingType))
}

export function getDeliverableResourceEntries(unit: UnitEntity, building: BuildingEntity): [string, number][] {
  return getCarriedResourceEntries(unit).filter(([loadingType]) => buildingAcceptsResourceType(building, loadingType))
}

export function buildingAcceptsCarriedResources(unit: UnitEntity, target: RuntimeEntity): target is BuildingEntity {
  if (target.family !== FAMILY_TYPES.building) return false
  return getDeliverableResourceEntries(unit, target as BuildingEntity).length > 0
}
