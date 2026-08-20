import { sound } from '@pixi/sound'

const VOLUME_KEY = 'sfx_volume'
const SPEED_KEY = 'game_speed'
const CAMERA_ZOOM_KEY = 'camera_zoom'
const SCREEN_BRIGHTNESS_KEY = 'screen_brightness'
const SHADOWS_KEY = 'graphics_shadows'
const RESOURCE_WIND_KEY = 'graphics_resource_wind'
const KEY_BINDINGS_KEY = 'controls_key_bindings'
const GAMEPAD_ENABLED_KEY = 'controls_gamepad_enabled'

const DEFAULT_VOLUME = 0.6
const DEFAULT_SPEED = 1.5
const DEFAULT_CAMERA_ZOOM = 1
const DEFAULT_SCREEN_BRIGHTNESS = 1
export const DISPLAY_SCALE = 1.5
const DEFAULT_SHADOWS_ENABLED = true
const DEFAULT_RESOURCE_WIND_ENABLED = true
const DEFAULT_GAMEPAD_ENABLED = true
const SETTINGS_CHANGE_EVENT = 'dawn-settings-change'
const DIGIT_CONTROL_ALIASES: Record<string, string[]> = {
  Digit1: ['Digit1', 'Numpad1', '1', '&'],
  Digit2: ['Digit2', 'Numpad2', '2', 'é'],
  Digit3: ['Digit3', 'Numpad3', '3', '"'],
  Digit4: ['Digit4', 'Numpad4', '4', "'"],
  Digit5: ['Digit5', 'Numpad5', '5', '('],
  Digit6: ['Digit6', 'Numpad6', '6', '-', '§'],
}

export type ControlBindingAction =
  | 'cameraUp'
  | 'cameraDown'
  | 'cameraLeft'
  | 'cameraRight'
  | 'heroUp'
  | 'heroDown'
  | 'heroLeft'
  | 'heroRight'
  | 'heroInteract'
  | 'heroDefense'
  | 'heroDirectionLock'
  | 'heroTool1'
  | 'heroTool2'
  | 'heroTool3'
  | 'heroTool4'
  | 'heroMountHorse'
  | 'inventory'
  | 'pause'

export type ControlKeyBindings = Record<ControlBindingAction, string>

export const DEFAULT_KEY_BINDINGS: ControlKeyBindings = {
  cameraUp: 'ArrowUp',
  cameraDown: 'ArrowDown',
  cameraLeft: 'ArrowLeft',
  cameraRight: 'ArrowRight',
  heroUp: 'z',
  heroDown: 's',
  heroLeft: 'q',
  heroRight: 'd',
  heroInteract: 'e',
  heroDefense: 'Space',
  heroDirectionLock: 'Control',
  heroTool1: 'Digit1',
  heroTool2: 'Digit2',
  heroTool3: 'Digit3',
  heroTool4: 'Digit4',
  heroMountHorse: 'h',
  inventory: 'i',
  pause: 'p',
}

export const CONTROL_BINDING_GROUPS: { key: string; actions: ControlBindingAction[] }[] = [
  { key: 'controlsGroupCamera', actions: ['cameraUp', 'cameraDown', 'cameraLeft', 'cameraRight'] },
  {
    key: 'controlsGroupHero',
    actions: [
      'heroUp',
      'heroDown',
      'heroLeft',
      'heroRight',
      'heroInteract',
      'heroDefense',
      'heroDirectionLock',
      'heroTool1',
      'heroTool2',
      'heroTool3',
      'heroTool4',
      'heroMountHorse',
      'inventory',
    ],
  },
  { key: 'controlsGroupGame', actions: ['pause'] },
]

const CONTROL_BINDING_ACTIONS = Object.keys(DEFAULT_KEY_BINDINGS) as ControlBindingAction[]

export const SPEED_PRESETS = [
  { key: 'speedSlow', value: 1.25 },
  { key: 'speedNormal', value: 1.5 },
  { key: 'speedFast', value: 2 },
]
export const CAMERA_ZOOM_PRESETS = [
  { key: 'zoomVeryClose', value: 3 },
  { key: 'zoomClose', value: 2 },
  { key: 'zoomStandard', value: 1 },
]
const DEV_SPEED_PRESETS = [...SPEED_PRESETS, { key: '4x', value: 4 }, { key: '8x', value: 8 }]
export const SPEED_VALUES = DEV_SPEED_PRESETS.map(({ value }) => String(value))
export const GAME_SPEED_USAGE = `speed <${SPEED_VALUES.join('|')}>`

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

