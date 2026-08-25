import type { UnitEntity } from '../types/entities'

export const UNIT_WALK_SPEED_FACTOR = 0.5
export const CAUTIOUS_ANIMAL_APPROACH_RANGE = 7

export function getUnitWalkSpeedFactor(isWalking: boolean): number {
  return isWalking ? UNIT_WALK_SPEED_FACTOR : 1
}

export function isUnitWalkSpeedFactor(factor: number): boolean {
  return factor < 1
}

export function composeMoveSpeedFactor(...factors: number[]): number {
  return factors.reduce((value, factor) => Math.min(value, Math.max(0, factor)), 1)
}

export function getRequestedMoveSpeedFactor(unit: UnitEntity): number {
  return Math.max(0, Math.min(1, unit.requestedMoveSpeedFactor ?? 1))
}

export function clearRequestedMoveSpeedFactor(unit: UnitEntity): void {
  unit.requestedMoveSpeedFactor = undefined
}

export function requestUnitWalk(unit: UnitEntity): void {
  unit.requestedMoveSpeedFactor = UNIT_WALK_SPEED_FACTOR
}
