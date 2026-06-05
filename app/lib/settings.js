import { sound } from '@pixi/sound'

const VOLUME_KEY = 'sfx_volume'
const SPEED_KEY = 'game_speed'
const CAMERA_ZOOM_KEY = 'camera_zoom'

const DEFAULT_VOLUME = 0.6
const DEFAULT_SPEED = 1.5
const DEFAULT_CAMERA_ZOOM = 1

export const SPEED_PRESETS = [
  { key: 'speedSlow', value: 1 },
  { key: 'speedNormal', value: 1.5 },
  { key: 'speedFast', value: 2 },
]
export const CAMERA_ZOOM_PRESETS = [
  { key: 'zoomStandard', value: 1 },
  { key: 'zoomFar', value: 0.85 },
  { key: 'zoomVeryFar', value: 0.7 },
]
export const DEV_SPEED_PRESETS = [...SPEED_PRESETS, { key: '4x', value: 4 }, { key: '8x', value: 8 }]
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
  return isVisibleGameSpeedPreset(stored) ? stored : DEFAULT_SPEED
})()

let _cameraZoom = (() => {
  const stored = parseFloat(localStorage.getItem(CAMERA_ZOOM_KEY))
  return isVisibleCameraZoomPreset(stored) ? stored : DEFAULT_CAMERA_ZOOM
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
  if (!isVisibleGameSpeedPreset(speed)) return false
  _gameSpeed = speed
  localStorage.setItem(SPEED_KEY, speed)
  return true
}

export function getCameraZoom() {
  return _cameraZoom
}

export function setCameraZoom(v) {
  const zoom = Number(v)
  if (!isVisibleCameraZoomPreset(zoom)) return false
  _cameraZoom = zoom
  localStorage.setItem(CAMERA_ZOOM_KEY, zoom)
  return true
}

export function isVisibleGameSpeedPreset(v) {
  return SPEED_PRESETS.some(p => p.value === Number(v))
}

export function isVisibleCameraZoomPreset(v) {
  return CAMERA_ZOOM_PRESETS.some(p => p.value === Number(v))
}

export function isGameSpeedPreset(v) {
  return DEV_SPEED_PRESETS.some(p => p.value === Number(v))
}
