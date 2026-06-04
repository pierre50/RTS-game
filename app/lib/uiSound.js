import { getVolume } from './settings'

const _audioCache = new Map()

function getAudio(soundId) {
  if (!_audioCache.has(soundId)) {
    _audioCache.set(soundId, new Audio(`assets/sounds/${soundId}.wav`))
  }
  return _audioCache.get(soundId)
}

export function playClickSound() {
  playUiSound('5035')
}

export function playUiSound(soundId) {
  const audio = getAudio(soundId)
  audio.currentTime = 0
  audio.volume = getVolume()
  audio.play().catch(() => {})
}
