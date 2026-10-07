import type { UnitEntity } from '../../types/entities'
import { shouldVillagerBeAsleep } from '../units/village/villagerSchedule'

/** A visual wake for a conversation does not end the actual sleep session. */
export function isNpcStillSleeping(npc: UnitEntity): boolean {
  if (npc.sleepVisualState) return true
  // Morning/evening breaks retain the sleep rest state after the sleeping pose ends.
  // A night-time conversation preview still belongs to the ongoing sleep session.
  const rest = npc.shelterState
  return Boolean(
    rest?.reason === 'sleep' &&
      !rest.mealBreak &&
      (rest.status === 'inside' || rest.status === 'outside') &&
      shouldVillagerBeAsleep(npc)
  )
}
