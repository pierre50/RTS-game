import { planBindingChange } from '../input/bindingChange'
import { sound } from '@pixi/sound'

const VOLUME_KEY = 'sfx_volume'
const SPEED_KEY = 'game_speed'
const CAMERA_ZOOM_KEY = 'camera_zoom'
const SCREEN_BRIGHTNESS_KEY = 'screen_brightness'
const SHADOWS_KEY = 'graphics_shadows'
const RESOURCE_WIND_KEY = 'graphics_resource_wind'
const BLOOD_EFFECTS_KEY = 'graphics_blood_effects'
const KEY_BINDINGS_KEY = 'controls_key_bindings'
const GAMEPAD_ENABLED_KEY = 'controls_gamepad_enabled'
const GAMEPAD_BINDINGS_KEY = 'controls_gamepad_bindings'
const GAMEPAD_LAYOUT_VERSION_KEY = 'controls_gamepad_layout_version'
const GAMEPAD_LAYOUT_VERSION = '4'

const DEFAULT_VOLUME = 0.6
const DEFAULT_SPEED = 1
const DEFAULT_CAMERA_ZOOM = 1
const DEFAULT_SCREEN_BRIGHTNESS = 1
export const DISPLAY_SCALE = 1.8
const DEFAULT_SHADOWS_ENABLED = true
const DEFAULT_RESOURCE_WIND_ENABLED = true
const DEFAULT_BLOOD_EFFECTS_ENABLED = true
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
  | 'heroUp'
  | 'heroDown'
  | 'heroLeft'
  | 'heroRight'
  | 'heroInteract'
  | 'heroDefense'
  | 'heroTool1'
  | 'heroTool2'
  | 'heroTool3'
  | 'heroMountHorse'
  | 'heroDismountHorse'
  | 'quests'
  | 'inventory'

export type ControlKeyBindings = Record<ControlBindingAction, string>

export type GamepadBindingAction =
  | 'destinationConfirm'
  | 'destinationCancel'
  | 'heroCommunicate'
  | 'heroCancel'
  | 'heroStealth'
  | 'heroSprint'
  | 'heroInteract'
  | 'heroDefense'
  | 'inventory'
  | 'quests'
  | 'heroMountHorse'
  | 'gameMenu'
  | 'heroAction'
  | 'heroDirectAttack'
  | 'heroToolPrev'
  | 'heroToolNext'
  | 'placementPlace'
  | 'placementMirror'
  | 'placementCancel'
  | 'inventoryTransferOne'
  | 'inventoryTransferAll'

export const GAMEPAD_BINDING_GROUPS: { key: string; actions: GamepadBindingAction[] }[] = [
  {
    key: 'controlsGroupHero',
    actions: [
      'gameMenu',
      'quests',
      'heroMountHorse',
      'heroStealth',
      'heroSprint',
      'heroCommunicate',
      'heroCancel',
      'heroAction',
      'heroDirectAttack',
      'heroDefense',
      'heroInteract',
      'heroToolPrev',
      'heroToolNext',
      'inventory',
    ],
  },
  { key: 'placementHelp', actions: ['placementPlace', 'placementMirror', 'placementCancel'] },
  { key: 'inventory', actions: ['inventoryTransferOne', 'inventoryTransferAll'] },
  { key: 'destinationPickingHelp', actions: ['destinationConfirm', 'destinationCancel'] },
]
type GamepadButtonBinding = `Button${number}`
export type GamepadButtonBindings = Record<GamepadBindingAction, GamepadButtonBinding>

const DEFAULT_KEY_BINDINGS: ControlKeyBindings = {
  heroUp: 'z',
  heroDown: 's',
  heroLeft: 'q',
  heroRight: 'd',
  heroInteract: 'e',
  heroDefense: 'Space',
  heroTool1: 'Digit1',
  heroTool2: 'Digit2',
  heroTool3: 'Digit3',
  heroMountHorse: 'h',
  heroDismountHorse: 'Shift',
  quests: 'j',
  inventory: 'i',
}

const DEFAULT_GAMEPAD_BINDINGS: GamepadButtonBindings = {
  destinationConfirm: 'Button0',
  destinationCancel: 'Button1',
  heroStealth: 'Button11',
  heroSprint: 'Button10',
  heroCommunicate: 'Button3',
  heroCancel: 'Button8',
  gameMenu: 'Button9',
  quests: 'Button12',
  heroMountHorse: 'Button13',
  heroInteract: 'Button0',
  heroDefense: 'Button6',
  inventory: 'Button1',
  heroAction: 'Button5',
  heroDirectAttack: 'Button7',
  heroToolPrev: 'Button14',
  heroToolNext: 'Button2',
  placementPlace: 'Button0',
  placementMirror: 'Button2',
  placementCancel: 'Button1',
  inventoryTransferOne: 'Button0',
  inventoryTransferAll: 'Button2',
}

