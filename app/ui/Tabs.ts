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

export type ModalTabPage<T extends string> = TabItem<T> & {
  page: HTMLElement
}

export class ModalTabs<T extends string> {
  element: HTMLDivElement
  tabs: Tabs<T>
  pages: Map<T, HTMLElement>
  activeId: T
  onChange: (id: T) => void

  constructor(items: ModalTabPage<T>[], activeId: T, onChange: (id: T) => void = () => {}) {
    this.element = document.createElement('div')
    this.element.className = 'modal-tabs-content'
    this.pages = new Map(items.map(item => [item.id, item.page]))
    this.activeId = activeId
    this.onChange = onChange
    this.tabs = new Tabs<T>(
      items.map(({ id, label }) => ({ id, label })),
      activeId,
      id => this.setActive(id)
    )

    items.forEach(item => {
      item.page.classList.add('modal-tab-page')
      item.page.dataset.tabPage = item.id
      this.element.appendChild(item.page)
    })
    this.showPage(activeId)
  }

  mountHeader(panel: HTMLElement | null | undefined, className?: string): void {
    const header = panel?.querySelector<HTMLElement>('.modal-header')
    if (!header) return
    if (className) header.classList.add(className)
    header.insertBefore(this.tabs.element, header.firstChild)
  }

  setActive(id: T, options: { emit?: boolean } = {}): void {
    this.activeId = id
    this.tabs.setActive(id, { emit: false })
    this.showPage(id)
    if (options.emit !== false) this.onChange(id)
  }

  private showPage(id: T): void {
    for (const [pageId, page] of this.pages) {
      page.classList.toggle('hidden', pageId !== id)
      page.setAttribute('aria-hidden', String(pageId !== id))
    }
  }
}
