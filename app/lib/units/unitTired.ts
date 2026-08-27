import { UNIT_TYPES } from '../constants'
import type { UnitEntity } from '../../types/entities'
import { isVillagerTiredTime } from './villagerSchedule'

const VILLAGER_TIRED_SPEED_FACTOR = 0.65

function shouldVillagerBeTired(unit: UnitEntity): boolean {
  return Boolean(
    unit.type === UNIT_TYPES.villager &&
      !unit.isDead &&
      !unit.isDestroyed &&
      isVillagerTiredTime(unit.context)
  )
}

export function updateVillagerTiredState(unit: UnitEntity): boolean {
  const tired = shouldVillagerBeTired(unit)
  unit.tired = tired || undefined
  return tired
}

export function getUnitTiredSpeedFactor(unit: Pick<UnitEntity, 'tired'>): number {
  return unit.tired ? VILLAGER_TIRED_SPEED_FACTOR : 1
}
