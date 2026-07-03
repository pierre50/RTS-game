import { LANG_CHANGE_EVENT, t } from '../lib/lang'

function isMobileDevice(): boolean {
  return window.matchMedia('(pointer: coarse)').matches || window.innerWidth <= 800
}

function isPortraitMobile(): boolean {
  return isMobileDevice() && window.matchMedia('(orientation: portrait)').matches
}

export class OrientationGuard {
  onChange?: (blocked: boolean) => void
  blocked: boolean
  el: HTMLDivElement
  _onViewportChange: () => void
  _onLangChange: () => void
  titleEl!: HTMLDivElement
  bodyEl!: HTMLDivElement

  constructor({ onChange }: { onChange?: (blocked: boolean) => void } = {}) {
    this.onChange = onChange
    this.blocked = false
    this.el = this.build()
    this._onViewportChange = () => this.sync()
    this._onLangChange = () => this.renderText()

    window.addEventListener('resize', this._onViewportChange)
    window.addEventListener('orientationchange', this._onViewportChange)
    window.addEventListener(LANG_CHANGE_EVENT, this._onLangChange)

    this.sync()
  }

  build(): HTMLDivElement {
    const overlay = document.createElement('div')
    overlay.className = 'orientation-guard hidden'

    const panel = document.createElement('div')
    panel.className = 'orientation-guard-panel'

    const icon = document.createElement('div')
    icon.className = 'orientation-guard-icon'
    icon.setAttribute('aria-hidden', 'true')
    icon.textContent = '↻'

    this.titleEl = document.createElement('div')
    this.titleEl.className = 'orientation-guard-title'

    this.bodyEl = document.createElement('div')
    this.bodyEl.className = 'orientation-guard-body'

    panel.appendChild(icon)
    panel.appendChild(this.titleEl)
    panel.appendChild(this.bodyEl)
    overlay.appendChild(panel)
    document.body.appendChild(overlay)

    this.renderText()
    return overlay
  }

  renderText(): void {
    this.titleEl.textContent = t('rotateDeviceTitle')
    this.bodyEl.textContent = t('rotateDeviceBody')
  }

  sync(): void {
    const nextBlocked = isPortraitMobile()
    if (nextBlocked === this.blocked) {
      this.el.classList.toggle('hidden', !nextBlocked)
      document.body.classList.toggle('orientation-locked', nextBlocked)
      return
    }

    this.blocked = nextBlocked
    this.el.classList.toggle('hidden', !nextBlocked)
    document.body.classList.toggle('orientation-locked', nextBlocked)
    this.onChange?.(nextBlocked)
  }

  destroy(): void {
    window.removeEventListener('resize', this._onViewportChange)
    window.removeEventListener('orientationchange', this._onViewportChange)
    window.removeEventListener(LANG_CHANGE_EVENT, this._onLangChange)
    this.el.remove()
    document.body.classList.remove('orientation-locked')
  }
}
