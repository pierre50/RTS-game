import { Assets } from 'pixi.js'
import {
  equipHeroInventoryItem,
  formatEquipmentStackLabel,
  getEquipmentSlot,
  getEquipmentStacks,
  getHeroEquipmentSlotLabelKey,
  getHeroEquippedItemCount,
  getWeaponSlot,
  HERO_EQUIPMENT_SLOTS,
  unequipHeroInventorySlot,
} from '../../lib/equipment/equipmentLoot'
import { getPlaceableInventoryBuildingType } from '../../lib/hero/placeableInventoryItems'
import { t } from '../../lib/lang'
import { BUILDING_TYPES, RESOURCE_NAMES } from '../../constants'
import { renderBuildingAvatar } from '../../lib/avatar'
import { getBuildingAsset } from '../../lib'
import { renderEquipmentAvatarLazy } from '../equipment/EquipmentAvatar'
import type { MenuHost } from '../MenuHost'

export type InventoryEquipmentRendererHost = {
  close(): void
  equippedPanel: HTMLDivElement
  lootedEquipmentPanel: HTMLDivElement
  menu: MenuHost
  renderTools(): void
}

export function renderInventoryLootedEquipment(host: InventoryEquipmentRendererHost): void {
  const { menu } = host
  host.lootedEquipmentPanel.replaceChildren()
  const hero = menu.context.controls.heroUnit
  const equipment = hero?.inventory?.equipment ?? []
  const resources = hero?.inventory?.resources ?? {}
  const resourceEntries = RESOURCE_NAMES.map(resource => ({
    amount: Math.max(0, Math.floor(resources[resource] ?? 0)),
    resource,
  })).filter(entry => entry.amount > 0)
  if (!equipment.length && !resourceEntries.length) return

  const title = document.createElement('div')
  title.className = 'inventory-loot-title'
  title.textContent = t('inventoryBag')
  host.lootedEquipmentPanel.appendChild(title)

  const grid = document.createElement('div')
  grid.className = 'inventory-loot-grid'
  for (const { amount, resource } of resourceEntries) {
    const slot = document.createElement('button')
    slot.type = 'button'
    slot.className = 'inventory-slot ui-btn inventory-loot-slot'
    slot.disabled = true

    const label = document.createElement('div')
    label.className = 'inventory-slot-label'
    label.textContent = `${t(resource)} x${amount}`

    slot.appendChild(label)
    grid.appendChild(slot)
  }
  for (const stack of getEquipmentStacks(equipment)) {
    const item = stack.equipment
    const slot = document.createElement('button')
    const equipmentSlot = getEquipmentSlot(item)
    const weaponSlot = getWeaponSlot(item)
    const placeableBuildingType = getPlaceableInventoryBuildingType(item)
    const canEquip = Boolean(
      (equipmentSlot && (equipmentSlot !== 'helmetDecor' || hero?.inventory?.equipped?.helmet)) || weaponSlot
    )
    const canPlace = Boolean(hero && placeableBuildingType)
    slot.type = 'button'
    slot.className = 'inventory-slot ui-btn inventory-loot-slot'
    slot.disabled = !canEquip && !canPlace
    if (canPlace) {
      slot.addEventListener('click', () => {
        if (!hero || !placeableBuildingType) return
        const config = menu.context.player.config.buildings[placeableBuildingType]
        if (!config) return
        const assets =
          placeableBuildingType === BUILDING_TYPES.farm
            ? { images: { final: { sheet: 'resources/wheat', frame: 0 } } }
            : getBuildingAsset(placeableBuildingType, menu.context.player, Assets)
        menu.context.controls.removeMouseBuilding()
        menu.context.controls.setMouseBuilding?.({
          ...config,
          ...assets,
          inventoryItem: item,
          type: placeableBuildingType,
        })
        menu.playUiClick()
        host.close()
      })
    } else if (canEquip) {
      slot.addEventListener('click', () => {
        if (!equipHeroInventoryItem(hero, item)) return
        menu.playUiClick()
        host.renderTools()
      })
    }

    const icon = document.createElement('canvas')
    icon.className = 'unit-avatar-frame inventory-slot-icon'
    icon.width = 64
    icon.height = 64
    if (placeableBuildingType) {
      renderBuildingAvatar(menu.context.app, placeableBuildingType, menu.context.player, icon)
    } else {
      renderEquipmentAvatarLazy(menu.context.app, item, icon, 'inventory', menu.context.performance)
    }

    const label = document.createElement('div')
    label.className = 'inventory-slot-label'
    label.textContent = placeableBuildingType
      ? stack.count > 1
        ? `${t(placeableBuildingType)} x${stack.count}`
        : t(placeableBuildingType)
      : formatEquipmentStackLabel(item, stack.count)

    slot.appendChild(icon)
    slot.appendChild(label)
    grid.appendChild(slot)
  }
  host.lootedEquipmentPanel.appendChild(grid)
}

export function renderInventoryEquippedEquipment(host: InventoryEquipmentRendererHost): void {
  const { menu } = host
  host.equippedPanel.replaceChildren()
  const hero = menu.context.controls.heroUnit
  if (!hero) return

  const title = document.createElement('div')
  title.className = 'inventory-loot-title'
  title.textContent = t('inventoryEquippedEquipment')
  host.equippedPanel.appendChild(title)

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
        menu.playUiClick()
        host.renderTools()
      })
    }

    const iconWrap = document.createElement('span')
    iconWrap.className = 'inventory-equipped-icon-wrap'
    if (equipment) {
      const icon = document.createElement('canvas')
      icon.className = 'unit-avatar-frame inventory-slot-icon'
      icon.width = 64
      icon.height = 64
      renderEquipmentAvatarLazy(menu.context.app, equipment, icon, 'inventory', menu.context.performance)
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
  host.equippedPanel.appendChild(grid)
}
