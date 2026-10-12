import { equipmentBaseKey } from '../../equipment/equipmentCondition'
import { dynamicEquipmentLayersForEquipment } from '../../lpc/equipment'
import { getNpcActiveCombatEquipment, hasNpcWeaponInventory, isNpcWeaponItem } from '../combat/npcWeapons'
import type { UnitEntity } from '../../../types/entities'

const originalAppearances = new WeakMap<
  UnitEntity,
  { base: UnitEntity['appearance']; active: UnitEntity['appearance']; signature: string }
>()

/** Preserve work appearances outside combat; show the selected weapon or equipped tool in combat. */
export function syncNpcWeaponAppearance(unit: UnitEntity, action = unit.action): void {
  if (!hasNpcWeaponInventory(unit) || unit.isDead) return
  const previous = originalAppearances.get(unit)
  const base = previous && unit.appearance === previous.active ? previous.base : unit.appearance
  if (action && action !== 'attack' && action !== 'hunt') {
    if (previous && unit.appearance === previous.active) unit.appearance = base
    originalAppearances.delete(unit)
    return
  }
  const items = getNpcActiveCombatEquipment(unit).map(equipmentBaseKey)
  const signature = items.join('|')
  if (previous && unit.appearance === previous.active && previous.signature === signature) return
  const layers = (base?.layers ?? []).filter(layer => {
    const item = layer.equipmentKey
    return !item || (!isNpcWeaponItem(item, unit) && !item.startsWith('arrow_') && item !== 'quiver')
  })
  const weaponLayers = dynamicEquipmentLayersForEquipment(items).map(layer =>
    layer.equipmentKey?.startsWith('arrow_') ? { ...layer, hideOnOrAfterFrame: 9 } : layer
  )
  unit.appearance = { ...base, layers: [...layers, ...weaponLayers] }
  originalAppearances.set(unit, { base, active: unit.appearance, signature })
}
