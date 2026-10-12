import { hasNpcWeaponInventory, getNpcWeaponChoice } from '../units/combat/npcWeapons'
import { UNIT_TYPES } from '../constants'
import { getEntityMeleeWeapon, getUnitCombatRange, hasHeroInventoryEquipment } from '../equipment/equipmentStats'
import type { UnitEntity, RuntimeEntity } from '../../types/entities'

// Match UnitCombat's projectile branch, including villagers' melee attack action.
export function usesMeleeAttack(unit: UnitEntity, target?: RuntimeEntity): boolean {
  if (hasNpcWeaponInventory(unit)) return getNpcWeaponChoice(unit, target ?? unit.dest).kind === 'melee'
  return !(unit.projectile && unit.type !== UNIT_TYPES.villager && getUnitCombatRange(unit))
}

export function getUnitMeleeWeapon(unit: UnitEntity, target?: RuntimeEntity): string | undefined {
  if (hasNpcWeaponInventory(unit)) {
    const choice = getNpcWeaponChoice(unit, target ?? unit.dest)
    return choice.kind === 'melee' ? choice.weapon : undefined
  }
  if (hasHeroInventoryEquipment(unit)) {
    return unit.work === 'attacker' ? undefined : unit.inventory?.activeWeapons?.melee
  }
  return getEntityMeleeWeapon(unit)
}
