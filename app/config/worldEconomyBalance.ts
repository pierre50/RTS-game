export const WORLD_ECONOMY_BALANCE = {
  easy: { workEfficiency: 0.8, arrivalChance: 0.65 },
  medium: { workEfficiency: 1, arrivalChance: 0.85 },
  hard: { workEfficiency: 1.2, arrivalChance: 1 },
} as const

// Per full worker-day. Primary resources use the shared AI workforce weights.
export const ABSTRACT_VILLAGE_PRODUCTION = {
  food: 32,
  wood: 80,
  stone: 45,
  gold: 20,
  leather: 1,
  fiber: 1,
  sinew: 0.3,
  feather: 0.3,
} as const

export function worldEconomyFactors(difficulty: string | undefined, seed: string, day: number) {
  const balance =
    WORLD_ECONOMY_BALANCE[difficulty as keyof typeof WORLD_ECONOMY_BALANCE] ?? WORLD_ECONOMY_BALANCE.medium
  const roll = (channel: string) => {
    // Stateless draws keep reloads, arrival catch-up and daily updates on the same outcome.
    let hash = 2166136261
    for (const char of `${seed}:${day}:${channel}`) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619)
    hash ^= hash >>> 16
    hash = Math.imul(hash, 0x7feb352d)
    hash ^= hash >>> 15
    return (hash >>> 0) / 4294967296
  }
  return {
    workEfficiency: balance.workEfficiency * (0.9 + roll('work') * 0.2),
    arrivalsAllowed: roll('arrivals') < balance.arrivalChance,
  }
}
