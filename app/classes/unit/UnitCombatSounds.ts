import { hasNpcWeaponInventory, getNpcActiveCombatEquipment } from '../../lib/units/combat/npcWeapons'
import { FAMILY_TYPES, SOUND_CUES } from '../../constants'
import { getUnitWorkEquipment } from '../../lib/equipment/equipmentStats'
import type { CommandSound, RuntimeEntity, UnitEntity } from '../../types/entities'
function usesMeleeImpactSound(item: string): boolean {
  return (
    item.startsWith('dagger_') ||
    item.startsWith('mace_') ||
    item.startsWith('club_') ||
    item.startsWith('sword_') ||
    item === 'axe' ||
    item.startsWith('axe_')
  )
}

function getMeleeImpactEquipment(unit: UnitEntity): string[] {
  if (hasNpcWeaponInventory(unit)) return getNpcActiveCombatEquipment(unit)
  if (Array.isArray(unit.equipment) && unit.equipment.length) return unit.equipment
  return unit.work && typeof getUnitWorkEquipment === 'function' ? getUnitWorkEquipment(unit.work, unit) : []
}

export function getMeleeImpactSound(unit: UnitEntity, target: RuntimeEntity | null): CommandSound {
  if (target?.family === FAMILY_TYPES.unit && getMeleeImpactEquipment(unit).some(usesMeleeImpactSound)) {
    return SOUND_CUES?.unit?.swordAttack ?? unit.sounds?.hit
  }
  return unit.sounds?.hit
}
