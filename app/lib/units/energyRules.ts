import { ACTION_TYPES } from '../../constants/entities'
import { getMiningActions } from './miningActions'

export const DEFAULT_UNIT_TOTAL_ENERGY = 10
export const DEFAULT_UNIT_ENERGY_REGEN_PER_SECOND = 2
export const DEFAULT_UNIT_ENERGY_REGEN_DELAY_MS = 650

const DEFAULT_ACTION_ENERGY_COST: Record<string, number> = {
  [ACTION_TYPES.attack]: 2,
  [ACTION_TYPES.flee]: 0.25,
  flee: 0.25,
  [ACTION_TYPES.hunt]: 2,
  [ACTION_TYPES.captureHorse]: 2,
  [ACTION_TYPES.chopwood]: 1,
  ...Object.fromEntries(getMiningActions().map(action => [action, 1.5])),
  [ACTION_TYPES.build]: 2,
  [ACTION_TYPES.forageberry]: 0.375,
  [ACTION_TYPES.farm]: 0.5,
  [ACTION_TYPES.takemeat]: 0.25,
  [ACTION_TYPES.heal]: 1.5,
  [ACTION_TYPES.convert]: 2,
  heroPowerCharge: 2,
  heroDefense: 2,
  heroWhiff: 0.75,
}

export function getBaseActionEnergyCost(
  costs: Partial<Record<string, number>> | undefined,
  action: string | null | undefined
): number {
  return action ? Math.max(0, costs?.[action] ?? DEFAULT_ACTION_ENERGY_COST[action] ?? 0) : 0
}
