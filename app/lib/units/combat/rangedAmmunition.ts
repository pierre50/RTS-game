import { isEquipmentBroken } from '../../equipment/equipmentCondition'
import { isSlingshot } from '../../equipment/rangedWeapon'
import { getNpcWeaponChoice, hasNpcWeaponInventory } from './npcWeapons'
import { hasUnitArrow } from './unitArrows'
import type { UnitEntity } from '../../../types/entities'

type RangedUnit = Pick<UnitEntity, 'type' | 'controlMode' | 'inventory'>

export function getRangedWeapon(unit: RangedUnit): string | undefined {
  return unit.type === 'Hero' || unit.controlMode === 'hero'
    ? unit.inventory?.activeWeapons?.ranged
    : hasNpcWeaponInventory(unit)
      ? getNpcWeaponChoice(unit, undefined, true).weapon
      : undefined
}

export function hasRangedAmmunition(unit: RangedUnit): boolean {
  const weapon = getRangedWeapon(unit)
  if (isEquipmentBroken(weapon)) return false
  if (isSlingshot(weapon)) return (unit.inventory?.resources?.stone ?? 0) >= 1
  if (hasNpcWeaponInventory(unit) && !weapon) return false
  return hasUnitArrow(unit)
}
