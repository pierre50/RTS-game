import { isChiefUnit } from '../chief'
import { getDailyRoutinePhase } from './village/villagerSchedule'
import type { GameContextLike } from '../../types/context'
import type { UnitEntity } from '../../types/entities'

/** An AI chief's sleep schedule takes precedence over visits and conversations. */
export function isAiChiefResting(
  unit: UnitEntity,
  context: Pick<GameContextLike, 'dayNight'> | null | undefined = unit.context
): boolean {
  if (!isChiefUnit(unit) || unit.owner?.type !== 'AI' || unit.owner.isPlayed || unit.controlMode === 'hero')
    return false
  const state = context?.dayNight?.state
  return (
    getDailyRoutinePhase(unit, (state?.hour ?? 12) * 60 + (state?.minute ?? 0)) === 'sleep' ||
    unit.sleepVisualState === 'sleeping' ||
    unit.sleepVisualState === 'waking'
  )
}
