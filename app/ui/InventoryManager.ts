import { Modal } from '../lib'
import { getIconPath } from '../lib/graphics/assets'
import {
  getAvailableHeroCraftRecipes,
  canCraftHeroRecipe,
  craftHeroRecipe,
  getMissingCraftResources,
  type HeroCraftRecipe,
} from '../lib/hero/heroCrafting'
import { getPlaceableInventoryBuildingType } from '../lib/hero/placeableInventoryItems'
import { t } from '../lib/lang'
import { playUiSound } from '../lib/audio/uiSound'
import { RESOURCE_ICON_IDS, SOUND_CUES } from '../constants'
import { createEntityInfoContent } from './EntityInfoModalManager'
import {
  EQUIPPED_ITEM_WEAPON,
  getEquippedItemWeapon,
  HERO_TOOL_ORDER,
  isHeroToolAvailable,
  type HeroEquippedItem,
} from '../lib/hero/heroTools'
import { getWeaponSlot, unequipHeroActiveWeaponSlot } from '../lib/equipment/equipmentLoot'
import { AGE_PROGRESSION, isAgeObjectiveComplete, type AgeObjectiveDefinition } from '../lib/objectives/ageObjectives'
import { ModalTabs } from './Tabs'
import { capitalizeFirstLetter } from '../lib/extra'
import { getPlayerResourceTotals } from '../lib/resources/playerResourceTotals'
import { renderInventoryWorldMap } from './InventoryWorldMap'
import { getInventoryConstructionButtons, renderInventoryConstruction } from './InventoryConstruction'
import { renderMinimapLegend } from './minimap/MinimapLegend'
import { renderMinimapResourcePanel } from './minimap/MinimapResourcePanel'
import {
  renderInventoryEquippedEquipment,
  renderInventoryLootedEquipment,
} from './inventory/InventoryEquipmentRenderer'
import { appendInventoryEmptyIcon, createInventoryActionRow } from './inventory/InventoryActionRow'
import { createInventoryEquipmentIcon } from './inventory/InventoryItemIcons'
import { createEquipmentRowInfo } from './inventory/InventoryTooltips'
import { renderEquipmentAvatarLazy } from './equipment/EquipmentAvatar'
import { renderBuildingAvatar } from '../lib/avatar'
import type { UnitEntity } from '../types/entities'
import type { ResourceAmount } from '../types/common'
import type { MenuButtonSpec } from '../types/ui'
import type { MenuHost } from './MenuHost'

