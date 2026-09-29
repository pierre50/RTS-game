import { ACTION_TYPES } from '../../constants'
import { getActionCondition } from '../../lib'
import type { ActionProps } from '../../lib/combat'
import { playerSeesTarget } from '../../lib/units/playerTargetKnowledge'
import type { RuntimeEntity, UnitCreationExtra, UnitEntity } from '../../types/entities'
import type { RuntimeCell } from '../../types/map'

export function isRuntimeEntity(value: RuntimeEntity | RuntimeCell | null | undefined): value is RuntimeEntity {
  return Boolean(value && !('has' in value && 'corpses' in value))
}

export function checkActionCondition(
  source: UnitEntity,
  target: object | null | undefined,
  action?: string,
  props?: ActionProps | UnitCreationExtra
): boolean {
  if (!target) return false
  if (
    ['attack', 'hunt', 'captureHorse', 'convert'].includes(action ?? '') &&
    !playerSeesTarget(source.owner, target as RuntimeEntity)
  )
    return false
  const actionProps =
    action === ACTION_TYPES.train && !props ? { trainingType: source.trainingTargetType ?? '' } : props
  return getActionCondition(source, target as RuntimeEntity, action ?? '', actionProps as ActionProps)
}

export function canShowTargetAlert(unit: UnitEntity, target: RuntimeEntity): boolean {
  return Boolean(unit.owner?.isPlayed && (unit.context?.controls?.instanceInCamera?.(target) ?? true))
}
