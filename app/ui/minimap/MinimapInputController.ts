import { LONG_CLICK_DURATION, MINIMAP_DRAG_THRESHOLD } from '../../constants'
import type { ControlsLike, MinimapHostLike } from '../../types/context'

type PointerSession = {
  id: number
  startX: number
  startY: number
  dragging: boolean
}

export class MinimapInputController {
  menu: MinimapHostLike
  longClick: boolean
  mouseHoldTimeout: ReturnType<typeof setTimeout> | null
  pointerSession: PointerSession | null

  constructor(menu: MinimapHostLike) {
    this.menu = menu
    this.longClick = false
    this.mouseHoldTimeout = null
    this.pointerSession = null
  }

  getElement(): HTMLDivElement {
    const element = this.menu.minimapMap
    if (!element) throw new Error('Minimap host is missing a minimap element')
    return element
  }

  bind(): void {
    const minimap = this.getElement()
    minimap.addEventListener('pointerdown', this.onPointerDown)
    minimap.addEventListener('pointermove', this.onPointerMove)
    minimap.addEventListener('pointerup', this.onPointerUp)
    minimap.addEventListener('pointercancel', this.onPointerCancel)
  }

  onPointerDown = (evt: PointerEvent): void => {
    const {
      menu: {
        context: { controls },
      },
    } = this
    this.pointerSession = {
      id: evt.pointerId,
      startX: evt.clientX,
      startY: evt.clientY,
      dragging: false,
    }
    ;(evt.currentTarget as Element | null)?.setPointerCapture?.(evt.pointerId)
    this.mouseHoldTimeout = setTimeout(() => {
      if (!this.pointerSession || this.pointerSession.dragging) return
      this.longClick = true
      this.moveCameraFromMinimap(evt, controls)
    }, LONG_CLICK_DURATION)
  }

  onPointerMove = (evt: PointerEvent): void => {
    const {
      menu: {
        context: { controls },
      },
    } = this
    if (!this.pointerSession || evt.pointerId !== this.pointerSession.id) return

    const movedX = Math.abs(evt.clientX - this.pointerSession.startX)
    const movedY = Math.abs(evt.clientY - this.pointerSession.startY)
    if (!this.pointerSession.dragging && Math.max(movedX, movedY) >= MINIMAP_DRAG_THRESHOLD) {
      this.pointerSession.dragging = true
      clearTimeout(this.mouseHoldTimeout ?? undefined)
    }

    if (this.pointerSession.dragging || this.longClick) {
      this.longClick = true
      this.moveCameraFromMinimap(evt, controls)
    }
  }

  onPointerUp = (evt: PointerEvent): void => {
    const {
      menu: {
        context: { controls },
      },
    } = this
    clearTimeout(this.mouseHoldTimeout ?? undefined)
    if (!this.pointerSession || evt.pointerId !== this.pointerSession.id) return
    const wasDrag = this.pointerSession.dragging
    this.pointerSession = null
    ;(evt.currentTarget as Element | null)?.releasePointerCapture?.(evt.pointerId)

    if (wasDrag || this.longClick) {
      this.longClick = false
      return
    }
    this.longClick = false
    if (!this.canMoveCamera(controls)) return
    const { x, y } = this.getMinimapPointer(evt)

    if (controls.mouseBuilding) {
      controls.setCamera?.(x, y)
      return
    }

    controls.setCamera?.(x, y)
  }

  onPointerCancel = (): void => {
    clearTimeout(this.mouseHoldTimeout ?? undefined)
    this.longClick = false
    this.pointerSession = null
  }

  getMinimapPointer(evt: PointerEvent): { x: number; y: number } {
    const rect = (evt.target as HTMLElement).getBoundingClientRect()
    const minimapFactor = this.menu.minimapManager.getMinimapFactor()
    return {
      x: (evt.clientX - rect.left - rect.width / 2) * minimapFactor,
      y: (evt.clientY - rect.top - 3) * minimapFactor,
    }
  }

  moveCameraFromMinimap(evt: PointerEvent, controls: ControlsLike): void {
    if (!this.canMoveCamera(controls)) return
    const { x, y } = this.getMinimapPointer(evt)
    controls.setCamera?.(x, y)
  }

  canMoveCamera(controls: ControlsLike): boolean {
    return Boolean(controls.freeCameraActive || this.menu.editorPanelMap)
  }

  destroy(): void {
    clearTimeout(this.mouseHoldTimeout ?? undefined)
    const minimap = this.menu.minimapMap
    minimap?.removeEventListener('pointerdown', this.onPointerDown)
    minimap?.removeEventListener('pointermove', this.onPointerMove)
    minimap?.removeEventListener('pointerup', this.onPointerUp)
    minimap?.removeEventListener('pointercancel', this.onPointerCancel)
  }
}
