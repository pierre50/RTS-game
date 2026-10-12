import { notifyVillageWorkChanged } from '../../lib/units/village/villageWorkEvents'
import { equipHeroInventoryItem, unequipHeroActiveWeaponSlot } from '../../lib/equipment/equipmentLoot'
import { workToolFamily } from '../../lib/equipment/workTools'
import { refreshUnitEquipmentStats } from '../../lib/equipment/equipmentStats'
import { applyUnitActivitySpritesheets } from '../../lib/units/visuals/unitSpriteAssets'
import { t } from '../../lib/lang'
import type { UnitEntity } from '../../types/entities'
import type { MenuHost } from '../MenuHost'
import { createInventoryEquipmentRow } from './InventoryItemRows'

/** Tool actions live on the normal bag tiles, including the currently equipped item. */
export function unitToolBagActions(menu: MenuHost, unit: UnitEntity, onChange: () => void) {
  const changed = () => {
    if (unit.owner) notifyVillageWorkChanged(unit.owner)
    unit.stop?.()
    applyUnitActivitySpritesheets(unit)
    refreshUnitEquipmentStats(unit)
    unit.syncAppearanceLayers?.(unit.currentSheet ?? 'standingSheet')
    onChange()
  }
  return {
    equipmentAction: (equipment: string) =>
      workToolFamily(equipment)
        ? {
            label: t('inventoryEquipAction'),
            onClick: () => {
              if (equipHeroInventoryItem(unit, equipment)) changed()
            },
          }
        : undefined,
    equippedItems: () => {
      const tool = unit.inventory?.activeWeapons?.tool
      if (!tool) return []
      return [
        createInventoryEquipmentRow(menu.context, {
          id: `unit-tool-equipped-${unit.label}`,
          className: 'inventory-transfer-slot',
          equipment: tool,
          badge: t('inventoryEquippedEquipment'),
          trailingAction: {
            label: t('inventoryUnequipAction'),
            onClick: () => {
              if (unequipHeroActiveWeaponSlot(unit, 'tool')) changed()
            },
          },
        }).element,
      ]
    },
  }
}
