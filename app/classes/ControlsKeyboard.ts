import { getControlActionForKeyboardEvent, type ControlBindingAction } from '../lib/audio/settings'

type ControlsKeyboardHost = {
  buildingPlacer: { cancelWallDraft(): boolean }
  context: {
    menu?: {
      closeInventory?: () => void
      handleHotkey?: (key: string) => void
      isInventoryOpen?: () => boolean
      updateActionTarget?: () => void
    }
  }
  heroController: {
    cancelGoToPicking(): void
    handleKeyDown(action: ControlBindingAction): boolean | void
    handleKeyUp(action: ControlBindingAction): void
    pendingGoToNpcs?: unknown
  }
  heroDirectionLockActive: boolean
  keyActionsByCode: Partial<Record<string, ControlBindingAction>>
  keyPressedCount: number
  keySpeed: number
  keysPressed: Partial<Record<ControlBindingAction, boolean>>
  mouseBuilding: unknown
  rallyPointController: { active: boolean; cancel(): void }
  shiftKeyActive: boolean
  closeAnyHeroPanel(): boolean
  handleEscapeKey(evt: KeyboardEvent): boolean
  isEditableTarget(target: EventTarget | null): boolean
  isHeroControlActive(): boolean
  isInteractionBlocked(): boolean
  moveCamera(direction: 'left' | 'right' | 'up' | 'down', speed: number, double?: boolean, frameScale?: number): void
  removeMouseBuilding(): void
  stopKeyboardMove(): void
}

const CAMERA_ACTIONS = new Set<ControlBindingAction>(['cameraLeft', 'cameraRight', 'cameraDown', 'cameraUp'])
const KEYBOARD_CAMERA_INITIAL_SPEED = 7
const KEYBOARD_CAMERA_MAX_SPEED = 14
const KEYBOARD_CAMERA_ACCELERATION = 0.24

export function handleControlsEscapeKey(controls: ControlsKeyboardHost, evt: KeyboardEvent): boolean {
  if (controls.buildingPlacer.cancelWallDraft()) {
    evt.preventDefault()
    return true
  }
  if (controls.mouseBuilding) {
    evt.preventDefault()
    controls.removeMouseBuilding()
    controls.context.menu?.updateActionTarget?.()
    return true
  }
  if (controls.rallyPointController.active) {
    evt.preventDefault()
    controls.rallyPointController.cancel()
    return true
  }
  if (controls.isHeroControlActive() && controls.heroController.pendingGoToNpcs) {
    evt.preventDefault()
    controls.heroController.cancelGoToPicking()
    return true
  }
  if (controls.isHeroControlActive() && controls.context.menu?.isInventoryOpen?.()) {
    evt.preventDefault()
    controls.context.menu.closeInventory?.()
    return true
  }
  if (controls.isHeroControlActive() && controls.closeAnyHeroPanel()) {
    evt.preventDefault()
    return true
  }
  return false
}

export function handleControlsKeyDown(controls: ControlsKeyboardHost, evt: KeyboardEvent): void {
  if (controls.isEditableTarget(evt.target)) return
  if (evt.key === 'Alt' || evt.altKey) {
    controls.stopKeyboardMove()
    return
  }
  if (evt.key === 'Escape' && controls.handleEscapeKey(evt)) return
  const action = getControlActionForKeyboardEvent(evt)
  if (action === 'heroDirectionLock') {
    if (evt.code) controls.keyActionsByCode[evt.code] = action
    controls.heroDirectionLockActive = true
    if (evt.key === 'Shift') controls.shiftKeyActive = true
    evt.preventDefault()
    return
  }
  if (evt.key === 'Shift') {
    controls.shiftKeyActive = true
    evt.preventDefault()
    return
  }
  if (action === 'inventory' && controls.isHeroControlActive() && controls.context.menu?.isInventoryOpen?.()) {
    evt.preventDefault()
    controls.context.menu.closeInventory?.()
    return
  }
  if (controls.isInteractionBlocked()) return
  const isCameraAction = Boolean(action && CAMERA_ACTIONS.has(action))
  if (evt.repeat && !isCameraAction) return

  if (action && isCameraAction) {
    if (evt.code) controls.keyActionsByCode[evt.code] = action
    if (!evt.repeat) {
      controls.keysPressed[action] = true
      controls.keyPressedCount++
      if (controls.keyPressedCount === 1) {
        controls.keySpeed = KEYBOARD_CAMERA_INITIAL_SPEED
      }
    }
    return
  }

  if (action && controls.heroController.handleKeyDown(action)) {
    if (evt.code) controls.keyActionsByCode[evt.code] = action
    return
  }

  controls.context.menu?.handleHotkey?.(evt.key.toLowerCase())
}

export function handleControlsKeyUp(controls: ControlsKeyboardHost, evt: KeyboardEvent): void {
  if (controls.isInteractionBlocked()) {
    controls.stopKeyboardMove()
    return
  }

  if (evt.key === 'Alt') {
    controls.stopKeyboardMove()
    return
  }

  const action = getControlActionForKeyboardEvent(evt) || (evt.code ? controls.keyActionsByCode[evt.code] : null)
  if (evt.code) delete controls.keyActionsByCode[evt.code]
  if (action === 'heroDirectionLock') {
    controls.heroDirectionLockActive = false
    if (evt.key === 'Shift') controls.shiftKeyActive = false
    evt.preventDefault()
    return
  }
  if (evt.key === 'Shift') {
    controls.shiftKeyActive = false
    evt.preventDefault()
    return
  }
  if (action) controls.heroController.handleKeyUp(action)

  if (!action || !CAMERA_ACTIONS.has(action)) return

  if (!evt.repeat && controls.keysPressed[action]) {
    delete controls.keysPressed[action]
    controls.keyPressedCount--
  }
  if (controls.keyPressedCount <= 0) {
    controls.keyPressedCount = 0
    controls.keySpeed = 0
  }
}

export function panControlsCameraWithArrowKeys(controls: ControlsKeyboardHost, frameScale: number): void {
  if (controls.keyPressedCount <= 0) return
  const double = controls.keyPressedCount > 1
  if (controls.keySpeed < KEYBOARD_CAMERA_MAX_SPEED) {
    controls.keySpeed = Math.min(KEYBOARD_CAMERA_MAX_SPEED, controls.keySpeed + frameScale * KEYBOARD_CAMERA_ACCELERATION)
  }
  if (controls.keysPressed.cameraLeft) controls.moveCamera('left', controls.keySpeed, double, frameScale)
  if (controls.keysPressed.cameraUp) controls.moveCamera('up', controls.keySpeed, double, frameScale)
  if (controls.keysPressed.cameraDown) controls.moveCamera('down', controls.keySpeed, double, frameScale)
  if (controls.keysPressed.cameraRight) controls.moveCamera('right', controls.keySpeed, double, frameScale)
}
