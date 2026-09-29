import { isNpcStillSleeping } from '../../lib/npc/npcSleep'
import type { GameContextLike } from '../../types/context'
import type { UnitEntity } from '../../types/entities'
import type { NeutralVillageQuests } from './NeutralVillageQuests'
type Host = Pick<NeutralVillageQuests, never>
export function canTalk(
  this: Host,
  context: GameContextLike,
  eligible: (npc: UnitEntity) => boolean,
  npc: UnitEntity
): boolean {
  const hero = context.controls?.heroUnit
  return Boolean(
    hero &&
      !hero.isDead &&
      !hero.isDestroyed &&
      eligible(npc) &&
      !isNpcStillSleeping(npc) &&
      npc.action !== 'attack' &&
      (hero.spaceId ?? 'outside') === (npc.spaceId ?? 'outside')
  )
}
