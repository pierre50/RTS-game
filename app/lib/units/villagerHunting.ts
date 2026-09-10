import { FAMILY_TYPES, UNIT_TYPES } from '../../constants'
import type { RuntimeEntity, UnitEntity } from '../../types/entities'

export function canVillagerAutonomouslyHunt(unit: UnitEntity, target: RuntimeEntity): boolean {
  return Boolean(
    unit.type === UNIT_TYPES.villager &&
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
