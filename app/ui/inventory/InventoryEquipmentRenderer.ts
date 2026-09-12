import { createInventoryContents } from './InventoryContents'
import { getPlayerBuildingConfig } from '../../lib/buildings/buildingAge'
import { Assets } from 'pixi.js'
import {
  HERO_FIBER_BANDAGE_ITEM,
  HERO_HEALING_POULTICE_ITEM,
  HERO_POISON_VIAL_ITEM,
  getHeroConsumableHealing,
  useHeroConsumableItem,
} from '../../lib/hero/heroCrafting'
import {
  equipHeroInventoryItem,
  getEquipmentSlot,
  getHeroEquipmentSlotLabelKey,
  getHeroEquippedItemCount,
  getWeaponSlot,
  HERO_EQUIPMENT_SLOTS,
  unequipHeroInventorySlot,
} from '../../lib/equipment/equipmentLoot'
import { getPlaceableInventoryBuildingType } from '../../lib/hero/placeableInventoryItems'
import { t } from '../../lib/lang'
import { BUILDING_TYPES } from '../../constants'
import { getBuildingAsset } from '../../lib'
import { createInventorySection } from './InventorySlotRenderer'
import { createInventoryBuildingIcon, createInventoryResourceIcon } from './InventoryItemIcons'
import { createInventoryEquipmentRow, createInventoryResourceRow } from './InventoryItemRows'
import type { MenuHost } from '../MenuHost'
import type { HeroEquippedItem } from '../../types/heroTools'
import type { HeroWeaponSlot } from '../../types/entities'

const BAG_ITEM_ICON_RESOURCES = {
  [HERO_HEALING_POULTICE_ITEM]: 'herb',
  [HERO_POISON_VIAL_ITEM]: 'toxicHerb',
  [HERO_FIBER_BANDAGE_ITEM]: 'fiber',
} as const

export type InventoryEquipmentRendererHost = {
  close(): void
  equippedPanel: HTMLDivElement
  lootedEquipmentPanel: HTMLDivElement
  menu: MenuHost
  renderTools(): void
}

function getHeroToolForWeaponSlot(slot: HeroWeaponSlot | null): HeroEquippedItem | null {
  if (slot === 'melee') return 'sword'
  if (slot === 'ranged') return 'bow'
  return null
}

function selectEquippedWeaponTool(menu: MenuHost, slot: HeroWeaponSlot | null): void {
  const tool = getHeroToolForWeaponSlot(slot)
  if (!tool) return
  menu.context.controls.setEquippedItem?.(tool)
  menu.context.controls.setEquippedTool?.(tool)
}

export function renderInventoryLootedEquipment(host: InventoryEquipmentRendererHost): void {
  const { menu } = host
  host.lootedEquipmentPanel.replaceChildren()
  const hero = menu.context.controls.heroUnit
  host.lootedEquipmentPanel.appendChild(
    createInventoryContents({
      inventory: hero?.inventory ?? {},
      emptyText: t('inventoryEmptySlot'),
      title: t('inventoryBag'),
      renderResource: (resource, amount) =>
        createInventoryResourceRow(menu, {
          id: `inventory-resource-${resource}`,
          resource,
          amount,
        }).element,
      renderEquipment: (equipment, count) => createBagEquipmentSlot(host, equipment, count),
    })
  )
}

function createBagEquipmentSlot(host: InventoryEquipmentRendererHost, item: string, count: number): HTMLElement {
  const { menu } = host
  const hero = menu.context.controls.heroUnit
  const equipmentSlot = getEquipmentSlot(item)
  const weaponSlot = getWeaponSlot(item)
  const placeableBuildingType = getPlaceableInventoryBuildingType(item)
  const consumableHealing = getHeroConsumableHealing(item)
  const canUseConsumable = Boolean(hero && consumableHealing > 0)
  const canEquipTarget = Boolean(equipmentSlot || weaponSlot)
  const canEquip = Boolean(
    (equipmentSlot && (equipmentSlot !== 'helmetDecor' || hero?.inventory?.equipped?.helmet)) || weaponSlot
  )
  const canPlace = Boolean(hero && placeableBuildingType)
  const iconResource = BAG_ITEM_ICON_RESOURCES[item as keyof typeof BAG_ITEM_ICON_RESOURCES]
  const icon = iconResource
    ? createInventoryResourceIcon(iconResource)
    : placeableBuildingType
      ? createInventoryBuildingIcon(menu.context, placeableBuildingType)
      : undefined
  const hasAction = canEquipTarget || canPlace || canUseConsumable
  const actionLabel = canUseConsumable
    ? t('inventoryUseAction')
    : canPlace
      ? t('inventoryPlaceAction')
      : t('inventoryEquipAction')
  const handleAction = (mode: 'one' | 'all'): void => {
    if (canUseConsumable) {
      if (!hero || !useHeroConsumableItem(hero, item)) return
      menu.updateHeroStatus?.(hero)
      host.close()
      return
    }
    if (canPlace) {
      if (!hero || !placeableBuildingType) return
      const config = getPlayerBuildingConfig(menu.context.player, placeableBuildingType)
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
      host.close()
      return
    }

    const amount = mode === 'all' ? count : 1
    if (!equipHeroInventoryItem(hero, item, amount)) return
    menu.updateHeroStatus?.(hero)
    selectEquippedWeaponTool(menu, weaponSlot)
    host.renderTools()
  }
  const { element } = createInventoryEquipmentRow(menu.context, menu, {
    id: `inventory-equipment-${item}`,
    title: placeableBuildingType ? t(placeableBuildingType) : undefined,
    equipment: item,
    count,
    icon,
    trailingAction: hasAction
      ? {
          disabled: !canUseConsumable && !canPlace && !canEquip,
          label: actionLabel,
          onAction: handleAction,
        }
      : undefined,
  })
  return element
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
          const count = equipment ? getHeroEquippedItemCount(hero, slotId) : 0
          const { element } = equipment
            ? createInventoryEquipmentRow(menu.context, menu, {
                id: `inventory-equipped-${slotId}`,
                className: 'inventory-equipped-row',
                disabled,
                equipment,
                count,
                descriptionPrefix: t(getHeroEquipmentSlotLabelKey(slotId)),
                trailingAction: {
                  disabled,
                  label: t('inventoryUnequipAction'),
                  onAction: mode => {
                    const amount = mode === 'all' ? count : 1
                    if (!unequipHeroInventorySlot(hero, slotId, amount)) return
                    host.renderTools()
                  },
                },
              })
            : createInventoryEquipmentRow(menu.context, menu, {
                id: `inventory-equipped-${slotId}`,
                className: 'inventory-equipped-row',
                disabled,
                equipment: '',
                title: t(getHeroEquipmentSlotLabelKey(slotId)),
                description: t('inventoryEmptySlot'),
                meta: '',
                count: 0,
              })
          element.classList.toggle('empty', !equipment)
          grid.appendChild(element)
        }
      },
    })
  )
}