function getStoredBoolean(key: string, fallback: boolean): boolean {
  const stored = localStorage.getItem(key)
  if (stored === 'true') return true
  if (stored === 'false') return false
  return fallback
}

let _volume = (() => {
  const stored = parseFloat(localStorage.getItem(VOLUME_KEY) ?? '')
  return isFinite(stored) ? clamp(stored, 0, 1) : DEFAULT_VOLUME
})()

let _gameSpeed = (() => {
  const stored = parseFloat(localStorage.getItem(SPEED_KEY) ?? '')
  return isVisibleGameSpeedPreset(stored) ? stored : DEFAULT_SPEED
})()

let _cameraZoom = (() => {
  const stored = parseFloat(localStorage.getItem(CAMERA_ZOOM_KEY) ?? '')
  return isVisibleCameraZoomPreset(stored) ? stored : DEFAULT_CAMERA_ZOOM
})()

let _screenBrightness = (() => {
  const stored = parseFloat(localStorage.getItem(SCREEN_BRIGHTNESS_KEY) ?? '')
  return isFinite(stored) ? clamp(stored, 0.5, 1.5) : DEFAULT_SCREEN_BRIGHTNESS
})()

let _shadowsEnabled = getStoredBoolean(SHADOWS_KEY, DEFAULT_SHADOWS_ENABLED)
let _resourceWindEnabled = getStoredBoolean(RESOURCE_WIND_KEY, DEFAULT_RESOURCE_WIND_ENABLED)
let _gamepadEnabled = getStoredBoolean(GAMEPAD_ENABLED_KEY, DEFAULT_GAMEPAD_ENABLED)
let _keyBindings = loadKeyBindings()

sound.volumeAll = _volume

function notifySettingsChanged(): void {
  window.dispatchEvent(new Event(SETTINGS_CHANGE_EVENT))
}

export function getVolume(): number {
  return _volume
}

export function setVolume(v: number): void {
  _volume = clamp(v, 0, 1)
  localStorage.setItem(VOLUME_KEY, String(_volume))
  sound.volumeAll = _volume
}

export function getGameSpeed(): number {
  return _gameSpeed
}

export function setGameSpeed(v: number | string): boolean {
  const speed = Number(v)
  if (!isVisibleGameSpeedPreset(speed)) return false
  _gameSpeed = speed
  localStorage.setItem(SPEED_KEY, String(speed))
  return true
}

export function getCameraZoom(): number {
  return _cameraZoom
}

export function setCameraZoom(v: number | string): boolean {
  const zoom = Number(v)
  if (!isVisibleCameraZoomPreset(zoom)) return false
  _cameraZoom = zoom
  localStorage.setItem(CAMERA_ZOOM_KEY, String(zoom))
  return true
}

export function getScreenBrightness(): number {
  return _screenBrightness
}

export function setScreenBrightness(v: number): void {
  _screenBrightness = clamp(v, 0.5, 1.5)
  localStorage.setItem(SCREEN_BRIGHTNESS_KEY, String(_screenBrightness))
  notifySettingsChanged()
}

export function getShadowsEnabled(): boolean {
  return _shadowsEnabled
}

export function setShadowsEnabled(value: boolean): void {
  _shadowsEnabled = value
  localStorage.setItem(SHADOWS_KEY, String(value))
  notifySettingsChanged()
}

export function getResourceWindAnimationEnabled(): boolean {
  return _resourceWindEnabled
}

export function setResourceWindAnimationEnabled(value: boolean): void {
  _resourceWindEnabled = value
  localStorage.setItem(RESOURCE_WIND_KEY, String(value))
  notifySettingsChanged()
}

export function getGamepadEnabled(): boolean {
  return _gamepadEnabled
}

export function setGamepadEnabled(value: boolean): void {
  _gamepadEnabled = value
  localStorage.setItem(GAMEPAD_ENABLED_KEY, String(value))
  notifySettingsChanged()
}

