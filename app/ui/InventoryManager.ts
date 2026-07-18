import { t } from '../lib/lang'
import { playUiSound } from '../lib/uiSound'
import { SOUND_CUES } from '../constants'
import type Menu from '../classes/Menu'
import { HERO_TOOL_ORDER, type HeroTool } from '../lib/heroTools'
import { Tabs } from './Tabs'
import type { MenuButtonSpec } from '../types/ui'

type ActionMenuTab = 'tools' | 'minimap' | 'construction'

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
  header: HTMLDivElement
  title: HTMLDivElement
  closeButton: HTMLButtonElement
  tabs: Tabs<ActionMenuTab>
  toolsPanel: HTMLDivElement
  minimapPanel: HTMLDivElement
  constructionPanel: HTMLDivElement
  slots: Map<HeroTool, HTMLDivElement>
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
    this.panel.className = 'inventory-panel modal-panel action-menu hidden'
    this.panel.setAttribute('role', 'dialog')

    this.header = document.createElement('div')
    this.header.className = 'inventory-header modal-header'

    this.title = document.createElement('div')
    this.title.className = 'inventory-title modal-title'
    this.title.textContent = t('inventoryTabTools')

    this.closeButton = document.createElement('button')
    this.closeButton.type = 'button'
    this.closeButton.className = 'inventory-close modal-close ui-btn'
    this.closeButton.textContent = '✕'
    this.closeButton.setAttribute('aria-label', t('close'))
    this.closeButton.addEventListener('click', () => {
      playUiSound(SOUND_CUES.ui.menuClick)
      this.close()
    })

    this.tabs = new Tabs<ActionMenuTab>(
      [
        { id: 'tools', label: t('inventoryTabTools') },
        { id: 'minimap', label: t('inventoryTabMinimap') },
        { id: 'construction', label: t('inventoryTabConstruction') },
      ],
      this.activeTab,
      tab => {
        playUiSound(SOUND_CUES.ui.menuClick)
        this.showTab(tab)
      }
    )
    this.toolsPanel = document.createElement('div')
    this.toolsPanel.className = 'action-menu-page inventory-tools-page'
    this.minimapPanel = document.createElement('div')
    this.minimapPanel.className = 'action-menu-page action-menu-minimap-page hidden'
    this.constructionPanel = document.createElement('div')
    this.constructionPanel.className = 'action-menu-page action-menu-construction-page hidden'

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

    this.header.appendChild(this.title)
    this.header.appendChild(this.closeButton)
    this.panel.appendChild(this.header)
    this.panel.appendChild(this.tabs.element)
    this.panel.appendChild(this.toolsPanel)
    this.panel.appendChild(this.minimapPanel)
    this.panel.appendChild(this.constructionPanel)
    this.minimapPanel.appendChild(menu.minimapWrap)

    menu.gameHud.appendChild(this.panel)
  }

  toggle(): void {
    this.opened ? this.close() : this.open()
  }

  open(): void {
    this.opened = true
    if (!this.menu.context.paused) {
      this.pausedByMenu = true
      this.menu.context.pause?.()
      document.getElementById('pause')?.remove()
    }
    this.panel.classList.remove('hidden')
    this.showTab(this.activeTab)
  }

  close(): void {
    this.opened = false
    this.panel.classList.add('hidden')
    this.showTab('tools')
    this.menu.menuTooltip.hide()
    this.menu.updateBottombar()
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
    this.tabs.setActive(tab, { emit: false })
    this.toolsPanel.classList.toggle('hidden', tab !== 'tools')
    this.minimapPanel.classList.toggle('hidden', tab !== 'minimap')
    this.constructionPanel.classList.toggle('hidden', tab !== 'construction')

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

    const usedKeys = new Set<string>()
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
    this.restoreMinimap()
    this.panel.remove()
  }
}