const GAMEPAD_BUTTON_LABELS: Record<GamepadButtonBinding, string> = {
  Button0: 'A / Cross',
  Button1: 'B / Circle',
  Button2: 'X / Square',
  Button3: 'Y / Triangle',
  Button4: 'L1 / LB',
  Button5: 'R1 / RB',
  Button6: 'L2 / LT',
  Button7: 'R2 / RT',
  Button8: 'View / Select',
  Button9: 'Menu / Start',
  Button10: 'L3',
  Button11: 'R3',
  Button12: 'D-Pad Up',
  Button13: 'D-Pad Down',
  Button14: 'D-Pad Left',
  Button15: 'D-Pad Right',
  Button16: 'Home',
}

export const CONTROL_BINDING_GROUPS: { key: string; actions: ControlBindingAction[] }[] = [
  {
    key: 'controlsGroupHero',
    actions: [
      'heroUp',
      'heroDown',
      'heroLeft',
      'heroRight',
      'heroInteract',
      'heroDefense',
      'heroTool1',
      'heroTool2',
      'heroTool3',
      'heroMountHorse',
      'heroDismountHorse',
      'quests',
      'inventory',
    ],
  },
]

const CONTROL_BINDING_ACTIONS = Object.keys(DEFAULT_KEY_BINDINGS) as ControlBindingAction[]
const GAMEPAD_BINDING_ACTIONS = Object.keys(DEFAULT_GAMEPAD_BINDINGS) as GamepadBindingAction[]

export const SPEED_PRESETS = [
  { key: 'speedSlow', value: 0.8 },
  { key: 'speedNormal', value: 1 },
  { key: 'speedFast', value: 1.5 },
]
export const CAMERA_ZOOM_PRESETS = [
  { key: 'zoomVeryClose', value: 3 },
  { key: 'zoomClose', value: 2 },
  { key: 'zoomStandard', value: 1 },
]
const DEV_SPEED_PRESETS = [
  ...SPEED_PRESETS,
  { key: '0.5x', value: 0.5 },
  { key: '2x', value: 2 },
  { key: '4x', value: 4 },
  { key: '8x', value: 8 },
]
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
let _bloodEffectsEnabled = getStoredBoolean(BLOOD_EFFECTS_KEY, DEFAULT_BLOOD_EFFECTS_ENABLED)
let _gamepadEnabled = getStoredBoolean(GAMEPAD_ENABLED_KEY, DEFAULT_GAMEPAD_ENABLED)
let _keyBindings = loadKeyBindings()
let _gamepadBindings = loadGamepadBindings()

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

export function getBloodEffectsEnabled(): boolean {
  return _bloodEffectsEnabled
}

