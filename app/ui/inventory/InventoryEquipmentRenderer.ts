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
import { BUILDING_TYPES, RESOURCE_ICON_IDS, RESOURCE_STORAGE_NAMES } from '../../constants'
import { renderBuildingAvatar } from '../../lib/avatar'
import { getBuildingAsset, getIconPath } from '../../lib'
import { renderEquipmentAvatarLazy } from '../equipment/EquipmentAvatar'
import { bindInventoryItemEvents, createInventorySection, createInventorySlot } from './InventorySlotRenderer'
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
  const resourceEntries = RESOURCE_STORAGE_NAMES.map(resource => ({
    amount: Math.max(0, Math.floor(resources[resource] ?? 0)),
    resource,
  })).filter(entry => entry.amount > 0)
  host.lootedEquipmentPanel.appendChild(
    createInventorySection({
      emptyText: t('inventoryEmptySlot'),
      title: t('inventoryBag'),
      renderItems: grid => {
        for (const { amount, resource } of resourceEntries) {
          const icon = document.createElement('img')
          icon.className = 'inventory-resource-icon'
          icon.src = getIconPath(RESOURCE_ICON_IDS[resource].commodity)
          icon.alt = ''
          grid.appendChild(
            createInventorySlot({
              className: 'inventory-loot-slot',
              disabled: true,
              icon,
              label: `${t(resource)} x${amount}`,
            })
          )
        }
        for (const stack of getEquipmentStacks(equipment)) {
          grid.appendChild(createBagEquipmentSlot(host, stack.equipment, stack.count))
        }
      },
    })
  )
}

function createBagEquipmentSlot(
  host: InventoryEquipmentRendererHost,
  item: string,
  count: number
): HTMLButtonElement {
  const { menu } = host
  const hero = menu.context.controls.heroUnit
  const equipmentSlot = getEquipmentSlot(item)
  const weaponSlot = getWeaponSlot(item)
  const placeableBuildingType = getPlaceableInventoryBuildingType(item)
  const canEquip = Boolean(
    (equipmentSlot && (equipmentSlot !== 'helmetDecor' || hero?.inventory?.equipped?.helmet)) || weaponSlot
  )
  const canPlace = Boolean(hero && placeableBuildingType)
  const icon = document.createElement('canvas')
  icon.className = 'unit-avatar-frame inventory-slot-icon'
  icon.width = 64
  icon.height = 64
  if (placeableBuildingType) {
    renderBuildingAvatar(menu.context.app, placeableBuildingType, menu.context.player, icon)
  } else {
    renderEquipmentAvatarLazy(menu.context.app, item, icon, 'inventory', menu.context.performance)
  }

  const label = placeableBuildingType
    ? count > 1
      ? `${t(placeableBuildingType)} x${count}`
      : t(placeableBuildingType)
    : formatEquipmentStackLabel(item, count)

  return createInventorySlot({
    className: 'inventory-loot-slot',
    disabled: !canEquip && !canPlace,
    icon,
    label,
    onAction: mode => {
      if (canPlace) {
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
        return
      }

      const amount = mode === 'all' ? count : 1
      if (!equipHeroInventoryItem(hero, item, amount)) return
      menu.playUiClick()
      host.renderTools()
    },
  })
}

export function renderInventoryEquippedEquipment(host: InventoryEquipmentRendererHost): void {
  const { menu } = host
  host.equippedPanel.replaceChildren()
  const hero = menu.context.controls.heroUnit
  if (!hero) return

  host.equippedPanel.appendChild(
    createInventorySection({
      gridClassName: 'inventory-equipped-grid',
      title: t('inventoryEquippedEquipment'),
      renderItems: grid => {
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
            bindInventoryItemEvents(button, mode => {
              const amount = mode === 'all' ? getHeroEquippedItemCount(hero, slotId) : 1
              if (!unequipHeroInventorySlot(hero, slotId, amount)) return
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
      },
    })
  )
}
