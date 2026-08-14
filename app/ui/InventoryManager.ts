import { Modal } from '../lib'
import { renderBuildingAvatar, renderEquipmentAvatar } from '../lib/avatar'
import { t } from '../lib/lang'
import { playUiSound } from '../lib/uiSound'
import { SOUND_CUES } from '../constants'
import type Menu from '../classes/Menu'
import { createEntityInfoContent } from './EntityInfoModalManager'
import { EQUIPPED_ITEM_WEAPON, getEquippedItemWeapon, HERO_TOOL_ORDER, type HeroEquippedItem } from '../lib/heroTools'
import { getReservedGameplayHotkeys } from '../lib/settings'
import { ModalTabs } from './Tabs'
import type { RuntimeEntity } from '../types/entities'
import type { FactionRelationState, FactionSave, WorldColor, WorldGraphNode, WorldGraphSave } from '../types/save'
import type { MenuButtonSpec } from '../types/ui'

type ActionMenuTab = 'info' | 'tools' | 'technologies' | 'minimap' | 'worldmap' | 'construction'

const TOOL_LABEL_KEYS: Record<HeroEquippedItem, string> = {
  interact: 'heroToolInteract',
  sword: 'heroToolSword',
  bow: 'heroToolBow',
  lasso: 'heroToolLasso',
}

export class InventoryManager {
  menu: Menu
  panel: HTMLDivElement
  modalTabs: ModalTabs<ActionMenuTab>
  infoPanel: HTMLDivElement
  toolsPanel: HTMLDivElement
  minimapPanel: HTMLDivElement
  worldMapPanel: HTMLDivElement
  constructionPanel: HTMLDivElement
  technologiesPanel: HTMLDivElement
  slots: Map<HeroEquippedItem, HTMLButtonElement>
  toolIcons: Map<HeroEquippedItem, HTMLCanvasElement>
  toolIconsRendered: boolean
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
    this.toolIcons = new Map()
    this.toolIconsRendered = false

    this.panel = document.createElement('div')
    this.panel.className = 'inventory-content action-menu'

    this.infoPanel = document.createElement('div')
    this.infoPanel.className = 'action-menu-page action-menu-info-page'
    this.toolsPanel = document.createElement('div')
    this.toolsPanel.className = 'action-menu-page inventory-tools-page'
    this.minimapPanel = document.createElement('div')
    this.minimapPanel.className = 'action-menu-page action-menu-minimap-page'
    this.worldMapPanel = document.createElement('div')
    this.worldMapPanel.className = 'action-menu-page action-menu-worldmap-page'
    this.technologiesPanel = document.createElement('div')
    this.technologiesPanel.className = 'action-menu-page action-menu-technologies-page'
    this.constructionPanel = document.createElement('div')
    this.constructionPanel.className = 'action-menu-page action-menu-construction-page'

    this.modalTabs = new ModalTabs<ActionMenuTab>(
      [
        { id: 'info', label: t('inventoryTabInfo'), page: this.infoPanel },
        { id: 'tools', label: t('inventoryTabTools'), page: this.toolsPanel },
        { id: 'technologies', label: t('inventoryTabTechnologies'), page: this.technologiesPanel },
        { id: 'minimap', label: t('inventoryTabMinimap'), page: this.minimapPanel },
        { id: 'worldmap', label: t('inventoryTabWorldmap'), page: this.worldMapPanel },
        { id: 'construction', label: t('inventoryTabConstruction'), page: this.constructionPanel },
      ],
      this.activeTab,
      tab => {
        playUiSound(SOUND_CUES.ui.menuClick)
        this.showTab(tab)
      }
    )

