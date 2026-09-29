import type { UnitEntity } from '../../types/entities'

/** A visual wake for a conversation does not end the actual sleep session. */
export function isNpcStillSleeping(npc: UnitEntity): boolean {
  // Meal breaks reuse the rest state but leave the NPC awake and available to talk.
  return (npc.shelterState?.reason === 'sleep' && !npc.shelterState.mealBreak) || Boolean(npc.sleepVisualState)
}
