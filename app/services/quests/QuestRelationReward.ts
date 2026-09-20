import { adjustFactionRelation, getFactionRelationState } from '../../lib/combat/factions'
import { t } from '../../lib/lang'
import type { GameContextLike } from '../../types/context'
import type { QuestInstance } from '../../types/quest'
import type { UnitEntity } from '../../types/entities'

/** Called after completion, before UI refresh. The completed quest guards repeat deliveries. */
export function grantQuestRelationReward(
  context: GameContextLike,
  quest: QuestInstance,
  npc: UnitEntity,
  amount: number
): string {
  if (quest.status !== 'completed' || quest.facts.relationRewardApplied || !Number.isFinite(amount) || amount <= 0)
    return t('questCompleted')
  const journal = context.getQuestJournal?.()
  const owner = npc.owner
  if (!journal || !owner) return t('questCompleted')
  const faction = owner.factionId ? context.getCampaignFactions?.()?.[owner.factionId] : undefined
  let before: number
  let after: number
  const name = faction?.name || owner.name || quest.owner.name
  if (faction) {
    if (!context.changeFactionRelation) return t('questCompleted')
    before = faction.relationScore
    after = adjustFactionRelation(faction, amount, Date.now()).relationScore
    // Commit the receipt before the campaign callback takes its recovery snapshot.
    quest.facts.relationRewardApplied = true
    context.changeFactionRelation(faction.id, after - before, 'quest')
  } else {
    const key = JSON.stringify([quest.regionId, quest.owner.playerLabel])
    const relations = (journal.villageRelations ??= {})
    before = relations[key] ?? 0
    after = Math.min(100, Math.max(-100, Math.round(before + amount)))
    relations[key] = after
    quest.facts.relationRewardApplied = true
  }
  const gain = after - before
  let message = gain > 0 ? t('questCompletedRelation', { name, gain }) : t('questCompletedRelationMax', { name })
  const previousStatus = getFactionRelationState(before)
  const status = getFactionRelationState(after)
  if (status !== previousStatus) message += ` ${t('questRelationChanged', { status: t(`questRelation_${status}`) })}`
  return message
}
