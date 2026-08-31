import { getVolume } from './settings'
import { SOUND_CUES } from '../constants'

type SoundId = string | number

const _audioCache = new Map<SoundId, HTMLAudioElement>()

function getAudio(soundId: SoundId): HTMLAudioElement {
  if (!_audioCache.has(soundId)) {
    _audioCache.set(soundId, new Audio(`assets/sounds/ui/${soundId}.ogg`))
  }
  return _audioCache.get(soundId)!
}

export function playClickSound(): void {
  playUiSound(SOUND_CUES.ui.buttonPress)
}

export function playUiSound(soundId: SoundId): void {
  const audio = getAudio(soundId)
  audio.currentTime = 0
  audio.volume = getVolume()
  audio.play().catch(() => {})
}

export function stopAllUiSounds(): void {
  for (const audio of _audioCache.values()) {
    audio.pause()
    audio.currentTime = 0
  }
}
