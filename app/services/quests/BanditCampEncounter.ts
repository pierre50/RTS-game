import { placeOutdoorBanditQuestCamp } from '../../classes/map/BanditCampGeneration'
import type { MapGenerationMap } from '../../classes/map/MapGenerationTypes'
import type { GameContextLike } from '../../types/context'
import type { UnitEntity } from '../../types/entities'
import type { QuestInstance } from '../../types/quest'
import { ensureQuestEncounter } from './QuestEncounterSpawn'
import { banditCampQuest } from './BanditCampQuest'

export function maintainBanditCampEncounter(context: GameContextLike, quest: QuestInstance, npc: UnitEntity): void {
  if (quest.definitionId !== banditCampQuest.id || quest.status !== 'active' || quest.facts.campCleared ||
    quest.regionId !== (context.map.worldRegionId ?? context.getCurrentWorldId?.()) ||
    (npc.spaceId ?? 'outside') !== 'outside') return
  const previous = quest.encounters?.bandits
  const encounter = previous ?? ensureQuestEncounter(context, quest, 'bandits', npc, {
    count: 1, footprintRadius: 9, parameters: {},
    create: cell => placeOutdoorBanditQuestCamp(context.map as MapGenerationMap, context, cell),
  })
  if (!encounter) return
  if (!previous) {
    quest.markers = { 'clear-camp': [{ id: 'bandit-camp', spaceId: 'outside', position: encounter.position,
      radius: 9, label: { key: 'questBanditArea' } }] }
    context.autosave?.()
  }
  // Never award an empty/failed spawn. Missing units on this loaded map have already been removed.
  if (!encounter.entityLabels.length) return
  const alive = new Set((context.players ?? []).flatMap(player => player.units ?? [])
    .filter(unit => !unit.isDead && !unit.isDestroyed).map(unit => unit.label))
  if (encounter.entityLabels.some(label => alive.has(label))) return
  quest.facts.campCleared = true
  quest.unread = true
  quest.markers = {}
  context.autosave?.()
}
