import { FAMILY_TYPES } from '../../constants'
import { isWildHorse } from '../../horses/horseTaming'
import type { ResourceEntity, RuntimeEntity, UnitEntity } from '../../../types/entities'

type CarcassTask = 'leather' | 'sinew' | 'feather'
const CARCASS_TASKS: readonly string[] = ['leather', 'sinew', 'feather']

export function isAliveEntity(entity: RuntimeEntity | null | undefined): entity is RuntimeEntity {
  return Boolean(entity && !entity.isDead && !entity.isDestroyed && (entity.hitPoints ?? 1) > 0)
}

export function isUsableResource(entity: RuntimeEntity | null | undefined): entity is ResourceEntity {
  // Harvestability depends on remaining stock, not health: minerals may have no
  // hit points, and felled trees still contain wood.
  return Boolean(
    entity &&
      !entity.isDead &&
      !entity.isDestroyed &&
      entity.family === FAMILY_TYPES.resource &&
      (entity.quantity ?? 1) > 0
  )
}

function isUsableAnimalCarcass(entity: RuntimeEntity | null | undefined): entity is RuntimeEntity {
  return Boolean(
    entity &&
      entity.family === FAMILY_TYPES.animal &&
      entity.isDead &&
      !entity.isDestroyed &&
      (entity.quantity ?? 0) > 0
  )
}

export function isCapturableHorse(entity: RuntimeEntity | null | undefined): entity is RuntimeEntity {
  return Boolean(
    entity &&
      entity.family === FAMILY_TYPES.animal &&
      entity.type === 'Horse' &&
      isWildHorse(entity) &&
      !entity.isDead &&
      !entity.isDestroyed &&
      !(entity as { companionOwner?: UnitEntity | null }).companionOwner &&
      !(entity as { isCatchingPoleCaught?: boolean }).isCatchingPoleCaught
  )
}

/** A carcass is usable for the current collective hide/sinew/feather task, or as plain food. */
export function isUsableCarcassForTask(unit: UnitEntity, target: RuntimeEntity, state: RuntimeEntity): boolean {
  if (CARCASS_TASKS.includes(unit.collectiveTask ?? '')) {
    return Boolean(
      state.isDead &&
        !target.isDestroyed &&
        'inventory' in target &&
        (target.inventory?.resources?.[unit.collectiveTask as CarcassTask] ?? 0) > 0
    )
  }
  return isUsableAnimalCarcass(state)
}
