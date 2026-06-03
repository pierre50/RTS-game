import { getVolume } from './settings'

const _audio = new Audio('assets/sounds/5035.wav')

export function playClickSound() {
  _audio.currentTime = 0
  _audio.volume = getVolume()
  _audio.play().catch(() => {})
}
