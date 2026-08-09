import type { ResourceAmount } from '../types/common'

export const RESOURCES_MAP: Record<string, ResourceAmount> = {
  low: { wood: 100, food: 150, stone: 50, gold: 0, copper: 0, iron: 0 },
  standard: { wood: 200, food: 200, stone: 150, gold: 0, copper: 0, iron: 0 },
  high: { wood: 500, food: 500, stone: 300, gold: 0, copper: 0, iron: 0 },
  very_high: { wood: 1000, food: 1000, stone: 750, gold: 100, copper: 50, iron: 50 },
}

// Réutilisé comme bonus de ressources de départ par CivilizationLevel (1 -> standard, 2 -> high, 3 -> very_high).
export const CIVILIZATION_LEVEL_RESOURCE_BONUS: Record<number, ResourceAmount> = {
  1: RESOURCES_MAP.standard,
  2: RESOURCES_MAP.high,
  3: RESOURCES_MAP.very_high,
}
