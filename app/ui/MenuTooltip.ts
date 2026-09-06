import type { TooltipContent, TooltipSource } from '../types/ui'

const LONG_PRESS_DELAY = 450
const VIEWPORT_MARGIN = 10
const TOOLTIP_GAP = 8

export class MenuTooltip {
  element: HTMLDivElement
  activeTarget: HTMLElement | null
  longPressTimer: number | null
  longPressTriggered: boolean

  constructor() {
    this.element = document.createElement('div')
    this.element.id = 'menu-tooltip'
    this.element.className = 'menu-tooltip'
    this.element.setAttribute('role', 'tooltip')
    this.element.hidden = true
    document.body.appendChild(this.element)

    this.activeTarget = null
    this.longPressTimer = null
    this.longPressTriggered = false
    this.onDocumentPointerDown = this.onDocumentPointerDown.bind(this)
    document.addEventListener('pointerdown', this.onDocumentPointerDown)
  }

  resolveContent(content: TooltipSource): TooltipContent {
    return typeof content === 'function' ? content() : content
  }

  getDisabledTooltipHost(element: HTMLElement): HTMLElement {
    if (!('disabled' in element) || !(element as HTMLButtonElement).disabled) return element

    const existingHost = element.parentElement?.classList.contains('menu-tooltip-hitbox') ? element.parentElement : null
    if (existingHost) return existingHost

    const host = document.createElement('span')
    host.className = 'menu-tooltip-hitbox'

    const wrap = () => {
      const parent = element.parentElement
      if (!parent || parent.classList.contains('menu-tooltip-hitbox')) return
      parent.insertBefore(host, element)
      host.appendChild(element)
    }

    wrap()
    if (!element.parentElement || element.parentElement !== host) window.queueMicrotask(wrap)
    return host
  }

  bind(element: HTMLElement, content: TooltipSource): void {
    if (!content) return
    const target = this.getDisabledTooltipHost(element)

    const show = () => {
      const resolved = this.resolveContent(content)
      if (!resolved) return
      element.setAttribute('aria-label', resolved.title)
      this.show(target, resolved)
    }
    const hide = () => {
      if (this.activeTarget === target) this.hide()
    }
    const onPointerDown = (evt: PointerEvent) => {
      if (evt.pointerType === 'mouse') return
      this.clearLongPress()
      this.longPressTriggered = false
      this.longPressTimer = window.setTimeout(() => {
        this.longPressTriggered = true
        show()
      }, LONG_PRESS_DELAY)
    }
    const onPointerEnd = (evt: PointerEvent) => {
      this.clearLongPress()
      if (!this.longPressTriggered) return
      evt.preventDefault()
      evt.stopImmediatePropagation()
      this.longPressTriggered = false
    }

    element.setAttribute('aria-describedby', this.element.id)
    target.addEventListener('pointerenter', show)
    target.addEventListener('pointerleave', hide)
    target.addEventListener('focus', show)
    target.addEventListener('blur', hide)
    target.addEventListener('pointerdown', onPointerDown)
    target.addEventListener('pointerup', onPointerEnd)
    target.addEventListener('pointercancel', onPointerEnd)
  }

  show(target: HTMLElement, { title, description, meta = [] }: TooltipContent): void {
    this.activeTarget = target
    this.element.textContent = ''

    const titleElement = document.createElement('div')
    titleElement.className = 'menu-tooltip-title'
    titleElement.textContent = title
    this.element.appendChild(titleElement)

    if (description) {
      const descriptionElement = document.createElement('div')
      descriptionElement.className = 'menu-tooltip-description'
      descriptionElement.textContent = description
      this.element.appendChild(descriptionElement)
    }

    const visibleMeta = meta.filter(Boolean)
    if (visibleMeta.length) {
      const metaElement = document.createElement('div')
      metaElement.className = 'menu-tooltip-meta'
      metaElement.textContent = visibleMeta.join(' | ')
      this.element.appendChild(metaElement)
    }

    this.element.hidden = false
    this.position(target)
  }

  position(target: HTMLElement): void {
    const targetRect = target.getBoundingClientRect()
    const tooltipRect = this.element.getBoundingClientRect()
    let left = targetRect.left + targetRect.width / 2 - tooltipRect.width / 2
    left = Math.max(VIEWPORT_MARGIN, Math.min(left, window.innerWidth - tooltipRect.width - VIEWPORT_MARGIN))

    let top = targetRect.top - tooltipRect.height - TOOLTIP_GAP
    if (top < VIEWPORT_MARGIN) {
      top = targetRect.bottom + TOOLTIP_GAP
    }

    this.element.style.left = `${Math.round(left)}px`
    this.element.style.top = `${Math.round(top)}px`
  }

  hide(): void {
    this.activeTarget = null
    this.element.hidden = true
  }

  clearLongPress(): void {
    if (this.longPressTimer !== null) {
      window.clearTimeout(this.longPressTimer)
      this.longPressTimer = null
    }
  }

  onDocumentPointerDown(evt: PointerEvent): void {
    if (this.activeTarget && !this.activeTarget.contains(evt.target as Node)) {
      this.hide()
    }
  }

  destroy(): void {
    this.clearLongPress()
    document.removeEventListener('pointerdown', this.onDocumentPointerDown)
    this.element.remove()
  }
}
