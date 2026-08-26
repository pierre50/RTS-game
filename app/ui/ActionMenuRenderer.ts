import { getReservedGameplayHotkeys } from '../lib/audio/settings'
import type { RuntimeEntity } from '../types/entities'
import type { MenuButtonSpec } from '../types/ui'
import type { MenuHost } from './MenuHost'

export class ActionMenuRenderer {
  menu: MenuHost
  activeHotkeys: Map<string, () => void>

  constructor(menu: MenuHost) {
    this.menu = menu
    this.activeHotkeys = new Map()
  }

  clearHotkeys(): void {
    this.activeHotkeys.clear()
  }

  handleHotkey(key: string): void {
    const action = this.activeHotkeys.get(key)
    if (action) action()
  }

  assignHotkey(id: string, usedKeys: Set<string>): string | null {
    for (const ch of id.toLowerCase()) {
      if (/[a-z]/.test(ch) && !usedKeys.has(ch)) {
        usedKeys.add(ch)
        return ch
      }
    }
    return null
  }

  makePressable(element: HTMLButtonElement, action: (evt: Event) => void): void {
    element.addEventListener('click', evt => {
      this.menu.menuTooltip.hide()
      action(evt)
    })
  }

  createMenuBox(id: string): HTMLButtonElement {
    const box = document.createElement('button')
    box.type = 'button'
    box.className = 'ui-btn ui-icon-btn'
    box.id = id
    return box
  }

  createMenuButton(
    selection: RuntimeEntity,
    btn: MenuButtonSpec,
    index: number,
    hotkey: string | null,
    onNavigate: (children: MenuButtonSpec[]) => void
  ): HTMLButtonElement {
    const box = this.createMenuBox(btn.id || `btn-${index}`)
    const disabled = btn.disabled?.() ?? false
    box.setAttribute('aria-disabled', String(disabled))
    if (typeof btn.onCreate === 'function') {
      btn.onCreate(selection, box)
    } else {
      box.appendChild(this.menu.createActionIcon(typeof btn.icon === 'function' ? btn.icon() : (btn.icon ?? '')))
    }

    if (btn.tooltip) {
      this.menu.menuTooltip.bind(box, btn.tooltip)
    }

    if (!btn.onCreate) {
      const children = btn.children
      const onClick = btn.onClick
      if (children) {
        this.makePressable(box, () => {
          if (btn.disabled?.()) return
          this.menu.playUiClick()
          onNavigate(children)
        })
      } else if (typeof onClick === 'function') {
        this.makePressable(box, evt => {
          if (btn.disabled?.()) return
          this.menu.playUiClick()
          onClick(selection, evt)
        })
      }
    }

    return box
  }

  renderMenuLevel(
    selection: RuntimeEntity,
    element: HTMLElement,
    items: MenuButtonSpec[],
    options: {
      parent?: MenuButtonSpec[]
      onNavigate?: (children: MenuButtonSpec[], current: MenuButtonSpec[]) => void
      onBack?: (parent?: MenuButtonSpec[]) => void
      renderBackButton?: (parent?: MenuButtonSpec[]) => HTMLElement
    } = {}
  ): void {
    this.clearHotkeys()
    const usedKeys = new Set<string>(getReservedGameplayHotkeys())

    items
      .filter(btn => !btn.hide || !btn.hide())
      .forEach((btn, index) => {
        const hotkey = this.assignHotkey(btn.id || '', usedKeys)
        const onNavigate = (children: MenuButtonSpec[]) => {
          options.onNavigate?.(children, items)
        }
        element.appendChild(this.createMenuButton(selection, btn, index, hotkey, onNavigate))

        if (hotkey) {
          if (btn.children) {
            this.activeHotkeys.set(hotkey, () => {
              if (btn.disabled?.()) return
              this.menu.playUiClick()
              onNavigate(btn.children!)
            })
          } else if (typeof btn.onClick === 'function') {
            this.activeHotkeys.set(hotkey, () => {
              if (btn.disabled?.()) return
              this.menu.playUiClick()
              btn.onClick!(selection, null)
            })
          }
        }
      })

    if (options.renderBackButton) {
      element.appendChild(options.renderBackButton(options.parent))
    }
  }
}
