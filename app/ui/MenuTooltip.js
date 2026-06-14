const LONG_PRESS_DELAY = 450
const VIEWPORT_MARGIN = 10
const TOOLTIP_GAP = 8

export class MenuTooltip {
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

  resolveContent(content) {
    return typeof content === 'function' ? content() : content
  }

  bind(element, content) {
    if (!content) return

    const show = () => {
      const resolved = this.resolveContent(content)
      if (!resolved) return
      element.setAttribute('aria-label', resolved.title)
      this.show(element, resolved)
    }
    const hide = () => {
      if (this.activeTarget === element) this.hide()
    }
    const onPointerDown = evt => {
      if (evt.pointerType === 'mouse') return
      this.clearLongPress()
      this.longPressTriggered = false
      this.longPressTimer = window.setTimeout(() => {
        this.longPressTriggered = true
        show()
      }, LONG_PRESS_DELAY)
    }
    const onPointerEnd = evt => {
      this.clearLongPress()
      if (!this.longPressTriggered) return
      evt.preventDefault()
      evt.stopImmediatePropagation()
      this.longPressTriggered = false
    }

    element.setAttribute('aria-describedby', this.element.id)
    element.addEventListener('pointerenter', show)
    element.addEventListener('pointerleave', hide)
    element.addEventListener('focus', show)
    element.addEventListener('blur', hide)
    element.addEventListener('pointerdown', onPointerDown)
    element.addEventListener('pointerup', onPointerEnd)
    element.addEventListener('pointercancel', onPointerEnd)
  }

  show(target, { title, description, meta = [] }) {
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

  position(target) {
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

  hide() {
    this.activeTarget = null
    this.element.hidden = true
  }

  clearLongPress() {
    if (this.longPressTimer !== null) {
      window.clearTimeout(this.longPressTimer)
      this.longPressTimer = null
    }
  }

  onDocumentPointerDown(evt) {
    if (this.activeTarget && !this.activeTarget.contains(evt.target)) {
      this.hide()
    }
  }

  destroy() {
    this.clearLongPress()
    document.removeEventListener('pointerdown', this.onDocumentPointerDown)
    this.element.remove()
  }
}
