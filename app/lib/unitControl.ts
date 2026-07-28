import type { UnitControlMode, UnitEntity } from '../types/entities'

export function setUnitControlMode(unit: UnitEntity, controlMode: UnitControlMode): void {
  unit.controlMode = controlMode
}

export function isHeroControlled(unit: UnitEntity): boolean {
  if (unit.controlMode === 'hero') return true
  if (unit.controlMode) return false
  return unit.context?.controls?.heroUnit === unit && Boolean(unit.context.controls.isHeroControlActive?.())
}

export function canAutoAcquireTarget(unit: UnitEntity): boolean {
  return !isHeroControlled(unit)
}

export function canAutoReactToAttack(unit: UnitEntity): boolean {
  return !isHeroControlled(unit)
}

export function isManualHeroActionReleased(unit: UnitEntity): boolean {
  return isHeroControlled(unit) && unit.context?.controls?.heroActionHeld !== true
}
