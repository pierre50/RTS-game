import { hasNpcWeaponInventory } from '../units/combat/npcWeapons'
import type { CombatEntity } from '../../types/combat'
import { FAMILY_TYPES, UNIT_TYPES } from '../constants'
import { getEntityWeaponPower, getEntityMeleeWeapon } from '../equipment/equipmentStats'
import { hasUnitArrow, npcArrowCapacity, usesArcherDagger } from '../units/combat/unitArrows'
import { isBanditOwner, isBanditUnitType } from './bandits'
export function canConvert(source?: CombatEntity | null, target?: CombatEntity | null): boolean {
  if (!source || source.type !== UNIT_TYPES.priest || !target) return false
  const sourceOwner = source.owner
  if (
    !sourceOwner ||
    isBanditOwner(sourceOwner as Parameters<typeof isBanditOwner>[0]) ||
    !sourceOwner.isEnemy?.(target.owner as never)
  )
    return false
  if (target.family === FAMILY_TYPES.unit) {
    return target.type !== UNIT_TYPES.priest && !isBanditUnitType(target.type)
  }
  return false
}

export function canAttack(source?: CombatEntity | null): boolean {
  if (source && hasNpcWeaponInventory(source)) return true
  if (
    source &&
    npcArrowCapacity(source) > 0 &&
    source.type !== UNIT_TYPES.villager &&
    !hasUnitArrow(source) &&
    (!usesArcherDagger(source) || !getEntityMeleeWeapon(source as Parameters<typeof getEntityMeleeWeapon>[0]))
  )
    return false
  return getEntityWeaponPower(source as Parameters<typeof getEntityWeaponPower>[0] | null | undefined) > 0
}
