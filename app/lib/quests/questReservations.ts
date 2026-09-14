import type { CombatEntity } from '../../types/combat'
import type { GameContextLike } from '../../types/context'

/** Reservations belong to the quest journal, so they survive saves without modifying entities. */
export function isReservedQuestTarget(source: CombatEntity, target: CombatEntity): boolean {
  const context = (source as CombatEntity & { context?: Pick<GameContextLike, 'getQuestJournal' | 'controls'> }).context
  if (!target.label || !context?.getQuestJournal) return false
  return (context.getQuestJournal()?.quests ?? []).some(quest =>
    quest.status === 'active' && quest.reservation?.stageIds.includes(quest.stageId) &&
    quest.reservation.entityLabels.includes(target.label!) &&
    !(source === context.controls?.heroUnit && source.owner?.label === quest.assigneeId)
  )
}
