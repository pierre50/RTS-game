import { sound } from '@pixi/sound'
import { SOUND_DISTANCE_PROFILES, type SoundDistanceProfileId } from '../../config/soundDistance'
import { pickRandomItem } from '../random'
import type { AudibleInstanceLike } from '../../types/context'

type SoundCue = string | number
type MaybeSoundCue = SoundCue | SoundCue[] | null | undefined
type PlaySoundCueOptions = {
  volume?: number
}
type PlayAudibleSoundCueOptions = PlaySoundCueOptions & {
  profile?: SoundDistanceProfileId
}

export type AudibleInstance = {
  context?: {
    controls?: {
      heroUnit?: { x?: number; y?: number } | null
      instanceIsAudible?: (instance: AudibleInstanceLike) => boolean
    }
  }
  sounds?: {
    command?: MaybeSoundCue
    hit?: MaybeSoundCue
    select?: MaybeSoundCue
  }
} & AudibleInstanceLike

function resolveSoundCue(cue: MaybeSoundCue): SoundCue | null {
  if (cue == null) return null
  if (Array.isArray(cue)) return cue.length ? pickRandomItem(cue) : null
  return cue
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export function getHeroDistanceSoundVolume(
  instance: AudibleInstance,
  profileId: SoundDistanceProfileId = 'default',
  baseVolume = 1
): number {
  const profile = SOUND_DISTANCE_PROFILES[profileId]
  const hero = instance.context?.controls?.heroUnit
  if (!hero || hero === instance || instance.x == null || instance.y == null || hero.x == null || hero.y == null) {
    return clamp(baseVolume * profile.maxVolume, 0, 1)
  }

  const distance = Math.hypot((instance.x ?? 0) - hero.x, (instance.y ?? 0) - hero.y)
  if (distance >= profile.maxDistance) return 0
  const ratio = clamp(1 - distance / profile.maxDistance, 0, 1)
  const attenuation = profile.minVolume + (profile.maxVolume - profile.minVolume) * Math.pow(ratio, profile.curve)
  return clamp(baseVolume * attenuation, 0, 1)
}

export function playSoundCue(cue: MaybeSoundCue, options: PlaySoundCueOptions = {}): SoundCue | null {
  const soundId = resolveSoundCue(cue)
  if (!soundId) return null
  sound.play(soundId as string, options)
  return soundId
}

export function playAudibleSoundCue(
  instance: AudibleInstance,
  cue: MaybeSoundCue,
  options: PlayAudibleSoundCueOptions = {}
): SoundCue | null {
  if (!instance?.context?.controls?.instanceIsAudible?.(instance)) return null
  const { profile, ...playOptions } = options
  const volume = getHeroDistanceSoundVolume(instance, profile, playOptions.volume ?? 1)
  if (volume <= 0) return null
  return playSoundCue(cue, { ...playOptions, volume })
}

function getSelectionSoundCue(instance?: AudibleInstance | null): MaybeSoundCue | null {
  if (!instance) return null
  return instance.sounds?.command ?? instance.sounds?.select ?? null
}

export function playSelectionSound(instance?: AudibleInstance | null): SoundCue | null {
  if (!instance) return null
  return playAudibleSoundCue(instance, getSelectionSoundCue(instance), { profile: 'voice' })
}
