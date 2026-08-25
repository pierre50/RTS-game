export type SoundDistanceProfileId =
  | 'building'
  | 'combat'
  | 'default'
  | 'footstep'
  | 'projectile'
  | 'surface'
  | 'voice'
  | 'work'

export type SoundDistanceProfile = {
  curve: number
  maxDistance: number
  maxVolume: number
  minVolume: number
}

export const SOUND_DISTANCE_PROFILES: Record<SoundDistanceProfileId, SoundDistanceProfile> = {
  default: {
    curve: 2,
    maxDistance: 900,
    maxVolume: 1,
    minVolume: 0,
  },
  voice: {
    curve: 2,
    maxDistance: 760,
    maxVolume: 0.9,
    minVolume: 0.02,
  },
  work: {
    curve: 2,
    maxDistance: 560,
    maxVolume: 0.72,
    minVolume: 0.02,
  },
  combat: {
    curve: 1.7,
    maxDistance: 760,
    maxVolume: 0.9,
    minVolume: 0.025,
  },
  projectile: {
    curve: 1.8,
    maxDistance: 720,
    maxVolume: 0.82,
    minVolume: 0.02,
  },
  building: {
    curve: 1.6,
    maxDistance: 820,
    maxVolume: 0.82,
    minVolume: 0.025,
  },
  footstep: {
    curve: 2,
    maxDistance: 520,
    maxVolume: 1,
    minVolume: 0.14,
  },
  surface: {
    curve: 2,
    maxDistance: 620,
    maxVolume: 0.58,
    minVolume: 0.06,
  },
}
