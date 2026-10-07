import { createGamepadKey } from '../lib/input/gamepadGlyph'
import { t } from '../lib/lang'
import { getGamepadButtonIndex, onVisualSettingsChange } from '../lib/audio/settings'

/** Placement stays in the world: this footer does not trap focus or pause movement. */
export class BuildingPlacementHelp {
  private element = document.createElement('footer')
  private gamepad: boolean
  private place: HTMLButtonElement
  private mirror: HTMLButtonElement
  private cancel: HTMLButtonElement
  private stopSettingsWatch: () => void

  constructor(
    private actions: { place(): void; mirror(): void; cancel(): void; canMirror: boolean; destination?: boolean },
    gamepad = false
  ) {
    this.gamepad = gamepad
    this.element.className = 'building-placement-help'
    this.element.setAttribute('aria-label', t(actions.destination ? 'destinationPickingHelp' : 'placementHelp'))
    const title = document.createElement('span')
    title.textContent = t(actions.destination ? 'destinationPickingHelp' : 'placementHelp')
    this.element.appendChild(title)
    this.place = this.button(actions.place)
    this.mirror = this.button(actions.mirror)
    this.mirror.hidden = !actions.canMirror
    this.cancel = this.button(actions.cancel)
    document.body.appendChild(this.element)
    document.addEventListener('keydown', this.onKey, true)
    document.addEventListener('pointermove', this.onPointer)
    this.stopSettingsWatch = onVisualSettingsChange(() => this.render())
    this.render()
  }

  private button(action: () => void): HTMLButtonElement {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'game-window-command'
    button.addEventListener('click', action)
    this.element.appendChild(button)
    return button
  }

  setGamepad(value: boolean): void {
    if (value === this.gamepad) return
    this.gamepad = value
    this.render()
  }

  private render(): void {
    for (const [button, action, key, label] of [
      [
        this.place,
        this.actions.destination ? 'destinationConfirm' : 'placementPlace',
        '↵',
        t(this.actions.destination ? 'destinationConfirm' : 'placementPlace'),
      ],
      [this.mirror, 'placementMirror', 'R', t('placementMirror')],
      [this.cancel, this.actions.destination ? 'destinationCancel' : 'placementCancel', 'Esc', t('cancel')],
    ] as const) {
      const hint = this.gamepad ? createGamepadKey(getGamepadButtonIndex(action)) : document.createElement('kbd')
      if (!this.gamepad) hint.textContent = key
      button.replaceChildren(hint, document.createTextNode(label))
    }
  }

  private onPointer = (): void => this.setGamepad(false)
  private onKey = (event: KeyboardEvent): void => {
    if (
      document.querySelector('.modal') ||
      (event.target as HTMLElement)?.closest('input, textarea, [contenteditable=true]')
    )
      return
    if (
      event.key === 'Enter' &&
      this.element.contains(event.target as Node) &&
      (event.target as HTMLElement).closest('button')
    ) {
      event.stopImmediatePropagation()
      return
    }
    const action =
      event.key === 'Enter'
        ? this.actions.place
        : event.key.toLowerCase() === 'r' && this.actions.canMirror
          ? this.actions.mirror
          : event.key === 'Escape'
            ? this.actions.cancel
            : null
    if (!action) return
    event.preventDefault()
    event.stopImmediatePropagation()
    this.setGamepad(false)
    if (!event.repeat) action()
  }

  destroy(): void {
    this.stopSettingsWatch()
    document.removeEventListener('keydown', this.onKey, true)
    document.removeEventListener('pointermove', this.onPointer)
    this.element.remove()
  }
}
