import { UNIT_TYPES } from '../constants'
import { getEntityMeleeWeapon, getUnitCombatRange, hasHeroInventoryEquipment } from '../equipment/equipmentStats'
import type { UnitEntity } from '../../types/entities'

// Match UnitCombat's projectile branch, including villagers' melee attack action.
export function usesMeleeAttack(unit: UnitEntity): boolean {
  return !(unit.projectile && unit.type !== UNIT_TYPES.villager && getUnitCombatRange(unit))
}

export function getUnitMeleeWeapon(unit: UnitEntity): string | undefined {
  if (hasHeroInventoryEquipment(unit)) {
    return unit.work === 'attacker' ? undefined : unit.inventory?.activeWeapons?.melee
  }
  return getEntityMeleeWeapon(unit)
}
