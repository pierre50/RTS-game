import { pointsDistance } from '../lib'
import { IS_MOBILE, TOUCH_DRAG_THRESHOLD } from '../constants'
import type { ControlPointerEvent } from '../types/context'

type PointerPoint = { x: number; y: number }
type PointerPageEvent = ControlPointerEvent & {
  pageX: number
  pageY: number
  button?: number
  ctrlKey?: boolean
  preventDefault?: () => void
}

export type TouchInteraction = {
  mode: 'pan' | 'tap' | 'select'
  startX: number
  startY: number
  lastX: number
  lastY: number
  moved: boolean
}

type TouchControlsHost = {
  mouse: { x: number; y: number; prevent: boolean }
  mouseBuilding: unknown
  mouseTouch: PointerPoint | null | undefined
  mouseDrag: boolean
  touchInteraction: TouchInteraction | null
  touchPanActive: boolean
  ignoreMouseEventsUntil: number
  rallyPointController: { active?: boolean; handleMouseMove?: () => void }
  buildingPlacer: { handleMouseMove: () => void }
  isInteractionBlocked(): boolean
  isMouseInApp(evt: PointerPageEvent): boolean
  moveCamera(dir: string, moveSpeed: number, isSpeedDivided: boolean, deltaScale?: number): void
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
      host.touchInteraction = createTouchInteraction('pan', touch)
      host.touchPanActive = true
      host.mouseDrag = false
      host.mouseTouch = { x: touch.pageX, y: touch.pageY }
      return
    }

    host.mouse.x = touch.pageX
    host.mouse.y = touch.pageY
    if (!host.isMouseInApp(touch)) return

    host.mouseDrag = false
    host.touchInteraction = createTouchInteraction(
      host.mouseBuilding || host.rallyPointController.active || !IS_MOBILE ? 'tap' : 'select',
      touch
    )

    if (host.mouseBuilding || host.rallyPointController.active) {
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

    if (host.touchPanActive) {
      this.panFromPreviousTouch()
      host.mouseTouch = { x: host.mouse.x, y: host.mouse.y }
      return
    }

    if (host.mouseBuilding || host.rallyPointController.active) {
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
    if (host.touchPanActive || host.touchInteraction?.mode === 'pan') {
      this.finishPanTouch(evt)
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
    host.mouseTouch = null
    host.mouseDrag = false
    host.touchInteraction = null
    host.touchPanActive = false
  }

  shouldIgnoreCompatibilityMouseEvent(evt: PointerPageEvent): boolean {
    return Boolean(evt?.type?.startsWith('mouse') && performance.now() < this.host.ignoreMouseEventsUntil)
  }

  private deferCompatibilityMouseEvents(): void {
    this.host.ignoreMouseEventsUntil = performance.now() + COMPATIBILITY_MOUSE_EVENT_DELAY
  }

  private updatePlacementPreview(): void {
    const { host } = this
    host.mouseBuilding ? host.buildingPlacer.handleMouseMove() : host.rallyPointController.handleMouseMove?.()
  }

  private panFromPreviousTouch(): void {
    const { host } = this
    if (!host.mouseTouch) return
    const speedX = Math.abs(host.mouse.x - host.mouseTouch.x) * 2
    const speedY = Math.abs(host.mouse.y - host.mouseTouch.y) * 2
    if (host.mouse.x > host.mouseTouch.x) host.moveCamera('left', speedX, false)
    if (host.mouse.y > host.mouseTouch.y) host.moveCamera('up', speedY, false)
    if (host.mouse.y < host.mouseTouch.y) host.moveCamera('down', speedY, false)
    if (host.mouse.x < host.mouseTouch.x) host.moveCamera('right', speedX, false)
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
      const speedX = Math.abs(host.mouse.x - interaction.lastX) * 2
      const speedY = Math.abs(host.mouse.y - interaction.lastY) * 2
      if (host.mouse.x > interaction.lastX) host.moveCamera('left', speedX, false)
      if (host.mouse.y > interaction.lastY) host.moveCamera('up', speedY, false)
      if (host.mouse.y < interaction.lastY) host.moveCamera('down', speedY, false)
      if (host.mouse.x < interaction.lastX) host.moveCamera('right', speedX, false)
    }

    interaction.lastX = host.mouse.x
    interaction.lastY = host.mouse.y
  }

  private finishPanTouch(evt: TouchEvent): void {
    const { host } = this
    host.mouseDrag = true
    if (evt.touches.length) {
      const remainingTouch = evt.touches[0]
      host.mouseTouch = { x: remainingTouch.pageX, y: remainingTouch.pageY }
      host.touchInteraction = createTouchInteraction('pan', remainingTouch, true)
      return
    }
    this.cancel()
  }

  private releaseSingleTouch(touch: PointerPageEvent): void {
    const { host } = this
    const mode = host.touchInteraction?.mode
    const moved = host.touchInteraction?.moved

    if (host.mouseBuilding || host.rallyPointController.active) {
      if (!moved) host.onMouseUp(touch)
    } else if (mode === 'select') {
      host.onMouseUp(touch)
    } else if (!moved) {
      host.onMouseUp(touch)
    }
  }
}

function createTouchInteraction(mode: TouchInteraction['mode'], touch: PointerPageEvent, moved = false): TouchInteraction {
  return {
    mode,
    startX: touch.pageX,
    startY: touch.pageY,
    lastX: touch.pageX,
    lastY: touch.pageY,
    moved,
  }
}
