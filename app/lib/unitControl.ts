import type { ControlsLike } from '../types/context'
import type { UnitControlMode, UnitEntity } from '../types/entities'

export function setUnitControlMode(unit: UnitEntity, controlMode: UnitControlMode): void {
  unit.controlMode = controlMode
}

export function isArpgModeActive(
  controls: (Pick<ControlsLike, 'isArpgActive'> & { context?: { map?: { arpgMode?: boolean } } }) | null | undefined
): boolean {
  return Boolean(controls?.isArpgActive?.() || controls?.context?.map?.arpgMode)
}

export function isHeroControlled(unit: UnitEntity): boolean {
  if (unit.controlMode === 'arpg') return true
  if (unit.controlMode) return false
  return unit.context?.controls?.heroUnit === unit && Boolean(unit.context.controls.isArpgActive?.())
}

export function canAutoAcquireTarget(unit: UnitEntity): boolean {
  return !isHeroControlled(unit)
}

export function canAutoReactToAttack(unit: UnitEntity): boolean {
  return !isHeroControlled(unit)
}

export function canUseRtsEntityPointer(controls: Pick<ControlsLike, 'isArpgActive'> | null | undefined): boolean {
  return !isArpgModeActive(controls)
}

export function canUseRtsSelection(controls: Pick<ControlsLike, 'isArpgActive'> | null | undefined): boolean {
  return !isArpgModeActive(controls)
}

export function canSelectUnitWithRts(unit: UnitEntity): boolean {
  return !isHeroControlled(unit)
}

export function canReceiveRtsMoveOrder(unit: UnitEntity): boolean {
  return !isHeroControlled(unit)
}

export function getRtsCommandableUnits(units: readonly UnitEntity[] | null | undefined): UnitEntity[] {
  return (units ?? []).filter(unit => canReceiveRtsMoveOrder(unit))
}

export function hasRtsCommandableUnits(units: readonly UnitEntity[] | null | undefined): boolean {
  return getRtsCommandableUnits(units).length > 0
}

export function isManualHeroActionReleased(unit: UnitEntity): boolean {
  return isHeroControlled(unit) && unit.context?.controls?.heroActionHeld !== true
}
