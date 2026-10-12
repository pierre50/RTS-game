import { MinimapNavigation } from './minimap/MinimapNavigation'
import { HeroInventoryCraftingBody } from './inventory/HeroInventoryCraftingBody'
import { arrangeInventoryEquipment } from './inventory/InventoryRpgLayout'
import { createInventorySectionTitle } from './inventory/InventorySection'
import { Modal } from '../lib'
import { getWeaponSlot, unequipHeroActiveWeaponSlot } from '../lib/equipment/equipmentLoot'
import {
  getEquippedItemWeapon,
  HERO_TOOL_ORDER,
  isHeroToolAvailable,
  type HeroEquippedItem,
} from '../lib/hero/heroTools'
import { t } from '../lib/lang'
import { getActiveInteractionSpace } from '../lib/mapSpaces'
import { isBuildingInteriorRuntimeSpace } from '../../engine/services/BuildingInteriorSpaceLookup'
import type { MenuButtonSpec } from '../types/ui'
import { createEntityInfoContent } from './inspection/EntityInfoContent'
import { appendInventoryEmptyIcon } from './inventory/InventoryActionRow'
import { createEquipmentRowInfo } from './inventory/InventoryDetails'
import {
  renderInventoryEquippedEquipment,
  renderInventoryLootedEquipment,
} from './inventory/InventoryEquipmentRenderer'
import { createInventoryEquipmentRow } from './inventory/InventoryItemRows'
import { renderInventoryToolIcons } from './inventory/InventoryToolIcons'
import { getInventoryConstructionButtons, renderInventoryConstruction } from './InventoryConstruction'
import type { MenuHost } from './MenuHost'
import { renderMinimapLegend } from './minimap/MinimapLegend'
import { ModalTabs } from './Tabs'

type ActionMenuTab = 'info' | 'tools' | 'minimap' | 'construction' | 'craft'

const TOOL_LABEL_KEYS: Record<HeroEquippedItem, string> = {
  interact: 'heroToolInteract',
  sword: 'heroToolSword',
  bow: 'heroToolBow',
}

export class InventoryManager {
  menu: MenuHost
  panel: HTMLDivElement
  modalTabs: ModalTabs<ActionMenuTab>
  infoPanel: HTMLDivElement
  toolsPanel: HTMLDivElement
  minimapPanel: HTMLDivElement
  craftingBody: HeroInventoryCraftingBody
  constructionPanel: HTMLDivElement
  weaponPanel: HTMLDivElement
  equippedPanel: HTMLDivElement
  lootedEquipmentPanel: HTMLDivElement
  minimapLayout: HTMLDivElement
  minimapLegend: HTMLDivElement
  minimapSymbols: HTMLDivElement
  private readonly mapNavigation: MinimapNavigation
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
    this.toolsPanel.className = 'action-menu-page inventory-tools-page inventory-rpg'
    this.minimapPanel = document.createElement('div')
    this.minimapPanel.className = 'action-menu-page action-menu-minimap-page'
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
    this.minimapSymbols = document.createElement('div')
    this.minimapSymbols.className = 'minimap-shape-legend'

    this.craftingBody = new HeroInventoryCraftingBody(menu, undefined)
    this.craftingBody.craftPanel.classList.add('action-menu-page')

    this.modalTabs = new ModalTabs<ActionMenuTab>(
      [
        { id: 'tools', label: t('inventoryTabTools'), page: this.toolsPanel },
        { id: 'craft', label: t('inventoryTabCraft'), page: this.craftingBody.craftPanel },
        { id: 'info', label: t('inventoryTabInfo'), page: this.infoPanel },
        { id: 'minimap', label: t('inventoryTabMinimap'), page: this.minimapPanel },
        { id: 'construction', label: t('inventoryTabConstruction'), page: this.constructionPanel },
      ],
      this.activeTab,
      tab => {
        this.showTab(tab)
      }
    )

    const equipmentColumn = document.createElement('div')
    equipmentColumn.className = 'inventory-character-column'
    equipmentColumn.append(this.equippedPanel, this.weaponPanel)
    const bagColumn = document.createElement('div')
    bagColumn.className = 'inventory-bag-column'
    const details = document.createElement('div')
    details.className = 'inventory-detail-dock'
    bagColumn.append(this.lootedEquipmentPanel, details)
    this.toolsPanel.setAttribute('data-window-hover-selection', '')
    this.toolsPanel.append(equipmentColumn, bagColumn)

