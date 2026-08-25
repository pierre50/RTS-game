import { Modal } from '../lib'
import { renderBuildingAvatar, renderEquipmentAvatar, renderTextureRefAvatar } from '../lib/avatar'
import {
  equipHeroInventoryItem,
  formatEquipmentLootLabel,
  formatEquipmentStackLabel,
  getEquipmentSlot,
  getEquipmentStacks,
  getHeroEquipmentSlotLabelKey,
  getHeroEquippedItemCount,
  getWeaponSlot,
  HERO_EQUIPMENT_SLOTS,
  unequipHeroInventorySlot,
} from '../lib/equipmentLoot'
import { t } from '../lib/lang'
import { playUiSound } from '../lib/uiSound'
import { BUILDING_TYPES, SOUND_CUES } from '../constants'
import { createEntityInfoContent } from './EntityInfoModalManager'
import {
  EQUIPPED_ITEM_WEAPON,
  getEquippedItemWeapon,
  HERO_TOOL_ORDER,
  isHeroToolAvailable,
  type HeroEquippedItem,
} from '../lib/heroTools'
import { getReservedGameplayHotkeys } from '../lib/settings'
import { ModalTabs } from './Tabs'
import type { RuntimeEntity } from '../types/entities'
import type { FactionRelationState, FactionSave, WorldColor, WorldGraphNode, WorldGraphSave } from '../types/save'
import type { MenuButtonSpec } from '../types/ui'
import type { MenuHost } from './MenuHost'

type ActionMenuTab = 'info' | 'tools' | 'technologies' | 'minimap' | 'worldmap' | 'construction'

const WHEAT_FARM_AVATAR_REF = { sheet: 'resources/wheat', frame: 4 } as const

export function isHeroConstructionBuildingType(type: string): boolean {
  return !type.startsWith(BUILDING_TYPES.banditCamp)
}

const TOOL_LABEL_KEYS: Record<HeroEquippedItem, string> = {
  interact: 'heroToolInteract',
  sword: 'heroToolSword',
  bow: 'heroToolBow',
  lasso: 'heroToolLasso',
}

export class InventoryManager {
  menu: MenuHost
  panel: HTMLDivElement
  modalTabs: ModalTabs<ActionMenuTab>
  infoPanel: HTMLDivElement
  toolsPanel: HTMLDivElement
  minimapPanel: HTMLDivElement
  worldMapPanel: HTMLDivElement
  constructionPanel: HTMLDivElement
  technologiesPanel: HTMLDivElement
  weaponPanel: HTMLDivElement
  equippedPanel: HTMLDivElement
  lootedEquipmentPanel: HTMLDivElement
  slots: Map<HeroEquippedItem, HTMLButtonElement>
  toolIcons: Map<HeroEquippedItem, HTMLCanvasElement>
  toolIconsRendered: boolean
  modal?: Modal
  activeTab: ActionMenuTab
  opened: boolean
  pausedByMenu: boolean

