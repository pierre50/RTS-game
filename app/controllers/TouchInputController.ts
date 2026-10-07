import { pointsDistance } from '../lib'
import { IS_MOBILE, TOUCH_DRAG_THRESHOLD } from '../constants'
import type { ControlPointerEvent } from '../types/context'

type PointerPageEvent = ControlPointerEvent & {
  pageX: number
  pageY: number
  button?: number
  ctrlKey?: boolean
  preventDefault?: () => void
}

export type TouchInteraction = {
  mode: 'ignore' | 'tap' | 'select'
  startX: number
  startY: number
  moved: boolean
}

type TouchControlsHost = {
  mouse: { x: number; y: number; prevent: boolean }
  mouseBuilding: unknown
  mouseDrag: boolean
  touchInteraction: TouchInteraction | null
  ignoreMouseEventsUntil: number
  buildingPlacer: { handleMouseMove: () => void }
  isInteractionBlocked(): boolean
  isMouseInApp(evt: PointerPageEvent): boolean
  onMouseDown(evt: PointerPageEvent): void
  onMouseMove(evt: PointerPageEvent): void
  onMouseUp(evt: PointerPageEvent): void
}

const COMPATIBILITY_MOUSE_EVENT_DELAY = 800

export class TouchInputController {
  host: TouchControlsHost

  constructor(host: TouchControlsHost) {
    this.host = host
  }

  onTouchStart(evt: TouchEvent): void {
    const { host } = this
    if (host.isInteractionBlocked()) return
    this.deferCompatibilityMouseEvents()

    const touch = evt.touches[0]
    if (evt.touches.length >= 2) {
      host.touchInteraction = createTouchInteraction('ignore', touch)
      host.mouseDrag = false
      return
    }

    host.mouse.x = touch.pageX
    host.mouse.y = touch.pageY
    if (!host.isMouseInApp(touch)) return

    host.mouseDrag = false
    host.touchInteraction = createTouchInteraction(host.mouseBuilding || !IS_MOBILE ? 'tap' : 'select', touch)

    if (host.mouseBuilding) {
      this.updatePlacementPreview()
      return
    }

    if (!IS_MOBILE) host.onMouseDown(touch)
  }

  onTouchMove(evt: TouchEvent): void {
    const { host } = this
    if (host.isInteractionBlocked()) return

    const touch = evt.touches[0]
    host.mouse.x = touch.pageX
    host.mouse.y = touch.pageY

    if (host.touchInteraction?.mode === 'ignore') {
      return
    }

    if (host.mouseBuilding) {
      const interaction = host.touchInteraction
      const hasMoved =
        interaction &&
        pointsDistance(host.mouse.x, host.mouse.y, interaction.startX, interaction.startY) > TOUCH_DRAG_THRESHOLD
      if (hasMoved) {
        host.mouseDrag = true
        interaction.moved = true
      }
      this.updatePlacementPreview()
      return
    }

    if (!host.touchInteraction) {
      host.onMouseMove(touch)
      return
    }

    this.updateTouchInteractionMove(touch)
  }

  onTouchEnd(evt: TouchEvent): void {
    const { host } = this
    this.deferCompatibilityMouseEvents()
    const touch = evt.changedTouches[0]
    if (host.touchInteraction?.mode === 'ignore') {
      this.finishIgnoredTouch(evt)
      return
    }

    if (host.isInteractionBlocked()) {
      this.cancel()
      return
    }

    if (evt.changedTouches.length === 1) this.releaseSingleTouch(touch)
    this.cancel()
  }

  cancel(): void {
    const { host } = this

    host.mouseDrag = false
    host.touchInteraction = null
  }

  shouldIgnoreCompatibilityMouseEvent(evt: PointerPageEvent): boolean {
    return Boolean(evt?.type?.startsWith('mouse') && performance.now() < this.host.ignoreMouseEventsUntil)
  }

  private deferCompatibilityMouseEvents(): void {
    this.host.ignoreMouseEventsUntil = performance.now() + COMPATIBILITY_MOUSE_EVENT_DELAY
  }

  private updatePlacementPreview(): void {
    const { host } = this
    if (host.mouseBuilding) host.buildingPlacer.handleMouseMove()
  }

  private updateTouchInteractionMove(touch: PointerPageEvent): void {
    const { host } = this
    const interaction = host.touchInteraction
    if (!interaction) return

    const movedEnough =
      pointsDistance(host.mouse.x, host.mouse.y, interaction.startX, interaction.startY) > TOUCH_DRAG_THRESHOLD

    if (interaction.mode === 'select') {
      if (movedEnough) interaction.moved = true
      host.onMouseMove(touch)
    } else if (movedEnough) {
      interaction.moved = true
      host.mouseDrag = true
    }
  }

  private finishIgnoredTouch(evt: TouchEvent): void {
    const { host } = this
    host.mouseDrag = true
    if (evt.touches.length) {
      const remainingTouch = evt.touches[0]
      host.touchInteraction = createTouchInteraction('ignore', remainingTouch, true)
      return
    }
    this.cancel()
  }

  private releaseSingleTouch(touch: PointerPageEvent): void {
    const { host } = this
    const mode = host.touchInteraction?.mode
    const moved = host.touchInteraction?.moved

    if (host.mouseBuilding) {
      if (!moved) host.onMouseUp(touch)
    } else if (mode === 'select') {
      host.onMouseUp(touch)
    } else if (!moved) {
      host.onMouseUp(touch)
    }
  }
}

function createTouchInteraction(
  mode: TouchInteraction['mode'],
  touch: PointerPageEvent,
  moved = false
): TouchInteraction {
  return {
    mode,
    startX: touch.pageX,
    startY: touch.pageY,
    moved,
  }
}