export function setBloodEffectsEnabled(value: boolean): void {
  _bloodEffectsEnabled = value
  localStorage.setItem(BLOOD_EFFECTS_KEY, String(value))
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

export function getGamepadBindings(): GamepadButtonBindings {
  return { ..._gamepadBindings }
}

/** @public Loaded by tests/control-key-bindings.test.cjs (babel loader). */
export function getGamepadButtonLabel(binding: GamepadButtonBinding): string {
  return GAMEPAD_BUTTON_LABELS[binding] ?? binding.replace('Button', 'Button ')
}

export function getGamepadButtonIndex(action: GamepadBindingAction): number {
  return Number(_gamepadBindings[action].replace('Button', ''))
}

/** @public Loaded by tests/control-key-bindings.test.cjs (babel loader). */
export function setGamepadBindingFromButtonIndex(action: GamepadBindingAction, index: number): void {
  if (!Number.isInteger(index) || index < 0) return
  _gamepadBindings = { ..._gamepadBindings, [action]: `Button${index}` as GamepadButtonBinding }
  localStorage.setItem(GAMEPAD_BINDINGS_KEY, JSON.stringify(_gamepadBindings))
  notifySettingsChanged()
}

export function resetGamepadBindings(
  actions: readonly GamepadBindingAction[] = GAMEPAD_BINDING_ACTIONS
): GamepadButtonBindings {
  _gamepadBindings = { ..._gamepadBindings }
  for (const action of actions) _gamepadBindings[action] = DEFAULT_GAMEPAD_BINDINGS[action]
  localStorage.setItem(GAMEPAD_BINDINGS_KEY, JSON.stringify(_gamepadBindings))
  notifySettingsChanged()
  return getGamepadBindings()
}

export function getGamepadBindingChange(action: GamepadBindingAction, index: number) {
  const sharesContext = (a: GamepadBindingAction, b: GamepadBindingAction): boolean =>
    GAMEPAD_BINDING_GROUPS.some(group => group.actions.includes(a) && group.actions.includes(b)) ||
    (a === 'gameMenu' && (b.startsWith('placement') || b.startsWith('destination'))) ||
    (b === 'gameMenu' && (a.startsWith('placement') || a.startsWith('destination')))
  return planBindingChange(_gamepadBindings, action, `Button${index}`, sharesContext)
}

export function rebindGamepadButton(action: GamepadBindingAction, index: number): boolean {
  if (!Number.isInteger(index) || index < 0) return false
  const { swapped } = getGamepadBindingChange(action, index)
  if (!swapped) return false
  _gamepadBindings = swapped as GamepadButtonBindings
  localStorage.setItem(GAMEPAD_BINDINGS_KEY, JSON.stringify(_gamepadBindings))
  notifySettingsChanged()
  return true
}

export function getKeyboardBindingChange(action: ControlBindingAction, event: KeyboardEvent) {
  return planBindingChange(
    _keyBindings,
    action,
    normalizeControlKey(getControlKeyFromKeyboardEvent(event)),
    () => true,
    areControlKeysEquivalent
  )
}

export function rebindKeyboardKey(action: ControlBindingAction, event: KeyboardEvent): boolean {
  const { swapped } = getKeyboardBindingChange(action, event)
  if (!swapped) return false
  _keyBindings = swapped
  localStorage.setItem(KEY_BINDINGS_KEY, JSON.stringify(_keyBindings))
  return true
}

export function onVisualSettingsChange(callback: () => void): () => void {
  window.addEventListener(SETTINGS_CHANGE_EVENT, callback)
  return () => window.removeEventListener(SETTINGS_CHANGE_EVENT, callback)
}

function normalizeControlKey(key: string): string {
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

function setKeyBinding(action: ControlBindingAction, key: string): void {
  const normalizedKey = normalizeControlKey(key)
  _keyBindings = { ..._keyBindings, [action]: normalizedKey }
  localStorage.setItem(KEY_BINDINGS_KEY, JSON.stringify(_keyBindings))
}

/** @public Loaded by tests/control-key-bindings.test.cjs (babel loader). */
export function setKeyBindingFromKeyboardEvent(action: ControlBindingAction, evt: KeyboardEvent): void {
  setKeyBinding(action, getControlKeyFromKeyboardEvent(evt))
}

export function resetKeyBindings(
  actions: readonly ControlBindingAction[] = CONTROL_BINDING_ACTIONS
): ControlKeyBindings {
  _keyBindings = { ..._keyBindings }
  for (const action of actions) _keyBindings[action] = DEFAULT_KEY_BINDINGS[action]
  localStorage.setItem(KEY_BINDINGS_KEY, JSON.stringify(_keyBindings))
  return getKeyBindings()
}

function getControlActionForKey(key: string): ControlBindingAction | null {
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
    'heroTool1',
    'heroTool2',
    'heroTool3',
    'heroMountHorse',
    'heroDismountHorse',
    'quests',
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

function normalizeGamepadButtonBinding(
  value: string | undefined,
  fallback: GamepadButtonBinding
): GamepadButtonBinding {
  return /^Button\d+$/.test(value ?? '') ? (value as GamepadButtonBinding) : fallback
}

function loadGamepadBindings(): GamepadButtonBindings {
  try {
    const parsed = JSON.parse(localStorage.getItem(GAMEPAD_BINDINGS_KEY) || '{}') as Partial<GamepadButtonBindings>
    const bindings = {
      ...DEFAULT_GAMEPAD_BINDINGS,
      ...Object.fromEntries(
        GAMEPAD_BINDING_ACTIONS.map(action => [
          action,
          normalizeGamepadButtonBinding(parsed[action], DEFAULT_GAMEPAD_BINDINGS[action]),
        ])
      ),
    } as GamepadButtonBindings
    // Apply the new gameplay layout once; retain construction and inventory preferences.
    if (localStorage.getItem(GAMEPAD_LAYOUT_VERSION_KEY) !== GAMEPAD_LAYOUT_VERSION) {
      if (localStorage.getItem(GAMEPAD_LAYOUT_VERSION_KEY) === '3') {
        if (bindings.heroAction === 'Button7') bindings.heroAction = 'Button5'
      } else {
        for (const action of GAMEPAD_BINDING_GROUPS[0].actions) bindings[action] = DEFAULT_GAMEPAD_BINDINGS[action]
      }
      localStorage.setItem(GAMEPAD_BINDINGS_KEY, JSON.stringify(bindings))
      localStorage.setItem(GAMEPAD_LAYOUT_VERSION_KEY, GAMEPAD_LAYOUT_VERSION)
    }
    if (parsed.heroSprint == null) {
      const used = new Set(
        GAMEPAD_BINDING_GROUPS[0].actions.filter(action => action !== 'heroSprint').map(action => bindings[action])
      )
      if (used.has(bindings.heroSprint)) {
        const free = Array.from({ length: 17 }, (_, index) => `Button${index}` as GamepadButtonBinding).find(
          button => !used.has(button)
        )
        if (free) bindings.heroSprint = free
      }
    }
    return bindings
  } catch {
    return { ...DEFAULT_GAMEPAD_BINDINGS }
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