  constructor(menu: MenuHost) {
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
    this.weaponPanel = document.createElement('div')
    this.weaponPanel.className = 'inventory-weapon-section'
    this.equippedPanel = document.createElement('div')
    this.equippedPanel.className = 'inventory-equipped-section'
    this.lootedEquipmentPanel = document.createElement('div')
    this.lootedEquipmentPanel.className = 'inventory-loot-section'

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

    this.toolsPanel.appendChild(this.weaponPanel)
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
    this.toolsPanel.appendChild(this.equippedPanel)
    this.toolsPanel.appendChild(this.lootedEquipmentPanel)

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
      if (tab === 'tools') this.renderTools()
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

  shouldShowBanditEncounter(node: WorldGraphNode): boolean {
    return node.encounter === 'bandit' && !node.banditsCleared
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

    const factions = (this.shouldShowBanditEncounter(node) ? [] : (node.factionIds ?? []))
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
    if (this.shouldShowBanditEncounter(node)) {
      const factionList = document.createElement('span')
      factionList.className = 'worldmap-node-factions'
      const badge = document.createElement('span')
      badge.className = 'worldmap-faction worldmap-faction-hostile'
      badge.textContent = `⚔ ${t('worldMapBandits')}`
      factionList.appendChild(badge)
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

  renderToolIcons(): void {
    const { app } = this.menu.context
    const hero = this.menu.context.controls.heroUnit
    for (const [tool, slot] of this.slots) {
      const available = isHeroToolAvailable(hero, tool)
      slot.disabled = !available
      slot.classList.toggle('empty', !available && tool !== 'interact')
    }
    for (const [tool, canvas] of this.toolIcons) {
      const equipment = getEquippedItemWeapon(tool, this.menu.context.player?.age ?? 0, hero)
      canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height)
      if (equipment) renderEquipmentAvatar(app, equipment, canvas)

      const label = this.slots.get(tool)?.querySelector<HTMLDivElement>('.inventory-slot-label')
      if (label) label.textContent = equipment ? formatEquipmentLootLabel(equipment) : t(TOOL_LABEL_KEYS[tool])
    }
  }

  renderLootedEquipment(): void {
    this.lootedEquipmentPanel.replaceChildren()
    const hero = this.menu.context.controls.heroUnit
    const equipment = hero?.inventory?.equipment ?? []
    if (!equipment.length) return

    const title = document.createElement('div')
    title.className = 'inventory-loot-title'
    title.textContent = t('inventoryBag')
    this.lootedEquipmentPanel.appendChild(title)

    const grid = document.createElement('div')
    grid.className = 'inventory-loot-grid'
    for (const stack of getEquipmentStacks(equipment)) {
      const item = stack.equipment
      const slot = document.createElement('button')
      const equipmentSlot = getEquipmentSlot(item)
      const weaponSlot = getWeaponSlot(item)
      const canEquip = Boolean(
        (equipmentSlot && (equipmentSlot !== 'helmetDecor' || hero?.inventory?.equipped?.helmet)) || weaponSlot
      )
      slot.type = 'button'
      slot.className = 'inventory-slot ui-btn inventory-loot-slot'
      slot.disabled = !canEquip
      if (canEquip) {
        slot.addEventListener('click', () => {
          if (!equipHeroInventoryItem(hero, item)) return
          this.menu.playUiClick()
          this.renderTools()
        })
      }

      const icon = document.createElement('canvas')
      icon.className = 'unit-avatar-frame inventory-slot-icon'
      icon.width = 64
      icon.height = 64
      renderEquipmentAvatar(this.menu.context.app, item, icon)

      const label = document.createElement('div')
      label.className = 'inventory-slot-label'
      label.textContent = formatEquipmentStackLabel(item, stack.count)

      slot.appendChild(icon)
      slot.appendChild(label)
      grid.appendChild(slot)
    }
    this.lootedEquipmentPanel.appendChild(grid)
  }

  renderEquippedEquipment(): void {
    this.equippedPanel.replaceChildren()
    const hero = this.menu.context.controls.heroUnit
    if (!hero) return

    const title = document.createElement('div')
    title.className = 'inventory-loot-title'
    title.textContent = t('inventoryEquippedEquipment')
    this.equippedPanel.appendChild(title)

    const grid = document.createElement('div')
    grid.className = 'inventory-equipped-grid'
    for (const slotId of HERO_EQUIPMENT_SLOTS) {
      const equipment = hero.inventory?.equipped?.[slotId]
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'inventory-slot ui-btn inventory-equipment-slot'
      button.classList.toggle('empty', !equipment)
      button.disabled = !equipment
      if (equipment) {
        button.addEventListener('click', () => {
          if (!unequipHeroInventorySlot(hero, slotId)) return
          this.menu.playUiClick()
          this.renderTools()
        })
      }

      const iconWrap = document.createElement('span')
      iconWrap.className = 'inventory-equipped-icon-wrap'
      if (equipment) {
        const icon = document.createElement('canvas')
        icon.className = 'unit-avatar-frame inventory-slot-icon'
        icon.width = 64
        icon.height = 64
        renderEquipmentAvatar(this.menu.context.app, equipment, icon)
        iconWrap.appendChild(icon)
      }

      const slotLabel = document.createElement('div')
      slotLabel.className = 'inventory-slot-type'
      slotLabel.textContent = t(getHeroEquipmentSlotLabelKey(slotId))

      const label = document.createElement('div')
      label.className = 'inventory-slot-label'
      label.textContent = equipment
        ? formatEquipmentStackLabel(equipment, getHeroEquippedItemCount(hero, slotId))
        : t('inventoryEmptySlot')

      button.appendChild(iconWrap)
      button.appendChild(slotLabel)
      button.appendChild(label)
      grid.appendChild(button)
    }
    this.equippedPanel.appendChild(grid)
  }

  renderActiveWeapons(): void {
    this.weaponPanel.replaceChildren()

    const title = document.createElement('div')
    title.className = 'inventory-loot-title'
    title.textContent = t('inventoryActiveWeapons')
    this.weaponPanel.appendChild(title)
  }

  renderTools(): void {
    this.renderActiveWeapons()
    this.renderToolIcons()
    this.renderEquippedEquipment()
    this.renderLootedEquipment()
  }

  restoreMinimap(): void {
    this.minimapPanel.appendChild(this.menu.minimapWrap)
  }

  getConstructionButtons(): MenuButtonSpec[] {
    const { player } = this.menu.context
    return Object.keys(player.config.buildings)
      .filter(isHeroConstructionBuildingType)
      .map(type => this.menu.getActionBuildingButton(type))
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
          const rendered =
            button.id === BUILDING_TYPES.farm
              ? renderTextureRefAvatar(app, WHEAT_FARM_AVATAR_REF, canvas)
              : renderBuildingAvatar(app, button.id, player, canvas)
          if (icon && rendered) {
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
    if (!isHeroToolAvailable(this.menu.context.controls.heroUnit, tool)) return
    playUiSound(SOUND_CUES.ui.menuClick)
    this.menu.context.controls.setEquippedItem?.(tool)
    this.menu.context.controls.setEquippedTool?.(tool)
    this.close()
  }

  render(equippedTool: HeroEquippedItem | null): void {
    for (const [tool, slot] of this.slots) {
      slot.classList.toggle('active', tool === equippedTool)
    }
    if (this.activeTab === 'tools') this.renderLootedEquipment()
  }

  refresh(): void {
    if (!this.opened) return
    if (this.activeTab === 'tools') this.renderTools()
    if (this.activeTab === 'info') this.renderInfo()
  }

  destroy(): void {
    this.modal?.close()
    this.modal = undefined
    this.restoreMinimap()
  }
}
