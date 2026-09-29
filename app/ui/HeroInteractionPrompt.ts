import { createGamepadKey } from '../lib/input/gamepadGlyph'
import { t } from '../lib/lang'
import { getControlKeyLabel, getGamepadBindings, getGamepadEnabled, getKeyBindings } from '../lib/audio/settings'
import { getActiveGamepad, readStick, GAMEPAD_AXIS } from '../lib/input/gamepad'

const DANGER_ACTION_KEYS = new Set(['heroInteractionSteal'])

export class HeroInteractionPrompt {
  element: HTMLDivElement
  private actionKey: string | null
  private frame: number | null = null
  private keyboard = false
  private hadGamepad = false
  private renderedSignature = ''

  constructor(parent: HTMLElement) {
    this.actionKey = null
    this.element = document.createElement('div')
    this.element.className = 'hero-interaction-prompt hidden'
    this.element.setAttribute('aria-hidden', 'true')
    parent.appendChild(this.element)
    document.addEventListener('keydown', this.onKeyboard)
    document.addEventListener('pointerdown', this.onKeyboard)
  }

  setAction(actionKey: string | null | undefined): void {
    if (!actionKey) {
      this.actionKey = null
      this.stopRefresh()
      this.element.classList.add('hidden')
      this.element.classList.remove('is-danger')
      this.element.setAttribute('aria-hidden', 'true')
      this.element.textContent = ''
      this.renderedSignature = ''
      return
    }
    this.actionKey = actionKey
    this.render()
    if (this.frame === null) this.frame = requestAnimationFrame(this.refresh)
    this.element.classList.toggle('is-danger', DANGER_ACTION_KEYS.has(actionKey))
    this.element.classList.remove('hidden')
    this.element.setAttribute('aria-hidden', 'false')
  }

  private onKeyboard = (): void => {
    this.keyboard = true
    this.render()
  }

  private render(): void {
    if (!this.actionKey) return
    const pad = getGamepadEnabled() ? getActiveGamepad() : null
    if (pad) {
      const move = readStick(pad, GAMEPAD_AXIS.moveX, GAMEPAD_AXIS.moveY)
      const aim = readStick(pad, GAMEPAD_AXIS.aimX, GAMEPAD_AXIS.aimY)
      if (!this.hadGamepad || move.x || move.y || aim.x || aim.y || pad.buttons.some(button => button.pressed))
        this.keyboard = false
    }
    this.hadGamepad = Boolean(pad)
    const button = pad && !this.keyboard ? Number(getGamepadBindings().heroInteract.replace('Button', '')) : null
    const key = getControlKeyLabel(getKeyBindings().heroInteract)
    const action = t(this.actionKey)
    const signature = JSON.stringify([button, key, action])
    if (signature === this.renderedSignature) return
    this.renderedSignature = signature
    if (button !== null) {
      this.element.replaceChildren(createGamepadKey(button), document.createTextNode(` ${action}`))
    } else {
      this.element.textContent = t('heroInteractionPrompt', { key, action })
    }
  }

  private refresh = (): void => {
    this.frame = null
    if (!this.actionKey) return
    this.render()
    this.frame = requestAnimationFrame(this.refresh)
  }

  private stopRefresh(): void {
    if (this.frame !== null) cancelAnimationFrame(this.frame)
    this.frame = null
  }

  destroy(): void {
    this.stopRefresh()
    document.removeEventListener('keydown', this.onKeyboard)
    document.removeEventListener('pointerdown', this.onKeyboard)
    this.element.remove()
  }
}
