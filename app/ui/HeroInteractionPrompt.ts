import { t } from '../lib/lang'

const DANGER_ACTION_KEYS = new Set(['heroInteractionSteal'])

export class HeroInteractionPrompt {
  element: HTMLDivElement
  private actionKey: string | null

  constructor(parent: HTMLElement) {
    this.actionKey = null
    this.element = document.createElement('div')
    this.element.className = 'hero-interaction-prompt hidden'
    this.element.setAttribute('aria-hidden', 'true')
    parent.appendChild(this.element)
  }

  setAction(actionKey: string | null | undefined): void {
    if (!actionKey) {
      this.actionKey = null
      this.element.classList.add('hidden')
      this.element.classList.remove('is-danger')
      this.element.setAttribute('aria-hidden', 'true')
      this.element.textContent = ''
      return
    }
    if (this.actionKey !== actionKey) {
      this.actionKey = actionKey
      this.element.textContent = t('heroInteractionPrompt', { action: t(actionKey) })
    }
    this.element.classList.toggle('is-danger', DANGER_ACTION_KEYS.has(actionKey))
    this.element.classList.remove('hidden')
    this.element.setAttribute('aria-hidden', 'false')
  }

  destroy(): void {
    this.element.remove()
  }
}
