import { sound } from '@pixi/sound'

const VOLUME_KEY = 'sfx_volume'
const SPEED_KEY = 'game_speed'

const DEFAULT_VOLUME = 0.6
const DEFAULT_SPEED = 1.5

export const SPEED_PRESETS = [
  { key: 'speedSlow', value: 1 },
  { key: 'speedNormal', value: 1.5 },
  { key: 'speedFast', value: 2 },
]

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v))
}

let _volume = (() => {
  const stored = parseFloat(localStorage.getItem(VOLUME_KEY))
  return isFinite(stored) ? clamp(stored, 0, 1) : DEFAULT_VOLUME
})()

let _gameSpeed = (() => {
  const stored = parseFloat(localStorage.getItem(SPEED_KEY))
  return SPEED_PRESETS.some(p => p.value === stored) ? stored : DEFAULT_SPEED
})()

sound.volumeAll = _volume

export function getVolume() {
  return _volume
}

export function setVolume(v) {
  _volume = clamp(v, 0, 1)
  localStorage.setItem(VOLUME_KEY, _volume)
  sound.volumeAll = _volume
}

export function getGameSpeed() {
  return _gameSpeed
}

export function setGameSpeed(v) {
  _gameSpeed = v
  localStorage.setItem(SPEED_KEY, v)
}
