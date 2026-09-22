type AnimalDrop = { resource: 'feather' | 'leather' | 'sinew'; min: number; max: number; chance: number }

// Rolled once per kill. Primary materials are guaranteed, including tutorial prey.
export const ANIMAL_CORPSE_DROPS: Record<string, AnimalDrop[]> = {
  BlackGrouse: [{ resource: 'feather', min: 1, max: 3, chance: 1 }],
  Boar: [
    { resource: 'leather', min: 2, max: 4, chance: 1 },
    { resource: 'sinew', min: 1, max: 3, chance: 0.8 },
  ],
  Deer: [
    { resource: 'leather', min: 1, max: 3, chance: 1 },
    { resource: 'sinew', min: 1, max: 2, chance: 0.7 },
  ],
  Fox: [
    { resource: 'leather', min: 1, max: 2, chance: 1 },
    { resource: 'sinew', min: 1, max: 1, chance: 0.5 },
  ],
  Hare: [
    { resource: 'leather', min: 1, max: 1, chance: 1 },
    { resource: 'sinew', min: 1, max: 1, chance: 0.3 },
  ],
  Horse: [
    { resource: 'leather', min: 2, max: 4, chance: 1 },
    { resource: 'sinew', min: 1, max: 3, chance: 0.8 },
  ],
  Wolf: [
    { resource: 'leather', min: 1, max: 3, chance: 1 },
    { resource: 'sinew', min: 1, max: 3, chance: 0.8 },
  ],
}
