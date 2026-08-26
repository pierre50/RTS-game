import { GAMEPAD_AXIS, GAMEPAD_BUTTON, GAMEPAD_CURSOR_SPEED, getActiveGamepad, readStick } from '../lib/input/gamepad'
import { setVirtualCursorPosition, setVirtualCursorVisible } from '../lib/hero/heroCursor'
import { getGamepadEnabled, type ControlBindingAction } from '../lib/audio/settings'

type GamepadControlsHost = {
  context: { gamebox: HTMLElement }
  heroController: {
    cycleTool(direction: -1 | 1): void
    handleKeyDown(action: ControlBindingAction): boolean | void
    handleKeyUp(action: ControlBindingAction): void
    handlePointerUp(): void
    handlePrimaryPointerDown(): void
  }
  mouse: { x: number; y: number }
  openHeroEntityInteraction(): boolean
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

const HERO_ACTION_BUTTONS: [number, ControlBindingAction][] = [
  [GAMEPAD_BUTTON.dpadUp, 'heroUp'],
  [GAMEPAD_BUTTON.dpadDown, 'heroDown'],
  [GAMEPAD_BUTTON.dpadLeft, 'heroLeft'],
  [GAMEPAD_BUTTON.dpadRight, 'heroRight'],
  [GAMEPAD_BUTTON.defense, 'heroDefense'],
  [GAMEPAD_BUTTON.interact, 'heroInteract'],
  [GAMEPAD_BUTTON.inventory, 'inventory'],
]

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
  private cursorActive: boolean

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
    const gamepad = getGamepadEnabled() ? getActiveGamepad() : null
    this.connected = Boolean(gamepad)
    if (!gamepad) {
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

    const move = readStick(gamepad, GAMEPAD_AXIS.moveX, GAMEPAD_AXIS.moveY)
    this.moveVector = { dx: move.x, dy: move.y }

    const aim = readStick(gamepad, GAMEPAD_AXIS.aimX, GAMEPAD_AXIS.aimY)
    this.aimVector = aim.x || aim.y ? aim : null
    this.directionLockActive = Boolean(gamepad.buttons[GAMEPAD_BUTTON.interact]?.pressed)
    this.updateVirtualCursor()

    const hero = this.controls.heroController
    for (const [index, action] of HERO_ACTION_BUTTONS) {
      this.dispatchButtonEdge(
        gamepad,
        index,
        () => hero.handleKeyDown(action),
        () => hero.handleKeyUp(action)
      )
    }
    this.dispatchButtonEdge(gamepad, GAMEPAD_BUTTON.toolPrev, () => hero.cycleTool(-1))
    this.dispatchButtonEdge(gamepad, GAMEPAD_BUTTON.toolNext, () => hero.cycleTool(1))
    this.dispatchButtonEdge(gamepad, GAMEPAD_BUTTON.inspect, () => this.controls.openHeroEntityInteraction())
    this.dispatchButtonEdge(
      gamepad,
      GAMEPAD_BUTTON.action,
      () => hero.handlePrimaryPointerDown(),
      () => hero.handlePointerUp()
    )
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
    if (pressed && !wasPressed) {
      this.pressedButtons.add(index)
      onDown()
    } else if (!pressed && wasPressed) {
      this.pressedButtons.delete(index)
      onUp?.()
    }
  }
}
