import { getVolume } from './settings'
import { SOUND_CUES } from '../constants'

const _audioCache = new Map()

function getAudio(soundId) {
  if (!_audioCache.has(soundId)) {
    _audioCache.set(soundId, new Audio(`assets/sounds/${soundId}.wav`))
  }
  return _audioCache.get(soundId)
}

export function playClickSound() {
  playUiSound(SOUND_CUES.ui.buttonPress)
}

export function playUiSound(soundId) {
  const audio = getAudio(soundId)
  audio.currentTime = 0
  audio.volume = getVolume()
  audio.play().catch(() => {})
}

export function stopAllUiSounds() {
  for (const audio of _audioCache.values()) {
    audio.pause()
    audio.currentTime = 0
  }
}
