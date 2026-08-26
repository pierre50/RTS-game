import { t } from '../lang'
import { uuidv4 } from '../maths'
import { playClickSound } from '../audio/uiSound'

export class Modal {
  _backdrop?: HTMLDivElement
  _closed?: boolean
  _id: string
  _onClose?: () => void
  _onKeyDown: (evt: KeyboardEvent) => void
  _panel?: HTMLDivElement
  _previousActiveElement: Element | null

  constructor({ title, content, onClose }: { title?: string; content?: Node; onClose?: () => void } = {}) {
    this._id = uuidv4()
    this._onClose = onClose
    this._previousActiveElement = document.activeElement
    this._onKeyDown = this._handleKeyDown.bind(this)
    this._build(title, content)
  }

  _build(title?: string, content?: Node): void {
    const backdrop = document.createElement('div')
    this._backdrop = backdrop
    backdrop.id = this._id
    backdrop.className = 'modal'
    backdrop.addEventListener('pointerdown', (e: PointerEvent) => {
      if (e.target === backdrop) {
        this._dismiss()
      }
    })

    const panel = document.createElement('div')
    this._panel = panel
    panel.className = 'modal-panel ui-panel-enter'
    panel.setAttribute('role', 'dialog')
    panel.setAttribute('aria-modal', 'true')
    panel.tabIndex = -1

    const header = document.createElement('div')
    header.className = 'modal-header'

    if (title) {
      const titleEl = document.createElement('div')
      titleEl.id = `${this._id}-title`
      titleEl.className = 'modal-title'
      titleEl.textContent = title
      panel.setAttribute('aria-labelledby', titleEl.id)
      header.appendChild(titleEl)
    } else {
      panel.setAttribute('aria-label', t('dialog'))
    }

    const closeBtn = document.createElement('button')
    closeBtn.type = 'button'
    closeBtn.className = 'modal-close ui-btn'
    closeBtn.textContent = '✕'
    closeBtn.setAttribute('aria-label', t('close'))
    closeBtn.addEventListener('pointerdown', playClickSound)
    closeBtn.addEventListener('click', () => this._dismiss())
    header.appendChild(closeBtn)

    panel.appendChild(header)
    if (content) panel.appendChild(content)

    backdrop.appendChild(panel)
    document.body.appendChild(backdrop)
    document.addEventListener('keydown', this._onKeyDown)
    requestAnimationFrame(() => {
      if (!this._backdrop?.isConnected) return
      this._getFocusableElements()[0]?.focus()
      if (!this._panel?.contains(document.activeElement)) this._panel?.focus()
    })
  }

  _getFocusableElements(): HTMLElement[] {
    if (!this._panel) return []
    return [
      ...this._panel.querySelectorAll(
        'button:not([disabled]), select:not([disabled]), input:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
      ),
    ].filter(element => {
      const htmlElement = element as HTMLElement
      return (
        !htmlElement.hidden &&
        htmlElement.getAttribute('aria-hidden') !== 'true' &&
        htmlElement.getClientRects().length > 0
      )
    }) as HTMLElement[]
  }

  _isTopmost(): boolean {
    const modals = document.querySelectorAll('.modal')
    return modals.length > 0 && modals[modals.length - 1] === this._backdrop
  }

  _handleKeyDown(evt: KeyboardEvent): void {
    if (!this._isTopmost()) return

    if (evt.key === 'Escape') {
      evt.preventDefault()
      this._dismiss()
      return
    }

    if (evt.key !== 'Tab') return
    const focusable = this._getFocusableElements()
    if (!focusable.length) {
      evt.preventDefault()
      this._panel?.focus()
      return
    }

    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (evt.shiftKey && (document.activeElement === first || !this._panel?.contains(document.activeElement))) {
      evt.preventDefault()
      last.focus()
    } else if (!evt.shiftKey && document.activeElement === last) {
      evt.preventDefault()
      first.focus()
    }
  }

  _dismiss(): void {
    if (!this._backdrop?.isConnected) return
    this._removeEl()
    this._onClose?.()
  }

  _removeEl(): void {
    if (this._closed) return
    this._closed = true
    document.removeEventListener('keydown', this._onKeyDown)
    this._backdrop?.remove()
    if (this._previousActiveElement?.isConnected) {
      ;(this._previousActiveElement as HTMLElement).focus()
    }
  }

  close(): void {
    this._removeEl()
  }
}
