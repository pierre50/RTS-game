import { isLivingChief } from '../../lib/chief'
import { isNeutralPlayer } from '../../lib/playerState'
import type { QuestInstance } from '../../types/quest'
import { VILLAGE_DETAIL_ENTER_RADIUS } from '../../config/villageActivity'
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

export function isChiefNearby(context: GameContextLike, npc: UnitEntity): boolean {
  const hero = context.controls?.heroUnit
  if (!hero || hero.isDead || hero.isDestroyed) return false
  const outside = (unit: UnitEntity) =>
    !unit.spaceId || unit.spaceId === 'outside'
      ? unit
      : context.map.spaces?.get(unit.spaceId)?.portals?.find(portal => portal.targetSpaceId === 'outside')?.targetCell
  if (hero.spaceId && hero.spaceId === npc.spaceId && hero.spaceId !== 'outside')
    return Math.hypot(hero.i - npc.i, hero.j - npc.j) <= VILLAGE_DETAIL_ENTER_RADIUS
  const a = outside(hero),
    b = outside(npc)
  return Boolean(a && b && Math.hypot(a.i - b.i, a.j - b.j) <= VILLAGE_DETAIL_ENTER_RADIUS)
}

export function isEligibleChief(
  context: GameContextLike,
  npc: UnitEntity,
  getQuest: (npc: UnitEntity) => QuestInstance | undefined
): boolean {
  const owner = npc.owner
  if (!owner || !isLivingChief(npc) || context.map?.mapType === 'interior') return false
  if (getQuest(npc)?.repeatable === false) return context.player?.isEnemy?.(owner) !== true
  if (owner.isPlayed) return false
  const faction = owner.factionId ? context.getCampaignFactions?.()?.[owner.factionId] : null
  return (
    (faction
      ? ['neutral', 'friendly', 'allied'].includes(faction.relationState)
      : isNeutralPlayer(owner) || owner.diplomacy === 'neutral') && context.player?.isEnemy?.(owner) !== true
  )
}
