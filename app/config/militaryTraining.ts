/** Indices are internal building levels 0 / 1 / 2. Durations are unchanged. */
export const MILITARY_TRAINING_CAPACITY = [3, 5, 8] as const
export const MILITARY_TRAINING_START_XP = [0, 50, 150] as const
export const DEFAULT_TRAINING_CAPACITY = 5
export const MILITARY_TRAINING_BUILDINGS = ['Barracks', 'ArcheryRange', 'Stable'] as const
export const TRAINING_SPECIALTIES: Record<string, { unit: string; skill: string }> = {
  Barracks: { unit: 'Fantassin', skill: 'melee' },
  ArcheryRange: { unit: 'Bowman', skill: 'ranged' },
}

/** The archery range has two distinct construction sprites and two gameplay levels. */
export const ARCHERY_TRAINING_CAPACITY = [3, 8] as const
export const ARCHERY_TRAINING_START_XP = [0, 150] as const
