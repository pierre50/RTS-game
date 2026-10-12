import { sameMapSpace } from '../mapSpaces'
import { canCampPursue } from './camps/campBehavior'
import type { RuntimeEntity, UnitEntity } from '../../types/entities'

// A hit or an ally's alert identifies a threat to one unit, without granting faction vision.
const attackers = new WeakMap<UnitEntity, RuntimeEntity>()

export function rememberUnitAttacker(unit: UnitEntity, attacker: RuntimeEntity): void {
  attackers.set(unit, attacker)
}

export function clearUnitAttacker(unit: UnitEntity): void {
  attackers.delete(unit)
}

export function isUnitRetaliationTarget(unit: UnitEntity, target: RuntimeEntity): boolean {
  return Boolean(
    attackers.get(unit) === target &&
      !unit.isDead &&
      !unit.isDestroyed &&
      !target.isDead &&
      !target.isDestroyed &&
      sameMapSpace(unit, target) &&
      canCampPursue(unit, target)
  )
}
