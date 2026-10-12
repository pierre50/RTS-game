import { getActiveGamepad } from '../../lib/input/gamepad'
import { getConsumedGamepadButtons } from '../../lib/input/gamepadConsumption'
import { t } from '../../lib/lang'
import { getGamepadGlyph } from '../../lib/input/gamepadGlyph'
import { Modal } from '../../lib/ui/Modal'
import { registerWindowInteraction } from '../../lib/ui/GameWindowInteraction'
import type { Command } from '../../lib/ui/GameWindowCommands'
import type { MenuHost } from '../MenuHost'
import { renderMinimapLegend } from './MinimapLegend'
import { teleportHeroFromMinimap } from './MinimapTeleport'
import { changeMinimapZoom, getMinimapZoom, setMinimapZoom } from './MinimapZoom'

/** Inventory map navigation owns no global listeners or independent gamepad loop. */
export class MinimapNavigation {
  private drag?: { id: number; x: number; y: number; startX: number; startY: number; moved: boolean }
  private readonly cursor = document.createElement('div')
  private readonly status = document.createElement('div')
  private readonly zoom = document.createElement('output')
  private readonly hint = document.createElement('p')
  private zoomTimer?: ReturnType<typeof setTimeout>
  private wheelAt = 0
  private frame = 0
  private panX = 0
  private panY = 0
  private dirty = false
  private blockedTriggers = new Set<number>()
  private popup?: Modal

  constructor(
    private readonly menu: MenuHost,
    private readonly panel: HTMLElement,
    private readonly refreshLegend: () => void
  ) {
    this.cursor.className = 'minimap-cursor'
    this.cursor.setAttribute('aria-hidden', 'true')
    this.status.className = 'minimap-location-status'
    this.status.setAttribute('aria-live', 'polite')
    this.zoom.className = 'minimap-zoom-status'
    this.zoom.hidden = true
    menu.minimapWrap.append(this.cursor, this.zoom)
    const hint = this.hint
    hint.className = 'minimap-navigation-hint'
    for (const mode of ['keyboard', 'gamepad'] as const) {
      const text = document.createElement('span')
      text.className = `minimap-hint-${mode}`
      text.textContent = t(mode === 'keyboard' ? 'minimapKeyboardHelp' : 'minimapGamepadHelp')
      hint.appendChild(text)
    }
    menu.minimapWrap.parentElement?.append(this.status, hint)
    registerWindowInteraction(panel, {
      commands: () => this.commands(),
      move: (dx, dy) => this.pan(dx * 0.06, dy * 0.06),
      gamepad: (pad, elapsed) => this.gamepad(pad, elapsed),
    })
    menu.minimapWrap.addEventListener('pointerdown', this.pointerDown)
    menu.minimapWrap.addEventListener('pointermove', this.pointerMove)
    menu.minimapWrap.addEventListener('pointerup', this.pointerUp)
    menu.minimapWrap.addEventListener('pointercancel', this.cancelDrag)
    menu.minimapWrap.addEventListener('lostpointercapture', this.cancelDrag)
    menu.minimapWrap.addEventListener('wheel', this.wheel, { passive: false })
  }

  private commands(): Command[] {
    const command = (id: string, label: string, key: string, pad: number, run: () => void): Command => ({
      id,
      label: t(label),
      key,
      pad,
      glyph: getGamepadGlyph(pad),
      run,
    })
    return [
      {
        ...command('map-zoom-out', 'minimapZoomOut', '-', 6, () => this.stepZoom(-1)),
        disabled: getMinimapZoom(this.menu.context) <= 1,
        continuous: true,
      },
      {
        ...command('map-zoom-in', 'minimapZoomIn', '+', 7, () => this.stepZoom(1)),
        disabled: getMinimapZoom(this.menu.context) >= 4,
        continuous: true,
      },
      command('map-fast-travel', 'minimapFastTravel', 'Enter', 0, () => this.fastTravel()),
      command('map-recenter', 'minimapRecenter', 'R', 3, () => {
        this.panel.scrollTop = 0
        this.menu.minimapManager?.recenter?.()
        this.updateStatus()
      }),
      command('map-filters', 'minimapFilters', 'F', 2, () => this.filters()),
    ]
  }

  private rect(): DOMRect {
    return (this.menu.minimapWrap.querySelector('.minimap-map') ?? this.menu.minimapWrap).getBoundingClientRect()
  }

  private place(x?: number, y?: number) {
    const rect = this.rect()
    return this.menu.minimapManager?.getPlaceAt?.(x ?? rect.left + rect.width / 2, y ?? rect.top + rect.height / 2)
  }

  private updateStatus(): void {
    const place = this.place()
    const text = place ? [place.name, place.description].filter(Boolean).join(' · ') : t('minimapExplore')
    if (this.status.textContent !== text) this.status.textContent = text
    this.panel.dispatchEvent(new Event('windowinteractionchange', { bubbles: true }))
  }

  private fastTravel(x?: number, y?: number): void {
    const rect = this.rect()
    const minimapManager = this.menu.minimapManager
    if (!minimapManager) return
    const point = minimapManager.getMinimapWorldPoint?.(
      x ?? rect.left + rect.width / 2,
      y ?? rect.top + rect.height / 2,
      rect
    )
    if (point) teleportHeroFromMinimap({ context: this.menu.context, minimapManager }, point)
  }

