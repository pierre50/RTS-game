import { Modal } from '../lib'
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
} from '../lib/equipment/equipmentLoot'
import {
  HERO_ARROW_CRAFT_RECIPES,
  canCraftHeroRecipe,
  craftHeroRecipe,
  getMissingCraftResources,
  type HeroCraftRecipe,
} from '../lib/hero/heroCrafting'
import { t } from '../lib/lang'
import { playUiSound } from '../lib/audio/uiSound'
import { SOUND_CUES } from '../constants'
import { createEntityInfoContent } from './EntityInfoModalManager'
import {
  EQUIPPED_ITEM_WEAPON,
  getEquippedItemWeapon,
  HERO_TOOL_ORDER,
  isHeroToolAvailable,
  type HeroEquippedItem,
} from '../lib/hero/heroTools'
import { getReservedGameplayHotkeys } from '../lib/audio/settings'
import { ModalTabs } from './Tabs'
import { renderInventoryWorldMap } from './InventoryWorldMap'
import { getInventoryConstructionButtons, renderInventoryConstruction } from './InventoryConstruction'
import { renderEquipmentAvatarLazy } from './equipmentAvatar'
import type { RuntimeEntity } from '../types/entities'
import type { ResourceAmount } from '../types/common'
import type { MenuButtonSpec } from '../types/ui'
import type { MenuHost } from './MenuHost'

type ActionMenuTab = 'info' | 'tools' | 'craft' | 'technologies' | 'minimap' | 'worldmap' | 'construction'

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
  craftPanel: HTMLDivElement
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
    this.craftPanel = document.createElement('div')
    this.craftPanel.className = 'action-menu-page action-menu-craft-page'
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
        { id: 'craft', label: t('inventoryTabCraft'), page: this.craftPanel },
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
      this.menu.activateMiniMap()
      this.menu.clearActionHotkeys()
      return
    }

    this.menu.deactivateMiniMap()

    if (tab === 'technologies') {
      this.renderTechnologies()
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
      if (equipment) renderEquipmentAvatarLazy(app, equipment, canvas, 'inventory', this.menu.context.performance)

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
      renderEquipmentAvatarLazy(this.menu.context.app, item, icon, 'inventory', this.menu.context.performance)

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
      const requiresHelmet = slotId === 'helmetDecor' && !hero.inventory?.equipped?.helmet
      const disabled = !equipment || requiresHelmet
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'inventory-slot ui-btn inventory-equipment-slot'
      button.classList.toggle('empty', !equipment)
      button.disabled = disabled
      if (equipment && !disabled) {
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
        renderEquipmentAvatarLazy(this.menu.context.app, equipment, icon, 'inventory', this.menu.context.performance)
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
    return getInventoryConstructionButtons(this.menu)
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

  formatResourceAmount(cost: ResourceAmount): string {
    return Object.entries(cost)
      .map(([resource, amount]) => `${amount} ${t(resource)}`)
      .join(', ')
  }

  getCraftMissingResourceMessage(cost: ResourceAmount): string {
    const { player } = this.menu.context
    const missing = getMissingCraftResources(player, cost)
    const resource = Object.keys(missing)
      .map(key => t(key))
      .join(', ')
    return t('needMore', { resource })
  }

  createCraftButton(recipe: HeroCraftRecipe): HTMLButtonElement {
    const { app, player } = this.menu.context
    const hero = this.menu.context.controls.heroUnit
    const disabled = !hero || !canCraftHeroRecipe(player, recipe)
    const element = document.createElement('button')
    element.type = 'button'
    element.className = 'ui-btn ui-action-row inventory-craft-row'
    element.disabled = disabled
    element.setAttribute('aria-disabled', String(disabled))

    const icon = document.createElement('span')
    icon.className = 'technology-menu-icon inventory-craft-icon'
    const canvas = document.createElement('canvas')
    canvas.className = 'unit-avatar-frame inventory-slot-icon'
    canvas.width = 64
    canvas.height = 64
    renderEquipmentAvatarLazy(app, recipe.outputEquipment, canvas, 'craft', this.menu.context.performance)
    icon.appendChild(canvas)

    const label = document.createElement('span')
    label.className = 'technology-menu-label'
    label.textContent = t(recipe.labelKey)

    const meta = document.createElement('span')
    meta.className = 'technology-menu-meta'
    meta.textContent = t('craftRecipeMeta', {
      count: recipe.outputCount,
      cost: this.formatResourceAmount(recipe.cost),
    })

    element.appendChild(icon)
    element.appendChild(label)
    element.appendChild(meta)
    this.menu.menuTooltip.bind(element, {
      title: t(recipe.labelKey),
      description: t('craftArrowDescription'),
      meta: [t('tooltipCost', { cost: this.formatResourceAmount(recipe.cost) })],
    })
    element.addEventListener('pointerup', evt => {
      evt.preventDefault()
      evt.stopPropagation()
      if (!hero) return
      if (!craftHeroRecipe(player, hero, recipe)) {
        this.menu.showMessage(this.getCraftMissingResourceMessage(recipe.cost), 'warning')
        this.renderCraft()
        return
      }
      this.menu.playUiClick()
      this.menu.updateTopbar?.()
      this.menu.showMessage(t('craftRecipeSuccess', { item: t(recipe.labelKey), count: recipe.outputCount }), 'success')
      this.renderCraft()
    })
    return element
  }

  renderCraft(): void {
    this.craftPanel.textContent = ''
    this.menu.clearActionHotkeys()
    for (const recipe of HERO_ARROW_CRAFT_RECIPES) {
      this.craftPanel.appendChild(this.createCraftButton(recipe))
    }
  }

  syncTechnologyProgress(): void {}

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
  }

  refresh(): void {
    if (!this.opened) return
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
