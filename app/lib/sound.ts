import { sound } from '@pixi/sound'
import type { AudibleInstanceLike } from '../types/context'

type SoundCue = string | number
type MaybeSoundCue = SoundCue | SoundCue[] | null | undefined

export type AudibleInstance = {
  context?: {
    controls?: {
      instanceIsAudible?: (instance: AudibleInstanceLike) => boolean
    }
  }
  sounds?: {
    command?: MaybeSoundCue
    hit?: MaybeSoundCue
    select?: MaybeSoundCue
  }
} & AudibleInstanceLike

function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)]
}

function resolveSoundCue(cue: MaybeSoundCue): SoundCue | null {
  if (cue == null) return null
  if (Array.isArray(cue)) return cue.length ? pickRandom(cue) : null
  return cue
}

export function playSoundCue(cue: MaybeSoundCue): SoundCue | null {
  const soundId = resolveSoundCue(cue)
  if (!soundId) return null
  sound.play(soundId as string)
  return soundId
}

export function playAudibleSoundCue(instance: AudibleInstance, cue: MaybeSoundCue): SoundCue | null {
  if (!instance?.context?.controls?.instanceIsAudible?.(instance)) return null
  return playSoundCue(cue)
}

function getSelectionSoundCue(instance?: AudibleInstance | null): MaybeSoundCue | null {
  if (!instance) return null
  return instance.sounds?.command ?? instance.sounds?.select ?? instance.sounds?.hit ?? null
}

export function playSelectionSound(instance?: AudibleInstance | null): SoundCue | null {
  return playSoundCue(getSelectionSoundCue(instance))
}
