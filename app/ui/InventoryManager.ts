import { Modal } from '../lib'
import { t } from '../lib/lang'
import { playUiSound } from '../lib/uiSound'
import { SOUND_CUES } from '../constants'
import type Menu from '../classes/Menu'
import { HERO_TOOL_ORDER, type HeroTool } from '../lib/heroTools'
import { getReservedGameplayHotkeys } from '../lib/settings'
import { ModalTabs } from './Tabs'
import type { MenuButtonSpec } from '../types/ui'

type ActionMenuTab = 'tools' | 'minimap' | 'construction'

const TOOL_LABEL_KEYS: Record<HeroTool, string> = {
  unarmed: 'heroToolUnarmed',
  axe: 'heroToolAxe',
  pickaxe: 'heroToolPickaxe',
  hammer: 'heroToolHammer',
  bow: 'heroToolBow',
  fishingRod: 'heroToolFishingRod',
}

export class InventoryManager {
  menu: Menu
  panel: HTMLDivElement
  modalTabs: ModalTabs<ActionMenuTab>
  toolsPanel: HTMLDivElement
  minimapPanel: HTMLDivElement
  constructionPanel: HTMLDivElement
  slots: Map<HeroTool, HTMLDivElement>
  modal?: Modal
  activeTab: ActionMenuTab
  opened: boolean
  pausedByMenu: boolean

  constructor(menu: Menu) {
    this.menu = menu
    this.opened = false
    this.pausedByMenu = false
    this.activeTab = 'tools'
    this.slots = new Map()

    this.panel = document.createElement('div')
    this.panel.className = 'inventory-content action-menu'

    this.toolsPanel = document.createElement('div')
    this.toolsPanel.className = 'action-menu-page inventory-tools-page'
    this.minimapPanel = document.createElement('div')
    this.minimapPanel.className = 'action-menu-page action-menu-minimap-page'
    this.constructionPanel = document.createElement('div')
    this.constructionPanel.className = 'action-menu-page action-menu-construction-page'

    this.modalTabs = new ModalTabs<ActionMenuTab>(
      [
        { id: 'tools', label: t('inventoryTabTools'), page: this.toolsPanel },
        { id: 'minimap', label: t('inventoryTabMinimap'), page: this.minimapPanel },
        { id: 'construction', label: t('inventoryTabConstruction'), page: this.constructionPanel },
      ],
      this.activeTab,
      tab => {
        playUiSound(SOUND_CUES.ui.menuClick)
        this.showTab(tab)
      }
    )

    for (const tool of HERO_TOOL_ORDER) {
      const slot = document.createElement('div')
      slot.className = 'inventory-slot'
      slot.textContent = t(TOOL_LABEL_KEYS[tool])
      slot.setAttribute('role', 'button')
      slot.tabIndex = 0
      slot.addEventListener('pointerup', () => this.selectTool(tool))
      this.slots.set(tool, slot)
      this.toolsPanel.appendChild(slot)
    }

    this.panel.appendChild(this.modalTabs.element)
    this.minimapPanel.appendChild(menu.minimapWrap)
  }

  toggle(): void {
    this.opened ? this.close() : this.open()
  }

  open(): void {
    if (this.opened) {
      this.showTab(this.activeTab)
      return
    }
    this.opened = true
    if (!this.menu.context.paused) {
      this.pausedByMenu = true
      this.menu.context.pause?.()
      document.getElementById('pause')?.remove()
    }
    this.modal = new Modal({
      content: this.panel,
      onClose: () => this.close(),
    })
    this.modal._panel?.classList.add('inventory-panel', 'action-menu')
    this.mountTabs()
    this.showTab(this.activeTab)
  }

  mountTabs(): void {
    this.modalTabs.mountHeader(this.modal?._panel, 'inventory-topbar')
  }

  close(): void {
    if (!this.opened && !this.modal) return
    this.opened = false
    const modal = this.modal
    this.modal = undefined
    modal?.close()
    this.showTab('tools')
    this.menu.menuTooltip.hide()
    if (!this.menu.context.controls.mouseBuilding) this.menu.updateBottombar()
    if (this.pausedByMenu) {
      this.pausedByMenu = false
      this.menu.context.resume?.()
    }
  }

  isOpen(): boolean {
    return this.opened
  }

  showTab(tab: ActionMenuTab): void {
    this.activeTab = tab
    this.modalTabs.setActive(tab, { emit: false })

    if (tab === 'minimap') {
      this.menu.updateCameraMiniMap()
      this.menu.clearActionHotkeys()
      return
    }

    if (tab === 'construction') {
      this.renderConstruction()
    } else {
      this.menu.clearActionHotkeys()
    }
  }

  restoreMinimap(): void {
    this.minimapPanel.appendChild(this.menu.minimapWrap)
  }

  getConstructionButtons(): MenuButtonSpec[] {
    const { player } = this.menu.context
    return Object.keys(player.config.buildings).map(type => this.menu.getActionBuildingButton(type))
  }

  renderConstruction(): void {
    const selection = this.menu.context.controls.heroUnit || this.menu.selection
    this.constructionPanel.textContent = ''
    this.menu.clearActionHotkeys()
    if (!selection) return

    const usedKeys = new Set<string>(this.menu.context.map.arpgMode ? getReservedGameplayHotkeys() : [])
    this.getConstructionButtons()
      .filter(button => !button.hide || !button.hide())
      .forEach((button, index) => {
        const hotkey = this.menu.assignActionHotkey(button.id || '', usedKeys)
        const actionButton: MenuButtonSpec = {
          ...button,
          onClick: (target, evt) => {
            evt?.preventDefault?.()
            evt?.stopPropagation?.()
            button.onClick?.(target, evt)
            if (this.menu.context.controls.mouseBuilding) this.close()
          },
        }
        const element = this.menu.createActionMenuButton(selection, actionButton, index, hotkey, () => {})
        this.constructionPanel.appendChild(element)
        if (hotkey && typeof button.onClick === 'function') {
          this.menu.setActionHotkey(hotkey, () => {
            this.menu.playUiClick()
            button.onClick!(selection, null)
            if (this.menu.context.controls.mouseBuilding) this.close()
          })
        }
      })
  }

  selectTool(tool: HeroTool): void {
    playUiSound(SOUND_CUES.ui.menuClick)
    this.menu.context.controls.setEquippedTool?.(tool)
    this.close()
  }

  render(equippedTool: HeroTool | null): void {
    for (const [tool, slot] of this.slots) {
      slot.classList.toggle('active', tool === equippedTool)
    }
  }

  destroy(): void {
    this.modal?.close()
    this.modal = undefined
    this.restoreMinimap()
  }
}
