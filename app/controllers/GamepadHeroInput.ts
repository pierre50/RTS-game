import { GAMEPAD_AXIS, GAMEPAD_CURSOR_SPEED, getActiveGamepad, readStick } from '../lib/input/gamepad'
import { getConsumedGamepadButtons } from '../lib/input/gamepadConsumption'
import { setVirtualCursorPosition, setVirtualCursorVisible } from '../lib/hero/heroCursor'
import { getGamepadButtonIndex, getGamepadEnabled, type ControlBindingAction } from '../lib/audio/settings'

type GamepadControlsHost = {
  context: { gamebox: HTMLElement; menu?: { toggleQuests?(): void } }
  heroController: {
    cancelActiveInteraction?(): void
    cycleTool(direction: -1 | 1): void
    handleKeyDown(action: ControlBindingAction): boolean | void
    handleKeyUp(action: ControlBindingAction): void
    handlePointerUp(): void
    handlePrimaryPointerDown(): void
  }
  mouseBuilding?: unknown
  buildingPlacer?: {
    confirmPlacement(): void
    toggleMirror(): void
    cancelPlacement(): void
    setPlacementGamepad(value: boolean): void
  }
  mouse: { x: number; y: number }
  openHeroEntityInteraction(): boolean
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

const HERO_ACTIONS = [
  'heroUp',
  'heroDown',
  'heroLeft',
  'heroRight',
  'heroDefense',
  'heroInteract',
  'inventory',
  'heroMountHorse',
  'heroDismountHorse',
] as const
type HeroButtonAction = (typeof HERO_ACTIONS)[number]
function heroActionButtons(): [number, HeroButtonAction][] {
  return HERO_ACTIONS.map(action => [getGamepadButtonIndex(action), action])
}

/**
 * Translates a connected gamepad into the same inputs keyboard/mouse already drive on
 * HeroController (handleKeyDown/Up, handlePrimaryPointerDown/Up, cycleTool), plus exposes
 * the left/right stick vectors for Controls to blend into movement and aim.
 */
export class GamepadHeroInput {
  controls: GamepadControlsHost
  moveVector: { dx: number; dy: number }
  aimVector: { x: number; y: number } | null
  directionLockActive: boolean
  connected: boolean
  private pressedButtons: Set<number>
  private consumedButtons = new Set<number>()
  private cursorActive: boolean
  private uiActive = false
  private activeActions = new Map<HeroButtonAction, number>()
  private primaryHeld = false

  constructor(controls: GamepadControlsHost) {
    this.controls = controls
    this.moveVector = { dx: 0, dy: 0 }
    this.aimVector = null
    this.directionLockActive = false
    this.connected = false
    this.pressedButtons = new Set()
    this.cursorActive = false
  }

  update(): void {
    this.consumedButtons.clear()
    const gamepad = getGamepadEnabled() ? getActiveGamepad() : null
    const wasConnected = this.connected
    this.connected = Boolean(gamepad)
    if (!gamepad) {
      this.releaseWorldActions()
      this.uiActive = false
      if (this.controls.mouseBuilding) this.controls.buildingPlacer?.setPlacementGamepad(false)
      this.moveVector = { dx: 0, dy: 0 }
      this.aimVector = null
      this.directionLockActive = false
      this.pressedButtons.clear()
      if (this.cursorActive) {
        this.cursorActive = false
        setVirtualCursorVisible(false)
      }
      return
    }

    // A window may close before this loop sees its final button press.
    for (const index of getConsumedGamepadButtons(gamepad)) this.pressedButtons.add(index)

    // UI has its own polling loop, including while the game is paused.
    if (typeof document !== 'undefined' && document.querySelector?.('.game-window')) {
      this.moveVector = { dx: 0, dy: 0 }
      this.aimVector = null
      this.directionLockActive = false
      if (!this.uiActive) this.releaseWorldActions()
      this.uiActive = true
      this.pressedButtons = new Set(gamepad.buttons.flatMap((button, index) => (button.pressed ? [index] : [])))
      this.cursorActive = false
      setVirtualCursorVisible(false)
      return
    }

    this.uiActive = false
    const move = readStick(gamepad, GAMEPAD_AXIS.moveX, GAMEPAD_AXIS.moveY)
    this.moveVector = { dx: move.x, dy: move.y }

    const aim = readStick(gamepad, GAMEPAD_AXIS.aimX, GAMEPAD_AXIS.aimY)
    this.aimVector = aim.x || aim.y ? aim : null
    this.directionLockActive = Boolean(gamepad.buttons[getGamepadButtonIndex('heroInteract')]?.pressed)
    this.updateVirtualCursor()

    if (this.controls.mouseBuilding && this.controls.buildingPlacer) {
      this.releaseWorldActions()
      const placer = this.controls.buildingPlacer
      this.directionLockActive = false
      if (
        !wasConnected ||
        move.x ||
        move.y ||
        this.aimVector ||
        gamepad.buttons.some((button, index) => button.pressed && !this.pressedButtons.has(index))
      )
        placer.setPlacementGamepad(true)
      this.dispatchButtonEdge(gamepad, getGamepadButtonIndex('placementPlace'), () => placer.confirmPlacement())
      this.dispatchButtonEdge(gamepad, getGamepadButtonIndex('placementMirror'), () => placer.toggleMirror())
      this.dispatchButtonEdge(gamepad, getGamepadButtonIndex('placementCancel'), () => placer.cancelPlacement())
      // Consume placement buttons so closing the preview cannot trigger combat on the next frame.
      this.pressedButtons = new Set(gamepad.buttons.flatMap((button, index) => (button.pressed ? [index] : [])))
      return
    }

    const transferOneButton = getGamepadButtonIndex('inventoryTransferOne')
    const transferAllButton = getGamepadButtonIndex('inventoryTransferAll')
    this.dispatchInventoryTransferButton(gamepad, transferOneButton, 'one')
    this.dispatchInventoryTransferButton(gamepad, transferAllButton, 'all')

    const hero = this.controls.heroController
    // Release the original action even if its button was reassigned while held.
    for (const [action, index] of this.activeActions) {
      if (getGamepadButtonIndex(action) !== index) {
        hero.handleKeyUp(action)
        this.activeActions.delete(action)
      }
    }
    for (const [index, action] of heroActionButtons()) {
      this.dispatchButtonEdge(
        gamepad,
        index,
        () => {
          this.activeActions.set(action, index)
          hero.handleKeyDown(action)
        },
        () => {
          if (this.activeActions.delete(action)) hero.handleKeyUp(action)
        }
      )
    }
    this.dispatchButtonEdge(gamepad, getGamepadButtonIndex('quests'), () =>
      this.controls.context.menu?.toggleQuests?.()
    )
    this.dispatchButtonEdge(gamepad, getGamepadButtonIndex('heroToolPrev'), () => hero.cycleTool(-1))
    this.dispatchButtonEdge(gamepad, getGamepadButtonIndex('heroToolNext'), () => hero.cycleTool(1))
    this.dispatchButtonEdge(gamepad, getGamepadButtonIndex('heroInspect'), () =>
      this.controls.openHeroEntityInteraction()
    )
    this.dispatchButtonEdge(
      gamepad,
      getGamepadButtonIndex('heroAction'),
      () => {
        this.primaryHeld = true
        hero.handlePrimaryPointerDown()
      },
      () => {
        if (this.primaryHeld) hero.handlePointerUp()
        this.primaryHeld = false
      }
    )
    this.pressedButtons = new Set(gamepad.buttons.flatMap((button, index) => (button.pressed ? [index] : [])))
  }

  /** Consume held buttons when a menu, pause or focus change interrupts gameplay. */
  suspend(): void {
    this.releaseWorldActions()
    this.moveVector = { dx: 0, dy: 0 }
    this.aimVector = null
    this.directionLockActive = false
    const pad = getGamepadEnabled() ? getActiveGamepad() : null
    this.pressedButtons = new Set(pad?.buttons.flatMap((button, index) => (button.pressed ? [index] : [])) ?? [])
    this.cursorActive = false
    setVirtualCursorVisible(false)
  }

  private releaseWorldActions(): void {
    if (this.activeActions.size || this.primaryHeld) this.controls.heroController.cancelActiveInteraction?.()
    for (const action of this.activeActions.keys()) this.controls.heroController.handleKeyUp(action)
    this.activeActions.clear()
    if (this.primaryHeld) this.controls.heroController.handlePointerUp()
    this.primaryHeld = false
  }

  /**
   * The right stick drives the same `controls.mouse` position mouse/keyboard play already
   * reads everywhere (aim, hover cursor, building placement) — so nothing downstream needs to
   * know a gamepad is involved. Since a page can't move the real OS cursor, a lookalike element
   * (see lib/heroCursor) stands in for it while this is active.
   */
  private updateVirtualCursor(): void {
    if (!this.aimVector) return
    const { mouse, context } = this.controls
    const rect = context.gamebox.getBoundingClientRect()
    const width = rect.width
    const height = rect.height
    if (!this.cursorActive) {
      mouse.x = width / 2
      mouse.y = height / 2
    }
    this.cursorActive = true
    mouse.x = clamp(mouse.x + this.aimVector.x * GAMEPAD_CURSOR_SPEED, 0, width)
    mouse.y = clamp(mouse.y + this.aimVector.y * GAMEPAD_CURSOR_SPEED, 0, height)
    setVirtualCursorVisible(true)
    setVirtualCursorPosition(mouse.x, mouse.y)
  }

  private dispatchButtonEdge(gamepad: Gamepad, index: number, onDown: () => void, onUp?: () => void): void {
    const pressed = Boolean(gamepad.buttons[index]?.pressed)
    const wasPressed = this.pressedButtons.has(index)
    if (this.consumedButtons.has(index)) return
    if (pressed && !wasPressed) {
      onDown()
    } else if (!pressed && wasPressed) {
      onUp?.()
    }
  }

  private dispatchInventoryTransferButton(gamepad: Gamepad, index: number, mode: 'one' | 'all'): void {
    const pressed = Boolean(gamepad.buttons[index]?.pressed)
    const wasPressed = this.pressedButtons.has(index)
    if (!pressed) return
    const slot = this.getHoveredInventoryTransferSlot()
    if (!slot) return
    this.consumedButtons.add(index)
    if (wasPressed) return
    slot.dispatchEvent(new CustomEvent('inventorytransfergamepad', { bubbles: true, detail: { mode } }))
  }

  private getHoveredInventoryTransferSlot(): HTMLElement | null {
    if (typeof document === 'undefined' || typeof document.elementFromPoint !== 'function') return null
    const { mouse } = this.controls
    const scrollX = typeof window === 'undefined' ? 0 : window.scrollX
    const scrollY = typeof window === 'undefined' ? 0 : window.scrollY
    const element = document.elementFromPoint(mouse.x - scrollX, mouse.y - scrollY)
    return element?.closest?.('[data-inventory-transfer-slot="true"]') as HTMLElement | null
  }
}