  private filters(): void {
    if (this.popup) return
    const content = document.createElement('div')
    content.className = 'minimap-filter-panel'
    const symbols = document.createElement('div')
    symbols.className = 'minimap-shape-legend'
    renderMinimapLegend(content, this.menu, symbols)
    this.popup = new Modal({
      gameWindow: true,
      content,
      onClose: () => {
        this.popup = undefined
        this.refreshLegend()
        this.updateStatus()
      },
    })
  }

  private pan(dx: number, dy: number): void {
    if (!dx && !dy) return
    this.panX += dx
    this.panY += dy
    this.queueDraw()
  }

  private queueDraw(): void {
    if (this.frame) return
    this.frame = requestAnimationFrame(() => {
      this.frame = 0
      if (this.panX || this.panY) this.menu.minimapManager?.pan?.(this.panX, this.panY)
      else if (this.dirty) this.menu.minimapManager?.refreshMiniMap?.()
      this.panX = this.panY = 0
      this.dirty = false
      this.updateStatus()
    })
  }

  private zoomChanged(): void {
    this.dirty = true
    this.zoom.textContent = `${Math.round(getMinimapZoom(this.menu.context) * 100)} %`
    this.zoom.hidden = false
    clearTimeout(this.zoomTimer)
    this.zoomTimer = setTimeout(() => {
      this.zoom.hidden = true
    }, 1000)
    this.queueDraw()
  }

  private stepZoom(direction: -1 | 1): void {
    changeMinimapZoom(this.menu.context, direction)
    this.zoomChanged()
  }

  private gamepad(pad: Gamepad, elapsed: number): void {
    const axis = (value: number) => (Math.abs(value) <= 0.2 ? 0 : (Math.sign(value) * (Math.abs(value) - 0.2)) / 0.8)
    const dx = pad.buttons[14]?.pressed ? -1 : pad.buttons[15]?.pressed ? 1 : axis(pad.axes[0] ?? 0)
    const dy = pad.buttons[12]?.pressed ? -1 : pad.buttons[13]?.pressed ? 1 : axis(pad.axes[1] ?? 0)
    this.pan((dx * elapsed) / 1500, (dy * elapsed) / 1500)
    const scroll = axis(pad.axes[3] ?? 0)
    if (scroll) this.panel.scrollTop += scroll * elapsed * 0.6
    const consumed = getConsumedGamepadButtons(pad)
    const trigger = (index: number) => {
      const value = pad.buttons[index]?.value ?? 0
      if (value <= 0.2) this.blockedTriggers.delete(index)
      return this.blockedTriggers.has(index) || consumed.has(index) ? 0 : axis(value)
    }
    const amount = trigger(7) - trigger(6)
    if (amount) {
      const previous = getMinimapZoom(this.menu.context)
      const next = setMinimapZoom(this.menu.context, previous + (amount * elapsed) / 750)
      if (next !== previous) this.zoomChanged()
    }
  }

  private pointerDown = (event: PointerEvent): void => {
    if (event.button !== 0 || this.drag) return
    this.drag = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
    }
    this.menu.minimapWrap.setPointerCapture(event.pointerId)
    event.preventDefault()
  }
  private pointerMove = (event: PointerEvent): void => {
    const drag = this.drag
    if (!drag || drag.id !== event.pointerId) return
    drag.moved ||= Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) >= 5
    if (!drag.moved) return
    const rect = this.rect()
    this.pan((drag.x - event.clientX) / Math.max(1, rect.width), (drag.y - event.clientY) / Math.max(1, rect.height))
    drag.x = event.clientX
    drag.y = event.clientY
  }
  private pointerUp = (event: PointerEvent): void => {
    if (!this.drag || this.drag.id !== event.pointerId) return
    const moved = this.drag.moved
    this.cancelDrag()
    this.menu.minimapWrap.releasePointerCapture(event.pointerId)
    if (!moved) this.fastTravel(event.clientX, event.clientY)
  }
  private cancelDrag = (): void => {
    this.drag = undefined
  }
  private wheel = (event: WheelEvent): void => {
    event.preventDefault()
    if (!event.deltaY || performance.now() - this.wheelAt < 80) return
    this.wheelAt = performance.now()
    this.stepZoom(event.deltaY < 0 ? 1 : -1)
  }

  activate(): void {
    const pad = getActiveGamepad()
    this.blockedTriggers = new Set([6, 7].filter(index => (pad?.buttons[index]?.value ?? 0) > 0.2))
    this.updateStatus()
  }

  deactivate(): void {
    cancelAnimationFrame(this.frame)
    this.frame = this.panX = this.panY = 0
    this.dirty = false
    if (this.drag && this.menu.minimapWrap.hasPointerCapture(this.drag.id))
      this.menu.minimapWrap.releasePointerCapture(this.drag.id)
    this.cancelDrag()
    clearTimeout(this.zoomTimer)
    this.zoom.hidden = true
    this.popup?.close()
    this.popup = undefined
  }
  destroy(): void {
    this.deactivate()
    const wrap = this.menu.minimapWrap
    wrap.removeEventListener('pointerdown', this.pointerDown)
    wrap.removeEventListener('pointermove', this.pointerMove)
    wrap.removeEventListener('pointerup', this.pointerUp)
    wrap.removeEventListener('pointercancel', this.cancelDrag)
    wrap.removeEventListener('lostpointercapture', this.cancelDrag)
    wrap.removeEventListener('wheel', this.wheel)
    for (const element of [this.cursor, this.status, this.zoom, this.hint]) element.remove()
  }
}
