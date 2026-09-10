import { UNIT_TYPES } from './entities'
import type { ResourceAmount } from '../types/common'

// Bronze equipment uses copper: iron remains unavailable until the final age.
export const UNIT_TRAINING_AGE_METAL_COST: Partial<Record<string, Partial<Record<number, ResourceAmount>>>> = {
  [UNIT_TYPES.infantry]: {
    1: { copper: 100 },
    2: { iron: 150 },
  },
  [UNIT_TYPES.bowman]: {
    1: { copper: 80 },
    2: { iron: 120 },
  },
}
