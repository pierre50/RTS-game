import { UNIT_TYPES } from './entities'
import type { ResourceAmount } from '../types/common'

// No standalone "bronze" resource exists (see RESOURCE_STOCKPILE_TYPES: only copper/iron are
// mineable) — bronze-age cost mixes copper + iron, mirroring the hero's arrow_bronze recipe.
export const UNIT_TRAINING_AGE_METAL_COST: Partial<Record<string, Partial<Record<number, ResourceAmount>>>> = {
  [UNIT_TYPES.infantry]: {
    1: { copper: 100 },
    2: { copper: 60, iron: 40 },
    3: { iron: 150 },
  },
  [UNIT_TYPES.bowman]: {
    1: { copper: 80 },
    2: { copper: 50, iron: 30 },
    3: { iron: 120 },
  },
}
