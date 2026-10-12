import type { ResourceAmount } from '../types/common'

export const DAILY_CONSUMPTION_PER_VILLAGER: ResourceAmount = {
  food: 4,
}

export const VILLAGER_ARRIVAL_CONFIG = {
  currentPopulationReserveDays: 3,
  newVillagerReserveDays: 5,
} as const
