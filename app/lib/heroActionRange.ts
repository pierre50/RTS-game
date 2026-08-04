import { ACTION_TYPES } from '../constants'
import type { RuntimeEntity, UnitEntity } from '../types/entities'
import { getBuildingContactDistance } from './grid/cells'
import { instancesDistance } from './maths'
import { isHeroControlled } from './unitControl'

const HERO_FOOD_CONTACT_EXTRA_RANGE = 1.5

export function isHeroControlledUnit(unit: UnitEntity): boolean {
  return isHeroControlled(unit)
}

export function getHeroActionDistance(action: string | null | undefined, target: RuntimeEntity): number | null {
  if (!action) return null
  if (action !== ACTION_TYPES.takemeat) return null

  return getBuildingContactDistance(target.size ?? 1) + HERO_FOOD_CONTACT_EXTRA_RANGE
}

export function isHeroActionInRange(
  unit: UnitEntity,
  action: string | null | undefined,
  target: RuntimeEntity | null | undefined
): boolean {
  if (!target || !isHeroControlled(unit) || target.isDestroyed) return false
  const actionDistance = getHeroActionDistance(action, target)
  return actionDistance !== null && instancesDistance(unit, target) <= actionDistance
}
