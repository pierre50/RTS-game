import { t } from '../lib/lang'

/** Placement stays in the world: this footer does not trap focus or pause movement. */
export class BuildingPlacementHelp {
  private element = document.createElement('footer')
  private gamepad = false
  private place: HTMLButtonElement
  private mirror: HTMLButtonElement
  private cancel: HTMLButtonElement

  constructor(private actions: { place(): void; mirror(): void; cancel(): void; canMirror: boolean }) {
    this.element.className = 'building-placement-help'
    this.element.setAttribute('aria-label', t('placementHelp'))
    const title = document.createElement('span')
    title.textContent = t('placementHelp')
    this.element.appendChild(title)
    this.place = this.button(actions.place)
    this.mirror = this.button(actions.mirror)
    this.mirror.hidden = !actions.canMirror
    this.cancel = this.button(actions.cancel)
    document.body.appendChild(this.element)
    document.addEventListener('keydown', this.onKey, true)
    document.addEventListener('pointermove', this.onPointer)
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
    for (const [button, key, label] of [
      [this.place, this.gamepad ? 'A' : '↵', t('placementPlace')],
      [this.mirror, this.gamepad ? 'X' : 'R', t('placementMirror')],
      [this.cancel, this.gamepad ? 'B' : 'Esc', t('cancel')],
    ] as const) {
      const hint = document.createElement('kbd')
      hint.textContent = key
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
    document.removeEventListener('keydown', this.onKey, true)
    document.removeEventListener('pointermove', this.onPointer)
    this.element.remove()
  }
}
