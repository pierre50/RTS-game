import { getControlActionForKeyboardEvent, type ControlBindingAction } from '../lib/audio/settings'

type ControlsKeyboardHost = {
  buildingPlacer: { cancelWallDraft(): boolean }
  context: {
    menu?: {
      toggleQuests?: () => void
      closeQuests?: () => void
      isQuestJournalOpen?: () => boolean
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
  keyActionsByCode: Partial<Record<string, ControlBindingAction>>
  mouseBuilding: unknown
  shiftKeyActive: boolean
  closeAnyHeroPanel(): boolean
  handleEscapeKey(evt: KeyboardEvent): boolean
  isEditableTarget(target: EventTarget | null): boolean
  isHeroControlActive(): boolean
  isInteractionBlocked(): boolean
  removeMouseBuilding(): void
  stopKeyboardMove(): void
}

const MOVEMENT_ACTIONS = new Set<ControlBindingAction>(['heroLeft', 'heroRight', 'heroDown', 'heroUp'])
export type HeldMovementKeys = Partial<Record<string, ControlBindingAction>>

export function captureControlsMovement(controls: ControlsKeyboardHost): () => HeldMovementKeys {
  const held: HeldMovementKeys = Object.fromEntries(
    Object.entries(controls.keyActionsByCode).filter(([, action]) => action && MOVEMENT_ACTIONS.has(action))
  )
  const clear = (): void => {
    for (const code of Object.keys(held)) delete held[code]
  }
  const onDown = (event: KeyboardEvent): void => {
    if (event.altKey || event.metaKey || event.key === 'Escape') {
      clear()
      return
    }
    if (event.repeat || !event.code || controls.isEditableTarget(event.target)) return
    const action = getControlActionForKeyboardEvent(event)
    if (action && MOVEMENT_ACTIONS.has(action)) held[event.code] = action
  }
  const onUp = (event: KeyboardEvent): void => {
    delete held[event.code]
  }
  const onVisibility = (): void => {
    if (document.hidden) clear()
  }
  document.addEventListener('keydown', onDown)
  document.addEventListener('keyup', onUp)
  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('blur', clear)
  return () => {
    document.removeEventListener('keydown', onDown)
    document.removeEventListener('keyup', onUp)
    document.removeEventListener('visibilitychange', onVisibility)
    window.removeEventListener('blur', clear)
    return held
  }
}

export function restoreControlsMovement(controls: ControlsKeyboardHost, held: HeldMovementKeys): void {
  if (controls.isInteractionBlocked()) return
  for (const [code, action] of Object.entries(held)) {
    if (!action || !MOVEMENT_ACTIONS.has(action)) continue
    controls.keyActionsByCode[code] = action
    controls.heroController.handleKeyDown(action)
  }
}

export function handleControlsEscapeKey(controls: ControlsKeyboardHost, evt: KeyboardEvent): boolean {
  if (controls.context.menu?.isQuestJournalOpen?.()) {
    evt.preventDefault()
    controls.context.menu.closeQuests?.()
    return true
  }
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
  if (evt.key === 'Shift') {
    evt.preventDefault()
    if (evt.repeat || controls.isInteractionBlocked()) return
    if (action && controls.heroController.handleKeyDown(action)) {
      if (evt.code) controls.keyActionsByCode[evt.code] = action
      return
    }
    controls.shiftKeyActive = !controls.shiftKeyActive
    return
  }
  if (action === 'quests' && !evt.repeat && controls.context.menu?.isQuestJournalOpen?.()) {
    evt.preventDefault()
    controls.context.menu.closeQuests?.()
    return
  }
  if (action === 'inventory' && controls.isHeroControlActive() && controls.context.menu?.isInventoryOpen?.()) {
    evt.preventDefault()
    controls.context.menu.closeInventory?.()
    return
  }
  if (controls.isInteractionBlocked()) return
  if (action === 'quests') {
    if (!evt.repeat) {
      evt.preventDefault()
      controls.context.menu?.toggleQuests?.()
    }
    return
  }
  if (controls.context.menu?.isQuestJournalOpen?.()) return
  if (evt.repeat) return

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
  if (evt.key === 'Shift') {
    if (action) controls.heroController.handleKeyUp(action)
    evt.preventDefault()
    return
  }
  if (action) controls.heroController.handleKeyUp(action)
}