type ActionMenuTab = 'info' | 'tools' | 'craft' | 'progression' | 'minimap' | 'worldmap' | 'construction'

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
  craftPanel: HTMLDivElement
  constructionPanel: HTMLDivElement
  progressionPanel: HTMLDivElement
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
    this.craftPanel = document.createElement('div')
    this.craftPanel.className = 'action-menu-page action-menu-craft-page'
    this.progressionPanel = document.createElement('div')
    this.progressionPanel.className = 'action-menu-page action-menu-progression-page'
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
        { id: 'craft', label: t('inventoryTabCraft'), page: this.craftPanel },
        { id: 'progression', label: t('inventoryTabProgression'), page: this.progressionPanel },
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
      this.menu.activateMiniMap()
      this.menu.clearActionHotkeys()
      this.renderMinimapLegend()
      this.renderMinimapResources()
      return
    }

    this.menu.deactivateMiniMap()

    if (tab === 'progression') {
      this.renderProgression()
    } else if (tab === 'craft') {
      this.renderCraft()
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

  renderWorldMap(): void {
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
    if (tool === 'bow' && !hero?.inventory?.equipped?.arrow) return undefined
    return getEquippedItemWeapon(tool, this.menu.context.player?.age ?? 0, hero)
  }

  isActiveWeaponAvailable(tool: HeroEquippedItem): boolean {
    if (tool === 'interact') return true
    return Boolean(
      this.getActiveWeaponEquipment(tool) && isHeroToolAvailable(this.menu.context.controls.heroUnit, tool)
    )
  }

  renderToolIcons(): void {
    const { app } = this.menu.context
    for (const [tool, slot] of this.slots) {
      const available = this.isActiveWeaponAvailable(tool)
      slot.classList.toggle('empty', !available && tool !== 'interact')
    }
    for (const [tool, canvas] of this.toolIcons) {
      const equipment = this.getActiveWeaponEquipment(tool)
      canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height)
      if (equipment) renderEquipmentAvatarLazy(app, equipment, canvas, 'inventory', this.menu.context.performance)
      const info = equipment ? createEquipmentRowInfo(equipment) : undefined

      const description = this.slots.get(tool)?.querySelector<HTMLSpanElement>('.inventory-action-row-description')
      if (description) description.textContent = info?.title ?? ''
      const meta = this.slots.get(tool)?.querySelector<HTMLSpanElement>('.inventory-action-row-meta')
      if (meta) meta.textContent = info?.meta ?? ''
    }
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

    const title = document.createElement('div')
    title.className = 'inventory-loot-title'
    title.textContent = t('inventoryActiveWeapons')
    this.weaponPanel.appendChild(title)

    const list = document.createElement('div')
    list.className = 'inventory-loot-list'
    for (const tool of HERO_TOOL_ORDER) {
      const available = this.isActiveWeaponAvailable(tool)
      const equipment = this.getActiveWeaponEquipment(tool)
      const info = equipment ? createEquipmentRowInfo(equipment) : undefined
      const weaponSlot = equipment ? getWeaponSlot(equipment) : null
      const { element, icon } = createInventoryActionRow(this.menu, {
        id: `inventory-tool-${tool}`,
        className: 'inventory-weapon-row',
        title: t(TOOL_LABEL_KEYS[tool]),
        description: info?.title ?? (tool === 'interact' ? '' : t('inventoryEmptySlot')),
        meta: info?.meta,
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

  createObjectiveItem(objective: AgeObjectiveDefinition): HTMLElement {
    const acquired = isAgeObjectiveComplete(this.menu.context.player, objective.id)
    const { element, icon } = createInventoryActionRow(this.menu, {
      id: `inventory-objective-${objective.id}`,
      className: 'progression-objective-row',
      title: t(objective.labelKey),
      description: t(objective.descriptionKey),
    })
    element.classList.toggle('is-acquired', acquired)
    icon.classList.add('progression-objective-marker', acquired ? 'is-acquired' : 'is-pending')
    icon.setAttribute('aria-hidden', 'true')
    return element
  }

  createAgeMilestone(labelKey: string, reached: boolean): HTMLElement {
    const milestone = document.createElement('div')
    milestone.id = `inventory-age-${labelKey}`
    milestone.className = 'inventory-section-header progression-age'
    milestone.classList.toggle('is-acquired', reached)

    const title = document.createElement('div')
    title.className = 'inventory-loot-title progression-age-title'
    title.textContent = t(labelKey)

    const status = document.createElement('span')
    status.className = 'progression-age-status'
    status.textContent = t(reached ? 'progressionReached' : 'progressionUpcoming')

    milestone.append(title, status)
    return milestone
  }

  renderProgression(): void {
    this.progressionPanel.textContent = ''
    this.menu.clearActionHotkeys()
    const player = this.menu.context.player
    this.progressionPanel.appendChild(this.createAgeMilestone('stoneAge', true))
    for (const stage of AGE_PROGRESSION) {
      const step = document.createElement('section')
      step.className = 'progression-step'
      step.classList.toggle('is-current', player.age === stage.age - 1)
      step.classList.toggle('is-complete', player.age >= stage.age)
      const heading = document.createElement('div')
      heading.className = 'progression-section-title'
      const completed = stage.objectives.filter(objective => isAgeObjectiveComplete(player, objective.id)).length
      heading.textContent = stage.objectives.length
        ? t('progressionObjectives', { completed, total: stage.objectives.length })
        : t('progressionComingSoon')
      step.appendChild(heading)
      for (const objective of stage.objectives) {
        step.appendChild(this.createObjectiveItem(objective))
      }
      this.progressionPanel.appendChild(step)
      this.progressionPanel.appendChild(this.createAgeMilestone(stage.labelKey, player.age >= stage.age))
    }
  }

  getCraftCostMetaParts(cost: ResourceAmount, hero: UnitEntity | null | undefined): Array<{ text: string; className: string }> {
    const { player } = this.menu.context
    const totals = getPlayerResourceTotals(player, { hero, includeHero: Boolean(hero) })
    const formatResourceLabel = (resource: string): string => capitalizeFirstLetter(t(resource))
    const parts = Object.entries(cost)
      .map(([resource, amount]) => {
        const needed = Math.max(0, Math.floor(amount ?? 0))
        if (needed <= 0) return null
        const available = Math.max(0, Math.floor((totals[resource as keyof ResourceAmount] ?? 0)))
        const hasEnough = available >= needed
        return {
          text: `${formatResourceLabel(resource)} ${available}/${needed}`,
          className: hasEnough ? 'inventory-cost-is-available' : 'inventory-cost-is-missing',
        }
      })
      .filter((part): part is { text: string; className: string } => Boolean(part))
    return parts
  }

  getCraftMissingResourceMessage(cost: ResourceAmount): string {
    const { player } = this.menu.context
    const hero = this.menu.context.controls.heroUnit
    const missing = getMissingCraftResources(player, cost, hero)
    const resource = Object.keys(missing)
      .map(key => t(key))
      .join(', ')
    return t('needMore', { resource })
  }

  createCraftButton(recipe: HeroCraftRecipe): HTMLElement {
    const { app, player } = this.menu.context
    const hero = this.menu.context.controls.heroUnit
    const disabled = !hero || !canCraftHeroRecipe(player, recipe, hero)
    const { element, icon } = createInventoryActionRow(this.menu, {
      id: `craft-${recipe.id}`,
      className: 'inventory-craft-row',
      disabled,
      title: t(recipe.labelKey),
      description: t(recipe.descriptionKey ?? 'craftArrowDescription'),
      meta: '',
      metaParts: this.getCraftCostMetaParts(recipe.cost, hero),
      trailingAction: {
        disabled,
        label: t('inventoryTabCraft'),
        onClick: () => {
          if (!hero) return
          if (!craftHeroRecipe(player, hero, recipe)) {
            this.menu.showMessage(this.getCraftMissingResourceMessage(recipe.cost), 'warning')
            this.renderCraft()
            return
          }
          this.menu.updateTopbar?.()
          this.menu.showMessage(
            t('craftRecipeSuccess', { item: t(recipe.labelKey), count: recipe.outputCount }),
            'success'
          )
          this.renderCraft()
        },
      },
    })
    const placeableBuildingType = getPlaceableInventoryBuildingType(recipe.outputEquipment)
    if (recipe.iconResource) {
      const resourceIcon = document.createElement('img')
      resourceIcon.className = 'img inventory-resource-icon'
      resourceIcon.src = getIconPath(RESOURCE_ICON_IDS[recipe.iconResource].commodity)
      resourceIcon.alt = ''
      icon.appendChild(resourceIcon)
    } else {
      if (placeableBuildingType) {
        const img = document.createElement('img')
        img.className = 'img'
        img.alt = ''
        const canvas = document.createElement('canvas')
        canvas.width = 120
        canvas.height = 120
        renderBuildingAvatar(app, placeableBuildingType, player, canvas)
        img.src = canvas.toDataURL()
        icon.appendChild(img)
      } else {
        icon.appendChild(createInventoryEquipmentIcon(this.menu.context, recipe.outputEquipment, 'craft'))
      }
    }
    return element
  }

  renderCraft(): void {
    this.craftPanel.textContent = ''
    this.menu.clearActionHotkeys()
    for (const recipe of getAvailableHeroCraftRecipes(this.menu.context.player)) {
      this.craftPanel.appendChild(this.createCraftButton(recipe))
    }
  }

  syncObjectiveProgress(): void {
    if (this.opened && this.activeTab === 'progression') this.renderProgression()
    if (this.opened && this.activeTab === 'craft') this.renderCraft()
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
    for (const [tool, slot] of this.slots) {
      slot.classList.toggle('active', tool === equippedTool)
    }
    if (this.activeTab === 'tools') this.renderLootedEquipment()
    if (this.activeTab === 'craft') this.renderCraft()
    if (this.activeTab === 'minimap') this.renderMinimapResources()
  }

  refresh(): void {
    if (!this.opened) return
    if (this.activeTab === 'construction') this.renderConstruction()
    if (this.activeTab === 'tools') this.renderTools()
    if (this.activeTab === 'info') this.renderInfo()
    if (this.activeTab === 'craft') this.renderCraft()
  }

  destroy(): void {
    this.modal?.close()
    this.modal = undefined
    this.restoreMinimap()
  }
}