export function onVisualSettingsChange(callback: () => void): () => void {
  window.addEventListener(SETTINGS_CHANGE_EVENT, callback)
  return () => window.removeEventListener(SETTINGS_CHANGE_EVENT, callback)
}

export function normalizeControlKey(key: string): string {
  if (key === ' ') return 'Space'
  if (key.length === 1) return key.toLowerCase()
  return key
}

export function getControlKeyLabel(key: string): string {
  if (/^Digit\d$/.test(key)) return key.replace('Digit', '')
  if (/^Numpad\d$/.test(key)) return `Num ${key.replace('Numpad', '')}`
  if (key === 'Space') return 'Space'
  if (key.startsWith('Arrow')) return key.replace('Arrow', '')
  return key.length === 1 ? key.toUpperCase() : key
}

export function getKeyBindings(): ControlKeyBindings {
  return { ..._keyBindings }
}

export function setKeyBinding(action: ControlBindingAction, key: string): void {
  const normalizedKey = normalizeControlKey(key)
  _keyBindings = { ..._keyBindings, [action]: normalizedKey }
  localStorage.setItem(KEY_BINDINGS_KEY, JSON.stringify(_keyBindings))
}

export function setKeyBindingFromKeyboardEvent(action: ControlBindingAction, evt: KeyboardEvent): void {
  setKeyBinding(action, getControlKeyFromKeyboardEvent(evt))
}

export function resetKeyBindings(): ControlKeyBindings {
  _keyBindings = { ...DEFAULT_KEY_BINDINGS }
  localStorage.setItem(KEY_BINDINGS_KEY, JSON.stringify(_keyBindings))
  return getKeyBindings()
}

export function getControlActionForKey(key: string): ControlBindingAction | null {
  const normalized = normalizeControlKey(key)
  return CONTROL_BINDING_ACTIONS.find(action => areControlKeysEquivalent(_keyBindings[action], normalized)) ?? null
}

export function getControlActionForKeyboardEvent(evt: KeyboardEvent): ControlBindingAction | null {
  const eventKey = getControlKeyFromKeyboardEvent(evt)
  const keyAction = getControlActionForKey(eventKey)
  if (keyAction) return keyAction
  if (eventKey !== evt.key) return getControlActionForKey(evt.key)
  return null
}

export function getReservedGameplayHotkeys(): string[] {
  const actions: ControlBindingAction[] = [
    'heroUp',
    'heroDown',
    'heroLeft',
    'heroRight',
    'heroInteract',
    'heroDefense',
    'heroDirectionLock',
    'heroTool1',
    'heroTool2',
    'heroTool3',
    'heroTool4',
    'heroMountHorse',
    'inventory',
  ]
  return actions.map(action => _keyBindings[action])
}

function isVisibleGameSpeedPreset(v: number | string): boolean {
  return SPEED_PRESETS.some(p => p.value === Number(v))
}

function isVisibleCameraZoomPreset(v: number | string): boolean {
  return CAMERA_ZOOM_PRESETS.some(p => p.value === Number(v))
}

export function isGameSpeedPreset(v: number | string): boolean {
  return DEV_SPEED_PRESETS.some(p => p.value === Number(v))
}

function loadKeyBindings(): ControlKeyBindings {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY_BINDINGS_KEY) || '{}') as Partial<ControlKeyBindings>
    return {
      ...DEFAULT_KEY_BINDINGS,
      ...Object.fromEntries(
        CONTROL_BINDING_ACTIONS.map(action => [
          action,
          normalizeControlKey(parsed[action] || DEFAULT_KEY_BINDINGS[action]),
        ])
      ),
    } as ControlKeyBindings
  } catch {
    return { ...DEFAULT_KEY_BINDINGS }
  }
}

function getControlKeyFromKeyboardEvent(evt: KeyboardEvent): string {
  if (/^(Digit|Numpad)[0-9]$/.test(evt.code)) return evt.code
  return evt.key
}

function areControlKeysEquivalent(a: string, b: string): boolean {
  const normalizedA = normalizeControlKey(a)
  const normalizedB = normalizeControlKey(b)
  if (normalizedA === normalizedB) return true
  return Object.values(DIGIT_CONTROL_ALIASES).some(
    aliases => aliases.includes(normalizedA) && aliases.includes(normalizedB)
  )
}
