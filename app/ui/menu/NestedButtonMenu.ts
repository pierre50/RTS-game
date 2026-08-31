export type NestedButtonMenuItem<TId extends string> = {
  id: TId
  label: string
  className?: string
  children?: NestedButtonMenuItem<TId>[]
  hidden?: () => boolean
  onClick?: () => void
}

export type NestedButtonMenuButtonId<TId extends string> = TId | 'back'

type NestedButtonMenuOptions<TId extends string> = {
  container: HTMLElement
  items: NestedButtonMenuItem<TId>[]
  backLabel: string
  buttonClassName?: string
  backButtonClassName?: string
  showBackButton?: boolean
  onNavigate?: () => void
  onBack?: () => void
}

export class NestedButtonMenu<TId extends string> {
  container: HTMLElement
  rootItems: NestedButtonMenuItem<TId>[]
  buttons: Map<NestedButtonMenuButtonId<TId>, HTMLButtonElement>
  stack: NestedButtonMenuItem<TId>[][]
  backButton: HTMLButtonElement
  showBackButton: boolean
  onNavigate?: () => void
  onBack?: () => void

  constructor(options: NestedButtonMenuOptions<TId>) {
    this.container = options.container
    this.rootItems = options.items
    this.buttons = new Map()
    this.stack = [this.rootItems]
    this.showBackButton = options.showBackButton ?? true
    this.onNavigate = options.onNavigate
    this.onBack = options.onBack

    const buttonClassName = options.buttonClassName ?? 'ui-btn'
    this.createButtons(this.rootItems, buttonClassName)

    this.backButton = document.createElement('button')
    this.backButton.type = 'button'
    this.backButton.className = options.backButtonClassName ?? buttonClassName
    this.backButton.textContent = options.backLabel
    this.backButton.addEventListener('click', () => {
      if (this.backButton.hidden) return
      this.back()
    })
    this.buttons.set('back', this.backButton)
    this.container.appendChild(this.backButton)
    this.syncVisibility()
  }

  reset(): void {
    this.stack = [this.rootItems]
    this.syncVisibility()
  }

  back(): void {
    if (this.stack.length <= 1) return
    this.stack.pop()
    this.syncVisibility()
    this.onBack?.()
  }

  syncVisibility(): void {
    const visible = new Set(
      (this.stack[this.stack.length - 1] ?? []).filter(item => item.hidden?.() !== true).map(item => item.id)
    )
    for (const [id, button] of this.buttons.entries()) {
      button.hidden = id === 'back' ? !this.showBackButton || this.stack.length <= 1 : !visible.has(id)
    }
  }

  private createButtons(items: NestedButtonMenuItem<TId>[], buttonClassName: string): void {
    for (const item of items) {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = item.className ? `${buttonClassName} ${item.className}` : buttonClassName
      button.textContent = item.label
      button.addEventListener('click', () => {
        if (button.disabled || button.hidden) return
        if (item.children?.length) {
          this.stack.push(item.children)
          this.syncVisibility()
          this.onNavigate?.()
          return
        }
        item.onClick?.()
      })
      this.buttons.set(item.id, button)
      this.container.appendChild(button)
      if (item.children?.length) this.createButtons(item.children, buttonClassName)
    }
  }
}
