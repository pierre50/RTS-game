import { VILLAGE_ACTIVITY_RADIUS } from './villageActivity'

/** Levels are internal 0 / 1 / 2. Food is a reserve requirement, not an arrival fee. */
export const TOWN_CENTER_LEVELS = [
  { maxArrivals: 1, growthRate: 0.12, power: 2, range: 4, targets: 1 },
  { maxArrivals: 2, growthRate: 0.18, power: 3, range: 4.5, targets: 1 },
  { maxArrivals: 3, growthRate: 0.24, power: 4, range: 5, targets: 2 },
] as const
export const TOWN_CENTER_DEFENSE = { projectile: 'Arrow', rateOfFire: 2.5 } as const

/** Centers with overlapping village territories share one daily allowance. */
export const TOWN_CENTER_SHARED_ARRIVAL_RADIUS = 2 * VILLAGE_ACTIVITY_RADIUS