    this.panel.appendChild(this.modalTabs.element)
    const mapColumn = document.createElement('div')
    mapColumn.className = 'minimap-map-column'
    mapColumn.append(menu.minimapWrap)
    this.minimapLayout.append(mapColumn, this.minimapLegend)
    this.minimapPanel.appendChild(this.minimapLayout)
    this.mapNavigation = new MinimapNavigation(menu, this.minimapPanel, () => this.renderMinimapLegend())
  }

  toggle(): void {
    if (this.opened) {
      this.close()
    } else {
      this.activeTab = 'tools'
      this.open()
    }
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
    if (this.activeTab === 'tools') {
      const initialSlot = this.modal._panel?.querySelector<HTMLElement>('[data-window-default]')
      if (initialSlot) {
        initialSlot.tabIndex = 0
        initialSlot.focus({ preventScroll: true })
      }
    }
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
    this.mapNavigation.deactivate()
    this.menu.deactivateMiniMap()
    this.menu.clearActionHotkeys()
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
    const space = getActiveInteractionSpace(this.menu.context)
    const canConstruct =
      space?.kind !== 'interior' ||
      (isBuildingInteriorRuntimeSpace(space) && space.building.owner === this.menu.context.player)
    const constructionTab = this.modalTabs.tabs.buttons.get('construction')!
    constructionTab.hidden = !canConstruct
    constructionTab.disabled = !canConstruct
    if (tab === 'construction' && !canConstruct) tab = 'tools'
    this.activeTab = tab
    this.modal?._panel?.classList.toggle('window-catalog', tab === 'construction' || tab === 'craft')
    this.modalTabs.setActive(tab, { emit: false })

    if (tab === 'minimap') {
      this.menu.activateMiniMap()
      this.menu.clearActionHotkeys()
      this.renderMinimapLegend()
      this.mapNavigation.activate()
      return
    }

    this.mapNavigation.deactivate()
    this.menu.deactivateMiniMap()

    if (tab === 'construction') {
      this.renderConstruction()
      const first = this.constructionPanel.querySelector<HTMLElement>('.inventory-construction-row')
      if (first) {
        first.setAttribute('data-window-default', '')
        first.tabIndex = 0
        first.focus({ preventScroll: true })
      }
    } else {
      if (tab === 'tools') this.renderTools()
      else if (tab === 'info') this.renderInfo()
      else if (tab === 'craft') this.craftingBody.renderCraft()
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
    this.infoPanel.appendChild(createEntityInfoContent(this.menu.context.app, entity))
  }

  renderMinimapLegend(): void {
    renderMinimapLegend(this.minimapLegend, this.menu, this.minimapSymbols, false)
  }

  getActiveWeaponEquipment(tool: HeroEquippedItem): string | undefined {
    const hero = this.menu.context.controls.heroUnit
    return getEquippedItemWeapon(tool, hero)
  }

  isActiveWeaponAvailable(tool: HeroEquippedItem): boolean {
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
      const { element, icon } = createInventoryEquipmentRow(this.menu.context, {
        equipment: equipment ?? '',
        count: equipment ? 1 : 0,
        icon: document.createElement('span'),
        id: `inventory-tool-${tool}`,
        className: 'inventory-weapon-row',
        title: t(TOOL_LABEL_KEYS[tool]),
        description: info?.title ?? t('inventoryEmptySlot'),
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
      element.classList.toggle('empty', !available)
      if (equipment) {
        const canvas = document.createElement('canvas')
        canvas.className = 'img'
        canvas.width = 64
        canvas.height = 64
        icon.appendChild(canvas)
        this.toolIcons.set(tool, canvas)
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
    arrangeInventoryEquipment(this)
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
    if (this.activeTab === 'construction') this.renderConstruction()
    if (this.activeTab === 'tools') this.renderTools()
    if (this.activeTab === 'info') this.renderInfo()
    if (this.activeTab === 'craft') this.craftingBody.renderCraft()
  }

  destroy(): void {
    this.mapNavigation.destroy()
    this.modal?.close()
    this.modal = undefined
    this.restoreMinimap()
  }
}