    for (const tool of HERO_TOOL_ORDER) {
      const slot = document.createElement('button')
      slot.type = 'button'
      slot.className = 'inventory-slot ui-btn'
      slot.addEventListener('click', () => this.selectTool(tool))

      if (EQUIPPED_ITEM_WEAPON[tool]) {
        const icon = document.createElement('canvas')
        icon.className = 'unit-avatar-frame inventory-slot-icon'
        icon.width = 64
        icon.height = 64
        slot.appendChild(icon)
        this.toolIcons.set(tool, icon)
      }

      const label = document.createElement('div')
      label.className = 'inventory-slot-label'
      label.textContent = t(TOOL_LABEL_KEYS[tool])
      slot.appendChild(label)

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
    } else if (tab === 'worldmap') {
      this.renderWorldMap()
    } else {
      if (tab === 'tools') this.renderToolIcons()
      else if (tab === 'info') this.renderInfo()
      this.menu.clearActionHotkeys()
    }
  }

  // Reuses the same stats+avatar block as EntityInfoModalManager/NpcOrdersManager so the
  // hero's own level/XP/equipment stats don't need a second implementation — the hero can't
  // open its own entity-info modal (EntityInfoModalManager rejects that target), so this tab
  // is the only place to see them.
  renderInfo(): void {
    this.infoPanel.replaceChildren()
    const entity = this.menu.context.controls.heroUnit || this.menu.selection
    if (!entity?.interface?.info) return
    this.infoPanel.appendChild(createEntityInfoContent(this.menu.context.app, entity, { showAllXp: true }))
  }

  getWorldColorLabel(color: WorldColor): string {
    switch (color) {
      case 'blue':
        return t('worldMapBluePortal')
      case 'yellow':
        return t('worldMapYellowPortal')
      case 'red':
        return t('worldMapRedPortal')
      default:
        return t('worldMapRoot')
    }
  }

  getWorldEnvironmentLabel(environment?: string | null): string | null {
    switch (environment) {
      case 'Temperate':
        return t('worldMapEnvironmentTemperate')
      case 'BlackForest':
        return t('worldMapEnvironmentBlackForest')
      case 'Jungle':
        return t('worldMapEnvironmentJungle')
      case 'Desert':
        return t('worldMapEnvironmentDesert')
      default:
        return null
    }
  }

  getFactionRelationIcon(state: FactionRelationState): string {
    switch (state) {
      case 'hostile':
        return '⚔'
      case 'wary':
        return '!'
      case 'friendly':
        return '♥'
      case 'allied':
        return '♥♥'
      default:
        return '○'
    }
  }

  getFactionRelationText(state: FactionRelationState): string {
    switch (state) {
      case 'hostile':
        return t('worldMapRelationHostile')
      case 'wary':
        return t('worldMapRelationWary')
      case 'friendly':
        return t('worldMapRelationFriendly')
      case 'allied':
        return t('worldMapRelationAllied')
      default:
        return t('worldMapRelationNeutral')
    }
  }

  getFactionRelationLabel(faction: FactionSave): string {
    return `${this.getFactionRelationIcon(faction.relationState)} ${this.getFactionRelationText(faction.relationState)} ${faction.relationScore}`
  }

  renderWorldMapNode(
    graph: WorldGraphSave,
    node: WorldGraphNode,
    currentWorldId: string | null,
    depth = 0
  ): HTMLLIElement {
    const item = document.createElement('li')
    item.className = 'worldmap-node'
    item.style.setProperty('--worldmap-depth', String(depth))
    item.classList.toggle('current', node.id === currentWorldId)
    item.classList.add(`worldmap-node-${node.color}`)

    const row = document.createElement('div')
    row.className = 'worldmap-node-row'

    const marker = document.createElement('span')
    marker.className = 'worldmap-node-marker'
    marker.setAttribute('aria-hidden', 'true')

    const body = document.createElement('span')
    body.className = 'worldmap-node-body'

    const name = document.createElement('span')
    name.className = 'worldmap-node-name'
    name.textContent = node.name

    const meta = document.createElement('span')
    meta.className = 'worldmap-node-meta'
    const parts = [this.getWorldColorLabel(node.color)]
    const environmentLabel = this.getWorldEnvironmentLabel(node.environment)
    if (environmentLabel) parts.push(environmentLabel)
    if (node.id === currentWorldId) parts.push(t('worldMapCurrentWorld'))
    if (node.canTeleport) parts.push(t('worldMapTeleportAvailable'))
    meta.textContent = parts.join(' | ')

    body.appendChild(name)
    body.appendChild(meta)

    const factions = (node.factionIds ?? [])
      .map(id => this.menu.context.getCampaignFactions?.()?.[id])
      .filter(Boolean) as FactionSave[]
    if (factions.length) {
      const factionList = document.createElement('span')
      factionList.className = 'worldmap-node-factions'
      for (const faction of factions) {
        const badge = document.createElement('span')
        badge.className = `worldmap-faction worldmap-faction-${faction.relationState}`
        const civ = faction.civilization ? ` | ${faction.civilization}` : ''
        badge.textContent = `${this.getFactionRelationLabel(faction)} | ${faction.name}${civ}`
        factionList.appendChild(badge)
      }
      body.appendChild(factionList)
    }

    row.appendChild(marker)
    row.appendChild(body)
    item.appendChild(row)

    const children = node.children.map(id => graph.nodes[id]).filter(Boolean)
    if (children.length) {
      const list = document.createElement('ul')
      list.className = 'worldmap-children'
      children.forEach(child => list.appendChild(this.renderWorldMapNode(graph, child, currentWorldId, depth + 1)))
      item.appendChild(list)
    }

    return item
  }

  renderWorldMap(): void {
    this.worldMapPanel.replaceChildren()
    this.menu.clearActionHotkeys()

    const graph = this.menu.context.getWorldGraph?.()
    const root = graph ? graph.nodes[graph.rootWorldId] : null
    if (!graph || !root) {
      const empty = document.createElement('div')
      empty.className = 'worldmap-empty'
      empty.textContent = t('worldMapEmpty')
      this.worldMapPanel.appendChild(empty)
      return
    }

    const tree = document.createElement('ul')
    tree.className = 'worldmap-tree'
    tree.appendChild(this.renderWorldMapNode(graph, root, this.menu.context.getCurrentWorldId?.() ?? null))
    this.worldMapPanel.appendChild(tree)
  }

  // Equipment art is global (no civ/player variation, unlike unit/building
  // avatars), so unlike renderTechnologies()/renderConstruction() this only
  // needs to run once — not rebuilt every time the tab is shown.
  renderToolIcons(): void {
    if (this.toolIconsRendered) return
    this.toolIconsRendered = true
    const { app } = this.menu.context
    for (const [tool, canvas] of this.toolIcons) {
      const equipment = getEquippedItemWeapon(tool, this.menu.context.player?.age ?? 0)
      if (equipment) renderEquipmentAvatar(app, equipment, canvas)
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
    const disabled = button.disabled?.() ?? false
    const acquired = button.acquired?.() ?? false
    element.type = 'button'
    element.className = 'ui-btn ui-action-row'
    element.classList.toggle('is-acquired', acquired)
    element.setAttribute('aria-disabled', String(disabled))
    element.setAttribute('aria-pressed', String(acquired))
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

    if (hotkey) {
      const badge = document.createElement('span')
      badge.className = 'technology-menu-hotkey'
      badge.textContent = hotkey.toUpperCase()
      element.appendChild(badge)
    }

    element.appendChild(icon)
    element.appendChild(label)
    element.appendChild(meta)

    if (button.tooltip) this.menu.menuTooltip.bind(element, button.tooltip)
    element.addEventListener('pointerup', evt => {
      if (button.disabled?.()) return
      this.menu.playUiClick()
      button.onClick?.(selection, evt)
      this.renderTechnologies()
    })
    return element
  }

  renderTechnologies(): void {
    const selection = this.menu.context.controls.heroUnit || this.menu.selection
    this.technologiesPanel.textContent = ''
    this.menu.clearActionHotkeys()
    if (!selection) return

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
  }

  syncTechnologyProgress(): void {}

  renderConstruction(): void {
    const selection = this.menu.context.controls.heroUnit || this.menu.selection
    this.constructionPanel.textContent = ''
    this.menu.clearActionHotkeys()
    if (!selection) return

    const { app, player } = this.menu.context
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
        // createMenuButton skips its own click wiring when `onCreate` is set (it
        // assumes a custom onCreate handles interactivity itself), so the avatar
        // is swapped in afterward on the default icon <img> instead of replacing
        // icon creation — that keeps the normal click/tooltip/hotkey wiring intact.
        const element = this.menu.createActionMenuButton(selection, actionButton, index, hotkey, () => {})
        if (button.id) {
          const icon = element.querySelector<HTMLImageElement>('.img')
          const canvas = document.createElement('canvas')
          canvas.width = 120
          canvas.height = 120
          if (icon && renderBuildingAvatar(app, button.id, player, canvas)) {
            icon.src = canvas.toDataURL()
          }
        }
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
