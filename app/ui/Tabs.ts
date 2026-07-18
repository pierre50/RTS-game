export type TabItem<T extends string> = {
  id: T
  label: string
}

export class Tabs<T extends string> {
  element: HTMLDivElement
  buttons: Map<T, HTMLButtonElement>
  activeId: T
  onChange: (id: T) => void

  constructor(items: TabItem<T>[], activeId: T, onChange: (id: T) => void) {
    this.element = document.createElement('div')
    this.element.className = 'ui-tabs'
    this.buttons = new Map()
    this.activeId = activeId
    this.onChange = onChange

    items.forEach(item => {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'ui-tab'
      button.dataset.tab = item.id
      button.textContent = item.label
      button.addEventListener('pointerup', () => this.setActive(item.id))
      this.buttons.set(item.id, button)
      this.element.appendChild(button)
    })

    this.updateButtons()
  }

  setActive(id: T, options: { emit?: boolean } = {}): void {
    if (id === this.activeId) return
    this.activeId = id
    this.updateButtons()
    if (options.emit !== false) this.onChange(id)
  }

  updateButtons(): void {
    for (const [id, button] of this.buttons) {
      const active = id === this.activeId
      button.classList.toggle('active', active)
      button.setAttribute('aria-selected', String(active))
    }
  }
}
