import type { UnitEntity } from '../../types/entities'

/** A visual wake for a conversation does not end the actual sleep session. */
export function isNpcStillSleeping(npc: UnitEntity): boolean {
  return npc.shelterState?.reason === 'sleep' || Boolean(npc.sleepVisualState)
}
