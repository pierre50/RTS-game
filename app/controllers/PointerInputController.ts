import { setVirtualCursorVisible } from '../lib/hero/heroCursor'
import type { ControlPointerEvent, GameContextLike } from '../types/context'
import type { RuntimeCell } from '../types/map'

export type PointerPageEvent = ControlPointerEvent & {
  pageX: number
  pageY: number
  button?: number
  ctrlKey?: boolean
  preventDefault?: () => void
}

type PointerControlsHost = {
  context: GameContextLike
  mouse: { x: number; y: number; prevent: boolean }
  mouseBuilding: unknown
  mouseDrag: boolean
  mouseHoldTimeout: ReturnType<typeof setTimeout> | undefined
  suppressContextMenuUntil: number
  heroController: {
    handlePointerUp(button: number): void
    handlePrimaryPointerDown(): void
    handleSecondaryPointerDown(): void
    cycleTool(delta: number): boolean
  }
  rallyPointController: {
    active?: boolean
    handleMouseMove?: () => void
    handleMouseUp?: (cell: RuntimeCell) => void
  }
  buildingPlacer: {
    handleMouseMove(): void
    handleMouseUp(cell: RuntimeCell): void
  }
  isEditableTarget(target: EventTarget | null): boolean
  isInteractionBlocked(): boolean
  isHeroControlActive(): boolean
  cancelActiveInteraction(): void
  screenToLocal(x: number, y: number): { x: number; y: number }
  getCellUnderCursor(): RuntimeCell | null
  shouldIgnoreCompatibilityMouseEvent(evt: PointerPageEvent): boolean
  stopKeyboardMove(): void
}

export class PointerInputController {
  host: PointerControlsHost

  constructor(host: PointerControlsHost) {
    this.host = host
  }

  onMouseDown(evt: PointerPageEvent): void {
    const { host } = this
    if (host.shouldIgnoreCompatibilityMouseEvent(evt)) return
    if (host.isInteractionBlocked()) return
    if (evt.altKey) host.stopKeyboardMove()

    this.updateMousePosition(evt)
    setVirtualCursorVisible(false)
    if (!this.isMouseInApp(evt)) return

    if (host.mouseBuilding || host.rallyPointController.active) {
      host.mouse.prevent = false
      this.updatePlacementPreview()
      return
    }

    if (host.isHeroControlActive() && isSecondaryPointerButton(evt)) {
      evt.preventDefault?.()
      host.heroController.handleSecondaryPointerDown()
      host.mouse.prevent = true
      return
    }

    if (host.isHeroControlActive() && evt.button === 0) {
      evt.preventDefault?.()
      host.heroController.handlePrimaryPointerDown()
      host.mouse.prevent = true
    }
  }

  onMouseMove(evt: PointerPageEvent): void {
    const { host } = this
    if (host.shouldIgnoreCompatibilityMouseEvent(evt)) return
    this.updateMousePosition(evt)
    setVirtualCursorVisible(false)

    if (host.isInteractionBlocked()) return
    if (host.mouseBuilding || host.rallyPointController.active) this.updatePlacementPreview()
  }

  onWheel(evt: WheelEvent): void {
    const { host } = this
    if (host.isEditableTarget(evt.target)) return
    if (host.isInteractionBlocked() || !host.isHeroControlActive() || this.isInGameMenuOpen()) return

    this.updateMousePosition(evt)
    setVirtualCursorVisible(false)
    if (!this.isMouseInApp(evt)) return

    const delta = evt.deltaY || evt.deltaX
    if (delta === 0) return

    if (host.heroController.cycleTool(delta > 0 ? 1 : -1)) {
      evt.preventDefault()
      evt.stopPropagation()
    }
  }

  onContextMenu(evt: MouseEvent): void {
    const { host } = this
    const shouldSuppress =
      performance.now() < host.suppressContextMenuUntil ||
      (host.isHeroControlActive() && (this.isMouseInApp(evt) || Boolean(document.querySelector?.('.modal'))))
    if (!shouldSuppress) return
    evt.preventDefault()
    evt.stopPropagation()
    evt.stopImmediatePropagation?.()
  }

  onMouseUp(evt: PointerPageEvent): void {
    const { host } = this
    if (host.shouldIgnoreCompatibilityMouseEvent(evt)) return
    host.heroController.handlePointerUp(isSecondaryPointerButton(evt) ? 2 : (evt.button ?? 0))
    if (host.isInteractionBlocked()) {
      host.cancelActiveInteraction()
      return
    }

    this.updateMousePosition(evt)
    setVirtualCursorVisible(false)
    clearTimeout(host.mouseHoldTimeout)
    if (!this.isMouseInApp(evt)) {
      host.mouse.prevent = false
      return
    }
    if (host.mouse.prevent || host.mouseDrag) {
      host.mouse.prevent = false
      return
    }
    if (!host.rallyPointController.active) {
      !host.isHeroControlActive() && host.context.player?.selectedBuilding && host.context.player.unselectAll()
    }

    const cell = this.getCellUnderPointer()
    if (!cell) return
    if (host.mouseBuilding) {
      host.buildingPlacer.handleMouseUp(cell)
    } else if (host.rallyPointController.active) {
      host.rallyPointController.handleMouseUp?.(cell)
    }
  }

  isMouseInApp(evt: PointerPageEvent): boolean {
    const { host } = this
    if (host.isInteractionBlocked()) return false

    const target = evt.target instanceof Element ? evt.target : evt.nativeEvent?.target
    if (target instanceof Element) return !target.tagName || Boolean(target.closest('#game'))

    const clientX = evt.clientX ?? evt.nativeEvent?.clientX
    const clientY = evt.clientY ?? evt.nativeEvent?.clientY
    if (typeof clientX === 'number' && typeof clientY === 'number') {
      const rect = host.context.gamebox.getBoundingClientRect()
      return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom
    }

    return false
  }

  private isInGameMenuOpen(): boolean {
    const menu = this.host.context.menu
    return Boolean(
      this.host.context.devConsoleOpen ||
        this.host.context.paused ||
        this.host.context.defeat ||
        this.host.context.timeSkip?.active ||
        menu?.isInventoryOpen?.() ||
        menu?.isNpcOrdersOpen?.() ||
        menu?.isHeroBuildingMenuOpen?.() ||
        document.querySelector?.('.modal')
    )
  }

  private updateMousePosition(evt: PointerPageEvent): void {
    this.host.mouse.x = evt.pageX
    this.host.mouse.y = evt.pageY
  }

  private updatePlacementPreview(): void {
    const { host } = this
    host.mouseBuilding ? host.buildingPlacer.handleMouseMove() : host.rallyPointController.handleMouseMove?.()
  }

  private getCellUnderPointer(): RuntimeCell | null {
    return this.host.getCellUnderCursor()
  }
}

function isSecondaryPointerButton(evt: { button?: number; ctrlKey?: boolean }): boolean {
  return evt.button === 2
}
