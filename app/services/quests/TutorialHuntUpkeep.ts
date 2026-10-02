import type { GameContextLike } from '../../types/context'
import type { UnitEntity } from '../../types/entities'
import type { QuestInstance } from '../../types/quest'
import { tutorialHuntQuest } from './TutorialHuntQuest'
import { selectTutorialHunt } from './TutorialHuntSelection'

const HUNT_CHECK_INTERVAL_MS = 500
const WOOD_STAGE_REQUIRED = 3

function isHuntStageActive(quest: QuestInstance, npc: UnitEntity): boolean {
  return (
    quest.definitionId === tutorialHuntQuest.id &&
    quest.status === 'active' &&
    ['wood', 'hunt'].includes(quest.stageId) &&
    (npc.spaceId ?? 'outside') === 'outside'
  )
}

function remainingHuntLoot(quest: QuestInstance, resourceCount: (resource: string) => number): number {
  const resource = quest.stageId === 'hunt' ? String(quest.parameters.resource) : undefined
  const required = quest.stageId === 'hunt' ? Number(quest.parameters.quantity) : WOOD_STAGE_REQUIRED
  return resource ? Math.max(0, required - resourceCount(resource)) : required
}

/** True while the saved hunt encounter still stands; exhausted targets are dropped for a new pick. */
function keepsHuntEncounter(context: GameContextLike, quest: QuestInstance): boolean {
  const encounters = quest.encounters
  if (encounters?.hunt && quest.stageId === 'hunt') {
    const labels = new Set(encounters.hunt.entityLabels)
    const animals = context.map.gaia?.animals ?? context.map.gaia?.units ?? []
    // Corpses remain harvestable. Only replace exhausted targets when loot is still needed.
    if (animals.some(animal => labels.has(animal.label) && !animal.isDestroyed && (animal.quantity ?? 0) > 0)) return true
    delete encounters.hunt
  }
  return Boolean(quest.encounters?.hunt)
}

export function maintainTutorialHunt(
  context: GameContextLike,
  quest: QuestInstance,
  npc: UnitEntity,
  huntChecks: Map<string, number>,
  resourceCount: (resource: string) => number
): void {
  if (!isHuntStageActive(quest, npc)) return
  const now = context.scheduler?.elapsedMs ?? Date.now()
  if (now < (huntChecks.get(quest.id) ?? -Infinity)) return
  huntChecks.set(quest.id, now + HUNT_CHECK_INTERVAL_MS)
  if (!remainingHuntLoot(quest, resourceCount)) return
  if (keepsHuntEncounter(context, quest)) return
  const hunt = selectTutorialHunt(context, npc, quest)
  if (!hunt) return
  const changed = JSON.stringify(quest.reservation) !== JSON.stringify(hunt.reservation)
  quest.reservation = hunt.reservation
  if (quest.stageId === 'hunt' && changed) quest.markers = hunt.markers
  if (changed) context.autosave?.()
}
