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
export const DEV_SPEED_PRESETS = [
  ...SPEED_PRESETS,
  { key: '4x', value: 4 },
  { key: '8x', value: 8 },
]
export const SPEED_VALUES = DEV_SPEED_PRESETS.map(({ value }) => String(value))
export const GAME_SPEED_USAGE = `speed <${SPEED_VALUES.join('|')}>`

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v))
}

let _volume = (() => {
  const stored = parseFloat(localStorage.getItem(VOLUME_KEY))
  return isFinite(stored) ? clamp(stored, 0, 1) : DEFAULT_VOLUME
})()

let _gameSpeed = (() => {
  const stored = parseFloat(localStorage.getItem(SPEED_KEY))
  return isGameSpeedPreset(stored) ? stored : DEFAULT_SPEED
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
  const speed = Number(v)
  if (!isGameSpeedPreset(speed)) return false
  _gameSpeed = speed
  localStorage.setItem(SPEED_KEY, speed)
  return true
}

export function isGameSpeedPreset(v) {
  return DEV_SPEED_PRESETS.some(p => p.value === Number(v))
}
