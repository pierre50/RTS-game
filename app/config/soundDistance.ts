export type SoundDistanceProfileId =
  | 'building'
  | 'combat'
  | 'default'
  | 'flame'
  | 'footstep'
  | 'projectile'
  | 'surface'
  | 'voice'
  | 'work'

export type SoundDistanceProfile = {
  curve: number
  maxCells: number
  maxVolume: number
  minVolume: number
}

export const SOUND_DISTANCE_PROFILES: Record<SoundDistanceProfileId, SoundDistanceProfile> = {
  default: {
    curve: 2,
    maxCells: 14,
    maxVolume: 1,
    minVolume: 0,
  },
  voice: {
    curve: 2,
    maxCells: 12,
    maxVolume: 0.9,
    minVolume: 0.02,
  },
  work: {
    curve: 2,
    maxCells: 9,
    maxVolume: 0.72,
    minVolume: 0.02,
  },
  combat: {
    curve: 1.7,
    maxCells: 12,
    maxVolume: 0.9,
    minVolume: 0.025,
  },
  projectile: {
    curve: 1.8,
    maxCells: 11,
    maxVolume: 0.82,
    minVolume: 0.02,
  },
  building: {
    curve: 1.6,
    maxCells: 13,
    maxVolume: 0.82,
    minVolume: 0.025,
  },
  flame: {
    curve: 2.1,
    maxCells: 5,
    maxVolume: 0.54,
    minVolume: 0,
  },
  footstep: {
    curve: 2,
    maxCells: 8,
    maxVolume: 1,
    minVolume: 0.14,
  },
  surface: {
    curve: 2,
    maxCells: 10,
    maxVolume: 0.58,
    minVolume: 0.06,
  },
}
