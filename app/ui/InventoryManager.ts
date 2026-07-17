import { t } from '../lib/lang'
import { playUiSound } from '../lib/uiSound'
import { SOUND_CUES } from '../constants'
import type Menu from '../classes/Menu'
import { HERO_TOOL_ORDER, type HeroTool } from '../lib/heroTools'

const TOOL_LABEL_KEYS: Record<HeroTool, string> = {
  unarmed: 'heroToolUnarmed',
  axe: 'heroToolAxe',
  pickaxe: 'heroToolPickaxe',
  hammer: 'heroToolHammer',
  bow: 'heroToolBow',
}

export class InventoryManager {
  menu: Menu
  panel: HTMLDivElement
  slots: Map<HeroTool, HTMLDivElement>
  opened: boolean

  constructor(menu: Menu) {
    this.menu = menu
    this.opened = false
    this.slots = new Map()

    this.panel = document.createElement('div')
    this.panel.className = 'inventory-panel hidden'

    for (const tool of HERO_TOOL_ORDER) {
      const slot = document.createElement('div')
      slot.className = 'inventory-slot'
      slot.textContent = t(TOOL_LABEL_KEYS[tool])
      slot.setAttribute('role', 'button')
      slot.tabIndex = 0
      slot.addEventListener('pointerup', () => this.selectTool(tool))
      this.slots.set(tool, slot)
      this.panel.appendChild(slot)
    }

    menu.gameHud.appendChild(this.panel)
  }

  toggle(): void {
    this.opened = !this.opened
    this.panel.classList.toggle('hidden', !this.opened)
  }

  isOpen(): boolean {
    return this.opened
  }

  selectTool(tool: HeroTool): void {
    playUiSound(SOUND_CUES.ui.menuClick)
    this.menu.context.controls.setEquippedTool?.(tool)
    this.opened = false
    this.panel.classList.add('hidden')
  }

  render(equippedTool: HeroTool | null): void {
    for (const [tool, slot] of this.slots) {
      slot.classList.toggle('active', tool === equippedTool)
    }
  }

  destroy(): void {
    this.panel.remove()
  }
}
