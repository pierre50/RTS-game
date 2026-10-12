import { supplyTownArrows } from '../supplies/townArrowSupply'
import { hasRangedAmmunition } from '../combat/rangedAmmunition'
import { FAMILY_TYPES, UNIT_TYPES } from '../../../constants'
import type { RuntimeEntity, UnitEntity } from '../../../types/entities'

export function canVillagerAutonomouslyHunt(unit: UnitEntity, target: RuntimeEntity): boolean {
  return Boolean(
    unit.type === UNIT_TYPES.villager &&
      (hasRangedAmmunition(unit) || supplyTownArrows(unit, unit.owner, { hunting: true, preview: true }) > 0) &&
      target.family === FAMILY_TYPES.animal &&
      target.type !== 'Horse' &&
      !target.isDead &&
      !target.isDestroyed &&
      (target.hitPoints ?? 0) > 0 &&
      (target.quantity ?? 0) > 0 &&
      !('companionOwner' in target && target.companionOwner) &&
      !('isCatchingPoleCaught' in target && target.isCatchingPoleCaught)
  )
}
