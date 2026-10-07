import { DEFAULT_VILLAGE_RESERVES } from './collectiveNeeds'
import type { ResourceAmount } from '../../types/common'

export type DepotReservePolicy = { target: number; shares: ResourceAmount }
export const FOOD_RESERVE_RESOURCES = ['wheat', 'berry', 'meat'] as const
const MATERIAL_RESERVE_RESOURCES = ['wood', 'stone', 'gold', 'copper', 'tin', 'iron'] as const
// Accepted only when reading policies from older saves.
export const LEGACY_MATERIAL_RESERVES = ['fiber', 'leather', 'sinew', 'feather', 'herb', 'toxicHerb'] as const
export const MAX_RESERVE_TARGET = 1000000
export function isFoodReserveResource(resource: string): resource is (typeof FOOD_RESERVE_RESOURCES)[number] {
  return (FOOD_RESERVE_RESOURCES as readonly string[]).includes(resource)
}
export function depotReserveResources(type: string): readonly (keyof ResourceAmount)[] {
  return type === 'Granary' ? FOOD_RESERVE_RESOURCES : MATERIAL_RESERVE_RESOURCES
}

/** Largest remainders preserve the exact total without fractional items or percentages. */
function distribute(weights: ResourceAmount, keys: readonly (keyof ResourceAmount)[], total: number): ResourceAmount {
  const sum = keys.reduce((n, key) => n + (weights[key] ?? 0), 0)
  const result: ResourceAmount = Object.fromEntries(keys.map(key => [key, 0]))
  if (!sum) return result
  const parts = keys.map(key => ({ key, exact: (total * (weights[key] ?? 0)) / sum }))
  for (const part of parts) result[part.key] = Math.floor(part.exact)
  let remaining = total - Object.values(result).reduce((n, amount) => n + amount, 0)
  parts.sort((a, b) => (b.exact % 1) - (a.exact % 1))
  for (const part of parts) if (remaining-- > 0) result[part.key]!++
  return result
}

export function setReserveShare(
  policy: DepotReservePolicy,
  resource: keyof ResourceAmount,
  value: number,
  type: string
): DepotReservePolicy {
  const keys = depotReserveResources(type)
  if (!keys.includes(resource) || !Number.isFinite(value)) return policy
  const share = Math.max(0, Math.min(100, Math.round(value)))
  const others = keys.filter(key => key !== resource && (policy.shares[key] ?? 0) > 0)
  const shares: ResourceAmount = Object.fromEntries(keys.map(key => [key, 0]))
  Object.assign(shares, distribute(policy.shares, others, 100 - share))
  shares[resource] = others.length ? share : share > 0 ? 100 : 0
  return { target: policy.target, shares }
}

export function reserveAmounts(policy: DepotReservePolicy, type: string): ResourceAmount {
  return distribute(policy.shares, depotReserveResources(type), Math.max(0, Math.floor(policy.target)))
}

export function defaultDepotReservePolicy(type: string, foodTarget = 100): DepotReservePolicy {
  return type === 'Granary'
    ? { target: foodTarget, shares: { wheat: 100, berry: 0, meat: 0 } }
    : { target: 100, shares: { ...DEFAULT_VILLAGE_RESERVES.materials } }
}

export function reserveUsesFoodJob(resource: string): boolean {
  return ['food', ...FOOD_RESERVE_RESOURCES, 'fiber', 'herb', 'toxicHerb', 'leather', 'sinew', 'feather'].includes(
    resource
  )
}

export function normalizeDepotReservePolicy(policy: DepotReservePolicy, type: string): DepotReservePolicy {
  return { target: policy.target, shares: distribute(policy.shares, depotReserveResources(type), 100) }
}
