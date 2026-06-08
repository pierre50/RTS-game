import { isometricToCartesian } from '../lib'
import { LONG_CLICK_DURATION, IS_MOBILE, MINIMAP_DRAG_THRESHOLD } from '../constants'

export class MinimapInputController {
  constructor(menu) {
    this.menu = menu
    this.longClick = false
    this.mouseHoldTimeout = null
    this.pointerSession = null
  }

  bind() {
    const { menu } = this
    menu.bottombarMap.addEventListener('pointerdown', this.onPointerDown)
    menu.bottombarMap.addEventListener('pointermove', this.onPointerMove)
    menu.bottombarMap.addEventListener('pointerup', this.onPointerUp)
    menu.bottombarMap.addEventListener('pointercancel', this.onPointerCancel)

    menu.toggle = document.createElement('button')
    menu.toggle.type = 'button'
    menu.toggle.className = 'toggle ui-btn'
    menu.toggle.setAttribute('aria-label', 'Toggle bottom bar')
    menu.toggle.innerText = 'x'
    menu.toggle.addEventListener('pointerdown', this.onTogglePointerDown)
    if (IS_MOBILE) menu.gameHud.appendChild(menu.toggle)
  }

  onPointerDown = evt => {
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
    evt.currentTarget?.setPointerCapture?.(evt.pointerId)
    this.mouseHoldTimeout = setTimeout(() => {
      if (!this.pointerSession || this.pointerSession.dragging) return
      this.longClick = true
      this.moveCameraFromMinimap(evt, controls)
    }, LONG_CLICK_DURATION)
  }

  onPointerMove = evt => {
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
      clearTimeout(this.mouseHoldTimeout)
    }

    if (this.pointerSession.dragging || this.longClick) {
      this.longClick = true
      this.moveCameraFromMinimap(evt, controls)
    }
  }

  onPointerUp = evt => {
    const {
      menu: {
        context: { player, controls, map },
      },
    } = this
    clearTimeout(this.mouseHoldTimeout)
    if (!this.pointerSession || evt.pointerId !== this.pointerSession.id) return
    const wasDrag = this.pointerSession.dragging
    this.pointerSession = null
    evt.currentTarget?.releasePointerCapture?.(evt.pointerId)

    if (controls.mouseRectangle || wasDrag || this.longClick) {
      this.longClick = false
      return
    }
    this.longClick = false
    const { x, y } = this.getMinimapPointer(evt)

    if (controls.mouseBuilding) {
      controls.setCamera(x, y)
      return
    }

    if (player?.selectedUnits?.length) {
      const pos = isometricToCartesian(x, y)
      const i = Math.min(Math.max(pos[0], 0), map.size)
      const j = Math.min(Math.max(pos[1], 0), map.size)
      if (map.grid[i] && map.grid[i][j]) {
        controls.sendUnits(map.grid[i][j])
      }
    } else {
      controls.setCamera(x, y)
    }
  }

  onPointerCancel = () => {
    clearTimeout(this.mouseHoldTimeout)
    this.longClick = false
    this.pointerSession = null
  }

  onTogglePointerDown = evt => {
    evt.preventDefault()
    const { menu } = this
    menu.toggled = !menu.toggled
    menu.toggle.innerText = menu.toggled ? 'o' : 'x'
    menu.bottombar.classList.toggle('hidden', menu.toggled)
    evt.stopPropagation()
  }

  getMinimapPointer(evt) {
    const rect = evt.target.getBoundingClientRect()
    const minimapFactor = this.menu.minimapManager.getMinimapFactor()
    return {
      x: (evt.clientX - rect.left - rect.width / 2) * minimapFactor,
      y: (evt.clientY - rect.top - 3) * minimapFactor,
    }
  }

  moveCameraFromMinimap(evt, controls) {
    const { x, y } = this.getMinimapPointer(evt)
    controls.setCamera(x, y)
  }

  destroy() {
    clearTimeout(this.mouseHoldTimeout)
    this.menu.bottombarMap?.removeEventListener('pointerdown', this.onPointerDown)
    this.menu.bottombarMap?.removeEventListener('pointermove', this.onPointerMove)
    this.menu.bottombarMap?.removeEventListener('pointerup', this.onPointerUp)
    this.menu.bottombarMap?.removeEventListener('pointercancel', this.onPointerCancel)
    this.menu.toggle?.removeEventListener('pointerdown', this.onTogglePointerDown)
    this.menu.toggle?.remove()
  }
}
