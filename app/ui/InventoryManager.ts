import { createInventorySectionTitle } from './inventory/InventorySection'
import { SOUND_CUES } from '../constants'
import { getIconPath } from '../lib/graphics/assets'
import { Modal } from '../lib'
import { playUiSound } from '../lib/audio/uiSound'
import { heroCanCommand } from '../lib/chief'
import { getWeaponSlot, unequipHeroActiveWeaponSlot } from '../lib/equipment/equipmentLoot'
import {
  EQUIPPED_ITEM_WEAPON,
  getEquippedItemWeapon,
  HERO_TOOL_ORDER,
  isHeroToolAvailable,
  type HeroEquippedItem,
} from '../lib/hero/heroTools'
import { t } from '../lib/lang'
import { getActiveColonyAlerts } from '../lib/world/regionAlerts'
import type { MenuButtonSpec } from '../types/ui'
import { createEntityInfoContent } from './EntityInfoContent'
import { appendInventoryEmptyIcon } from './inventory/InventoryActionRow'
import { createEquipmentRowInfo } from './inventory/InventoryDetails'
import {
  renderInventoryEquippedEquipment,
  renderInventoryLootedEquipment,
} from './inventory/InventoryEquipmentRenderer'
import { createInventoryEquipmentRow } from './inventory/InventoryItemRows'
import { renderInventoryToolIcons } from './inventory/InventoryToolIcons'
import { getInventoryConstructionButtons, renderInventoryConstruction } from './InventoryConstruction'
import { renderInventoryWorldMap } from './InventoryWorldMap'
import type { MenuHost } from './MenuHost'
import { renderMinimapLegend } from './minimap/MinimapLegend'
import { renderMinimapResourcePanel } from './minimap/MinimapResourcePanel'
import { createQuestMarker } from './questMarker'
import { ModalTabs } from './Tabs'

type ActionMenuTab = 'info' | 'tools' | 'minimap' | 'worldmap' | 'construction'

const CHIEF_TABS = new Set<ActionMenuTab>(['worldmap'])

const TOOL_LABEL_KEYS: Record<HeroEquippedItem, string> = {
  interact: 'heroToolInteract',
  sword: 'heroToolSword',
  bow: 'heroToolBow',
}

const FREE_HAND_ICON = '003_50721'

export class InventoryManager {
  menu: MenuHost
  panel: HTMLDivElement
  modalTabs: ModalTabs<ActionMenuTab>
  infoPanel: HTMLDivElement
  toolsPanel: HTMLDivElement
  minimapPanel: HTMLDivElement
  worldMapPanel: HTMLDivElement
  constructionPanel: HTMLDivElement
  weaponPanel: HTMLDivElement
  equippedPanel: HTMLDivElement
  lootedEquipmentPanel: HTMLDivElement
  minimapLayout: HTMLDivElement
  minimapLegend: HTMLDivElement
  minimapResources: HTMLDivElement
  slots: Map<HeroEquippedItem, HTMLElement>
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
    this.constructionPanel = document.createElement('div')
    this.constructionPanel.className = 'action-menu-page action-menu-construction-page'
    this.weaponPanel = document.createElement('div')
    this.weaponPanel.className = 'inventory-weapon-section'
    this.equippedPanel = document.createElement('div')
    this.equippedPanel.className = 'inventory-equipped-section'
    this.lootedEquipmentPanel = document.createElement('div')
    this.lootedEquipmentPanel.className = 'inventory-loot-section'
    this.minimapLayout = document.createElement('div')
    this.minimapLayout.className = 'minimap-panel-layout'
    this.minimapLegend = document.createElement('div')
    this.minimapLegend.className = 'minimap-legend'
    this.minimapResources = document.createElement('div')
    this.minimapResources.className = 'minimap-resources minimap-legend'

