import { UNIT_TYPES } from '../constants/entities'
import type { RESOURCE_STORAGE_NAMES } from '../constants/entities'

export type CorpseLootEntry = {
  item: (typeof RESOURCE_STORAGE_NAMES)[number]
  chancePercent: number
  min: number
  max: number
}

// Chaque ligne est un tirage indépendant. Quantités entières, bornes incluses.
// leather = peau, fiber = fibre, sinew = tendon, feather = plume.
// Ces provisions s'ajoutent aux ressources transportées et à l'équipement existant.
export const UNIT_CORPSE_LOOT: Readonly<Record<string, readonly CorpseLootEntry[]>> = {
  [UNIT_TYPES.villager]: [
    { item: 'fiber', chancePercent: 65, min: 1, max: 4 },
    { item: 'berry', chancePercent: 45, min: 1, max: 3 },
    { item: 'herb', chancePercent: 30, min: 1, max: 2 },
    { item: 'leather', chancePercent: 20, min: 1, max: 2 },
    { item: 'sinew', chancePercent: 10, min: 1, max: 1 },
  ],
  [UNIT_TYPES.infantry]: [
    { item: 'leather', chancePercent: 55, min: 1, max: 3 },
    { item: 'fiber', chancePercent: 40, min: 1, max: 2 },
    { item: 'sinew', chancePercent: 30, min: 1, max: 2 },
    { item: 'meat', chancePercent: 25, min: 1, max: 2 },
    { item: 'gold', chancePercent: 15, min: 1, max: 3 },
  ],
  [UNIT_TYPES.bowman]: [
    { item: 'feather', chancePercent: 65, min: 2, max: 5 },
    { item: 'sinew', chancePercent: 50, min: 1, max: 3 },
    { item: 'fiber', chancePercent: 40, min: 1, max: 3 },
    { item: 'leather', chancePercent: 30, min: 1, max: 2 },
    { item: 'berry', chancePercent: 25, min: 1, max: 2 },
  ],
  [UNIT_TYPES.banditSword]: [
    { item: 'leather', chancePercent: 60, min: 1, max: 3 },
    { item: 'fiber', chancePercent: 45, min: 1, max: 3 },
    { item: 'sinew', chancePercent: 35, min: 1, max: 2 },
    { item: 'meat', chancePercent: 30, min: 1, max: 2 },
    { item: 'gold', chancePercent: 25, min: 1, max: 4 },
  ],
  [UNIT_TYPES.banditArcher]: [
    { item: 'feather', chancePercent: 60, min: 1, max: 4 },
    { item: 'sinew', chancePercent: 55, min: 1, max: 3 },
    { item: 'leather', chancePercent: 45, min: 1, max: 2 },
    { item: 'fiber', chancePercent: 40, min: 1, max: 3 },
    { item: 'toxicHerb', chancePercent: 15, min: 1, max: 2 },
    { item: 'gold', chancePercent: 20, min: 1, max: 3 },
  ],
  [UNIT_TYPES.banditChief]: [
    { item: 'leather', chancePercent: 75, min: 2, max: 5 },
    { item: 'sinew', chancePercent: 55, min: 1, max: 3 },
    { item: 'fiber', chancePercent: 50, min: 2, max: 4 },
    { item: 'meat', chancePercent: 45, min: 1, max: 3 },
    { item: 'gold', chancePercent: 70, min: 3, max: 8 },
  ],
  [UNIT_TYPES.chief]: [
    { item: 'gold', chancePercent: 65, min: 2, max: 6 },
    { item: 'leather', chancePercent: 50, min: 1, max: 3 },
    { item: 'herb', chancePercent: 40, min: 1, max: 3 },
    { item: 'fiber', chancePercent: 30, min: 1, max: 3 },
  ],
  [UNIT_TYPES.priest]: [
    { item: 'herb', chancePercent: 75, min: 2, max: 5 },
    { item: 'fiber', chancePercent: 55, min: 1, max: 4 },
    { item: 'berry', chancePercent: 35, min: 1, max: 3 },
    { item: 'toxicHerb', chancePercent: 20, min: 1, max: 2 },
    { item: 'gold', chancePercent: 20, min: 1, max: 3 },
  ],
  [UNIT_TYPES.scout]: [
    { item: 'leather', chancePercent: 60, min: 1, max: 3 },
    { item: 'sinew', chancePercent: 45, min: 1, max: 2 },
    { item: 'berry', chancePercent: 45, min: 1, max: 3 },
    { item: 'fiber', chancePercent: 35, min: 1, max: 3 },
    { item: 'herb', chancePercent: 25, min: 1, max: 2 },
  ],
}
