import { isometricToCartesian } from '../lib'
import { LONG_CLICK_DURATION, IS_MOBILE } from '../constants'

export class MinimapInputController {
  constructor(menu) {
    this.menu = menu
    this.longClick = false
    this.mouseHoldTimeout = null
  }

  bind() {
    const { menu } = this
    menu.bottombarMap.addEventListener('pointerdown', this.onPointerDown)
    menu.bottombarMap.addEventListener('pointerup', this.onPointerUp)

    menu.toggle = document.createElement('div')
    menu.toggle.className = 'toggle'
    menu.toggle.innerText = 'x'
    menu.toggle.addEventListener('pointerdown', this.onTogglePointerDown)
    if (IS_MOBILE) document.body.prepend(menu.toggle)
  }

  onPointerDown = evt => {
    const {
      menu,
      menu: {
        context: { controls },
      },
    } = this
    this.mouseHoldTimeout = setTimeout(() => {
      this.longClick = true
      const { x, y } = this.getMinimapPointer(evt)
      controls.setCamera(x, y)
    }, LONG_CLICK_DURATION)
  }

  onPointerUp = evt => {
    const {
      menu,
      menu: {
        context: { player, controls, map },
      },
    } = this
    clearTimeout(this.mouseHoldTimeout)
    if (controls.mouseBuilding || controls.mouseRectangle || this.longClick) {
      this.longClick = false
      return
    }
    this.longClick = false
    const { x, y } = this.getMinimapPointer(evt)

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

  destroy() {
    clearTimeout(this.mouseHoldTimeout)
    this.menu.bottombarMap?.removeEventListener('pointerdown', this.onPointerDown)
    this.menu.bottombarMap?.removeEventListener('pointerup', this.onPointerUp)
    this.menu.toggle?.removeEventListener('pointerdown', this.onTogglePointerDown)
    this.menu.toggle?.remove()
  }
}
