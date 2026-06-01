const _audio = new Audio('assets/sounds/5035.wav')
_audio.volume = 0.6

export function playClickSound() {
  _audio.currentTime = 0
  _audio.play().catch(() => {})
}