    this.modalTabs = new ModalTabs<ActionMenuTab>(
      [
        { id: 'info', label: t('inventoryTabInfo'), page: this.infoPanel },
        { id: 'tools', label: t('inventoryTabTools'), page: this.toolsPanel },
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
    this.toolsPanel.appendChild(this.equippedPanel)
    this.toolsPanel.appendChild(this.lootedEquipmentPanel)

    this.panel.appendChild(this.modalTabs.element)
    this.minimapLayout.append(menu.minimapWrap, this.minimapLegend, this.minimapResources)
    this.minimapPanel.appendChild(this.minimapLayout)
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
      gameWindow: true,
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
    if (!this.menu.context.controls.mouseBuilding) this.menu.updateActionTarget()
    if (this.pausedByMenu) {
      this.pausedByMenu = false
      this.menu.context.resume?.()
    }
  }

  isOpen(): boolean {
    return this.opened
  }

  private syncTabAvailability(): boolean {
    const isChief = heroCanCommand(this.menu.context.controls.heroUnit)
    for (const id of CHIEF_TABS) {
      const button = this.modalTabs.tabs.buttons.get(id)
      if (!button) continue
      button.hidden = !isChief
      button.disabled = !isChief
      button.classList.toggle('hidden', !isChief)
    }
    this.syncWorldMapAlertBadge()
    return isChief
  }

  private syncWorldMapAlertBadge(): void {
    const button = this.modalTabs.tabs.buttons.get('worldmap')
    if (!button) return
    const hasAlerts = getActiveColonyAlerts(this.menu.context).length > 0
    const existing = button.querySelector('.quest-marker')
    if (hasAlerts && !existing) button.appendChild(createQuestMarker())
    else if (!hasAlerts && existing) existing.remove()
  }

  showTab(tab: ActionMenuTab): void {
    const isChief = this.syncTabAvailability()
    if (!isChief && CHIEF_TABS.has(tab)) tab = 'tools'
    this.activeTab = tab
    this.modalTabs.setActive(tab, { emit: false })

    if (tab === 'minimap') {
      this.menu.activateMiniMap()
      this.menu.clearActionHotkeys()
      this.renderMinimapLegend()
      this.renderMinimapResources()
      return
    }

    this.menu.deactivateMiniMap()

    if (tab === 'construction') {
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

  renderWorldMap(): void {
    // The current region's colony summary (idleWorkers, stocks…) is otherwise only refreshed on
    // day-change/region-travel, so it can lag behind what the player sees live on their own map.
    this.menu.context.updateWorldEconomy?.()
    renderInventoryWorldMap(this.worldMapPanel, this.menu)
  }

  renderMinimapLegend(): void {
    renderMinimapLegend(this.minimapLegend, this.menu.context.player)
  }

  renderMinimapResources(): void {
    renderMinimapResourcePanel(this.minimapResources, this.menu)
  }

  getActiveWeaponEquipment(tool: HeroEquippedItem): string | undefined {
    const hero = this.menu.context.controls.heroUnit
    return getEquippedItemWeapon(tool, this.menu.context.player?.age ?? 0, hero)
  }

  isActiveWeaponAvailable(tool: HeroEquippedItem): boolean {
    if (tool === 'interact') return true
    return Boolean(
      this.getActiveWeaponEquipment(tool) && isHeroToolAvailable(this.menu.context.controls.heroUnit, tool)
    )
  }

  renderToolIcons(): void {
    return renderInventoryToolIcons.call(this)
  }

  renderLootedEquipment(): void {
    renderInventoryLootedEquipment(this)
  }

  renderEquippedEquipment(): void {
    renderInventoryEquippedEquipment(this)
  }

  renderActiveWeapons(): void {
    this.weaponPanel.replaceChildren()
    this.slots.clear()
    this.toolIcons.clear()

    this.weaponPanel.appendChild(createInventorySectionTitle(t('inventoryActiveWeapons')))

    const list = document.createElement('div')
    list.className = 'inventory-section-list'
    for (const tool of HERO_TOOL_ORDER) {
      const available = this.isActiveWeaponAvailable(tool)
      const equipment = this.getActiveWeaponEquipment(tool)
      const info = equipment ? createEquipmentRowInfo(equipment, 1, undefined, { showValue: false }) : undefined
      const weaponSlot = equipment ? getWeaponSlot(equipment) : null
      const { element, icon } = createInventoryEquipmentRow(this.menu.context, this.menu, {
        equipment: equipment ?? '',
        count: equipment ? 1 : 0,
        icon: document.createElement('span'),
        id: `inventory-tool-${tool}`,
        className: 'inventory-weapon-row',
        title: t(TOOL_LABEL_KEYS[tool]),
        description: info?.title ?? (tool === 'interact' ? '' : t('inventoryEmptySlot')),
        meta: equipment ? undefined : '',
        trailingAction:
          equipment && weaponSlot
            ? {
                label: t('inventoryUnequipAction'),
                onClick: () => {
                  const hero = this.menu.context.controls.heroUnit
                  if (!unequipHeroActiveWeaponSlot(hero, weaponSlot)) return
                  this.menu.updateHeroStatus?.(hero)
                  this.renderTools()
                },
              }
            : undefined,
      })
      element.classList.toggle('empty', !available && tool !== 'interact')
      if (EQUIPPED_ITEM_WEAPON[tool] && equipment) {
        const canvas = document.createElement('canvas')
        canvas.className = 'img'
        canvas.width = 64
        canvas.height = 64
        icon.appendChild(canvas)
        this.toolIcons.set(tool, canvas)
      } else if (tool === 'interact') {
        const image = document.createElement('img')
        image.className = 'img'
        image.src = getIconPath(FREE_HAND_ICON)
        image.alt = ''
        icon.appendChild(image)
      } else {
        appendInventoryEmptyIcon(icon)
      }
      this.slots.set(tool, element)
      list.appendChild(element)
    }
    this.weaponPanel.appendChild(list)
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
    return getInventoryConstructionButtons(this.menu)
  }

  renderConstruction(): void {
    renderInventoryConstruction(this)
  }

  selectTool(tool: HeroEquippedItem): void {
    if (!isHeroToolAvailable(this.menu.context.controls.heroUnit, tool)) return
    playUiSound(SOUND_CUES.ui.menuClick)
    this.menu.context.controls.setEquippedItem?.(tool)
    this.menu.context.controls.setEquippedTool?.(tool)
    this.close()
  }

  render(equippedTool: HeroEquippedItem | null): void {
    if (!this.syncTabAvailability() && CHIEF_TABS.has(this.activeTab)) this.showTab('tools')
    for (const [tool, slot] of this.slots) {
      slot.classList.toggle('active', tool === equippedTool)
    }
    if (this.activeTab === 'tools') this.renderLootedEquipment()
    if (this.activeTab === 'minimap') this.renderMinimapResources()
  }

  refresh(): void {
    if (!this.opened) return
    if (this.activeTab === 'construction') this.renderConstruction()
    if (this.activeTab === 'tools') this.renderTools()
    if (this.activeTab === 'info') this.renderInfo()
  }

  destroy(): void {
    this.modal?.close()
    this.modal = undefined
    this.restoreMinimap()
  }
}
