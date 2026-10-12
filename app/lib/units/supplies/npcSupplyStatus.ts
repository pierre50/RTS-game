import { groundToolTarget } from './groundToolRecovery'
import { canNpcWieldWeapon } from '../combat/npcWeapons'
import { isEquipmentBroken } from '../../equipment/equipmentCondition'
import { getWeaponSlot } from '../../equipment/equipmentSlots'
import { npcArrowCapacity } from '../combat/unitArrows'
import type { SupplyUnit } from './townSupplies'

/** A removed item is intentional; only exhausted carried equipment requests replacement. */
export function npcNeedsSupplies(unit: SupplyUnit): boolean {
  if (
    unit.type === 'Hero' ||
    unit.controlMode === 'hero' ||
    unit.isDead ||
    unit.isDestroyed ||
    unit.inventory?.toolsStowed
  )
    return false
  const tool = unit.inventory?.activeWeapons?.tool
  if ((tool && isEquipmentBroken(tool)) || groundToolTarget(unit)) return true
  const bag = unit.inventory?.equipment ?? []
  if (
    npcArrowCapacity(unit) &&
    !bag.some(item => item.startsWith('arrow_')) &&
    (unit.type !== 'Villager' || unit.work === 'hunter')
  )
    return true
  const archer = ['Bowman', 'BanditArcher'].includes(unit.type)
  const roles =
    archer || unit.type === 'Villager'
      ? ['melee', 'ranged']
      : [bag.some(item => getWeaponSlot(item) === 'melee') ? 'melee' : 'ranged']
  return roles.some(slot => {
    const weapons = bag.filter(
      item =>
        getWeaponSlot(item) === slot &&
        canNpcWieldWeapon({ type: unit.type }, item) &&
        (!archer || slot !== 'melee' || item.startsWith('dagger_'))
    )
    return weapons.length > 0 && weapons.every(isEquipmentBroken)
  })
}
