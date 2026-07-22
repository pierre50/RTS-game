import { Modal } from '../lib'
import { t } from '../lib/lang'
import { playUiSound } from '../lib/uiSound'
import { SOUND_CUES } from '../constants'
import { getIconPath } from '../lib'
import type Menu from '../classes/Menu'
import { HERO_TOOL_ORDER, type HeroEquippedItem } from '../lib/heroTools'
import { getReservedGameplayHotkeys } from '../lib/settings'
import { ModalTabs } from './Tabs'
import type { RuntimeEntity } from '../types/entities'
import type { MenuButtonSpec } from '../types/ui'

type ActionMenuTab = 'tools' | 'technologies' | 'minimap' | 'construction'

const TOOL_LABEL_KEYS: Record<HeroEquippedItem, string> = {
  interact: 'heroToolInteract',
  bow: 'heroToolBow',
}

export class InventoryManager {
  menu: Menu
  panel: HTMLDivElement
  modalTabs: ModalTabs<ActionMenuTab>
  toolsPanel: HTMLDivElement
  minimapPanel: HTMLDivElement
  constructionPanel: HTMLDivElement
  technologiesPanel: HTMLDivElement
  slots: Map<HeroEquippedItem, HTMLDivElement>
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
    this.technologiesPanel = document.createElement('div')
    this.technologiesPanel.className = 'action-menu-page action-menu-technologies-page'
    this.constructionPanel = document.createElement('div')
    this.constructionPanel.className = 'action-menu-page action-menu-construction-page'

    this.modalTabs = new ModalTabs<ActionMenuTab>(
      [
        { id: 'tools', label: t('inventoryTabTools'), page: this.toolsPanel },
        { id: 'technologies', label: t('inventoryTabTechnologies'), page: this.technologiesPanel },
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
    if (!this.menu.context.controls.mouseBuilding) this.menu.updateActionTarget()
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

    if (tab === 'technologies') {
      this.renderTechnologies()
    } else if (tab === 'construction') {
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

  getTechnologyButtons(): MenuButtonSpec[] {
    return this.menu.getHeroTechnologyButtons()
  }

  createTechnologyButton(selection: RuntimeEntity, button: MenuButtonSpec, hotkey: string | null): HTMLButtonElement {
    const element = document.createElement('button')
    element.type = 'button'
    element.className = 'technology-menu-button'
    element.disabled = button.disabled?.() ?? false
    element.id = button.id ? `inventory-tech-${button.id}` : ''

    const icon = document.createElement('span')
    icon.className = 'technology-menu-icon'
    icon.appendChild(
      this.menu.createActionIcon(typeof button.icon === 'function' ? button.icon() : (button.icon ?? ''))
    )

    const label = document.createElement('span')
    label.className = 'technology-menu-label'
    label.textContent = button.tooltip
      ? typeof button.tooltip === 'function'
        ? button.tooltip().title
        : button.tooltip.title
      : button.id || ''

    const meta = document.createElement('span')
    meta.className = 'technology-menu-meta'
    const tooltip = typeof button.tooltip === 'function' ? button.tooltip() : button.tooltip
    meta.textContent = tooltip?.meta?.filter(Boolean).join(' | ') || tooltip?.description || ''

    const progress = document.createElement('span')
    progress.className = 'technology-menu-progress'
    const progressFill = document.createElement('span')
    progressFill.className = 'technology-menu-progress-fill'
    const progressText = document.createElement('span')
    progressText.className = 'technology-menu-progress-text'
    progress.appendChild(progressFill)
    progress.appendChild(progressText)

    if (hotkey) {
      const badge = document.createElement('span')
      badge.className = 'technology-menu-hotkey'
      badge.textContent = hotkey.toUpperCase()
      element.appendChild(badge)
    }

    element.appendChild(icon)
    element.appendChild(label)
    element.appendChild(meta)
    element.appendChild(progress)

    if (button.tooltip) this.menu.menuTooltip.bind(element, button.tooltip)
    element.addEventListener('pointerup', evt => {
      if (element.disabled) return
      this.menu.playUiClick()
      button.onClick?.(selection, evt)
      this.renderTechnologies()
    })
    return element
  }

  renderResearchStatus(): void {
    const { player } = this.menu.context
    this.technologiesPanel.querySelectorAll<HTMLElement>('.technology-menu-button').forEach(element => {
      const type = element.id.replace(/^inventory-tech-/, '')
      const active = Boolean(type && player.researchTechnology?.type === type)
      const progress = active ? Math.max(0, Math.min(100, Math.floor(player.researchLoading ?? 0))) : 0
      const bar = element.querySelector<HTMLElement>('.technology-menu-progress')
      const fill = element.querySelector<HTMLElement>('.technology-menu-progress-fill')
      const text = element.querySelector<HTMLElement>('.technology-menu-progress-text')
      element.classList.toggle('is-researching', active)
      if (bar) bar.classList.toggle('is-visible', active)
      if (fill) fill.style.width = `${progress}%`
      if (text) text.textContent = active ? `${progress}%` : ''
    })
  }

  renderCancelTechnology(): void {
    const { player } = this.menu.context
    if (!player.researchTechnology) return
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'technology-menu-button technology-menu-button--cancel'
    const icon = document.createElement('span')
    icon.className = 'technology-menu-icon'
    icon.appendChild(this.menu.createActionIcon(getIconPath('003_50721')))
    const label = document.createElement('span')
    label.className = 'technology-menu-label'
    label.textContent = t('cancel')
    const meta = document.createElement('span')
    meta.className = 'technology-menu-meta'
    meta.textContent = t('cancelTechnologyDescription')
    button.appendChild(icon)
    button.appendChild(label)
    button.appendChild(meta)
    button.addEventListener('pointerup', () => {
      this.menu.playUiClick()
      player.cancelTechnology?.()
      this.renderTechnologies()
    })
    this.technologiesPanel.appendChild(button)
  }

  renderTechnologies(): void {
    const selection = this.menu.context.controls.heroUnit || this.menu.selection
    this.technologiesPanel.textContent = ''
    this.menu.clearActionHotkeys()
    if (!selection) return

    this.renderCancelTechnology()
    const usedKeys = new Set<string>(getReservedGameplayHotkeys())
    this.getTechnologyButtons()
      .filter(button => !button.hide || !button.hide())
      .forEach(button => {
        const hotkey = button.disabled?.() ? null : this.menu.assignActionHotkey(button.id || '', usedKeys)
        const element = this.createTechnologyButton(selection, button, hotkey)
        this.technologiesPanel.appendChild(element)
        if (hotkey && typeof button.onClick === 'function') {
          this.menu.setActionHotkey(hotkey, () => {
            if (button.disabled?.()) return
            this.menu.playUiClick()
            button.onClick!(selection, null)
            this.renderTechnologies()
          })
        }
      })
    this.renderResearchStatus()
  }

  syncTechnologyProgress(): void {
    if (!this.opened || this.activeTab !== 'technologies') return
    this.renderResearchStatus()
  }

  renderConstruction(): void {
    const selection = this.menu.context.controls.heroUnit || this.menu.selection
    this.constructionPanel.textContent = ''
    this.menu.clearActionHotkeys()
    if (!selection) return

    const usedKeys = new Set<string>(getReservedGameplayHotkeys())
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

  selectTool(tool: HeroEquippedItem): void {
    playUiSound(SOUND_CUES.ui.menuClick)
    this.menu.context.controls.setEquippedItem?.(tool)
    this.menu.context.controls.setEquippedTool?.(tool)
    this.close()
  }

  render(equippedTool: HeroEquippedItem | null): void {
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
