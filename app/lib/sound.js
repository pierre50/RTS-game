import { sound } from '@pixi/sound'
import { SOUND_CUES } from '../constants'

function pickRandom(items) {
  return items[Math.floor(Math.random() * items.length)]
}

export function resolveSoundCue(cue) {
  if (cue == null) return null
  if (Array.isArray(cue)) return cue.length ? pickRandom(cue) : null
  return cue
}

export function playSoundCue(cue) {
  const soundId = resolveSoundCue(cue)
  if (!soundId) return null
  sound.play(soundId)
  return soundId
}

export function playAudibleSoundCue(instance, cue) {
  if (!instance?.context?.controls?.instanceIsAudible?.(instance)) return null
  return playSoundCue(cue)
}

export function getSelectionSoundCue(instance) {
  if (!instance) return null
  return instance.sounds?.command ?? instance.sounds?.select ?? instance.sounds?.hit ?? SOUND_CUES.ui.menuClick
}

export function playSelectionSound(instance) {
  return playSoundCue(getSelectionSoundCue(instance))
}
