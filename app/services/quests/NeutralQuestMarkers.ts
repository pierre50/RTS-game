import type { GameContextLike } from '../../types/context'
import type { UnitEntity } from '../../types/entities'
import type { NeutralVillageQuests } from './NeutralVillageQuests'
type Host = Pick<NeutralVillageQuests, 'system' | 'environment'>
export function getTrackedMarkers(
  this: Host,
  context: GameContextLike,
  getRegionId: () => string,
  eligible: (npc: UnitEntity) => boolean,
  spaceId: string,
  regionId: string
) {
  const state = this.system.state
  const quest = state?.quests.find(item => item.id === state.trackedQuestId && item.status === 'active')
  if (!quest || quest.regionId !== regionId || regionId !== getRegionId() || quest.assigneeId !== context.player?.label)
    return []
  const stage = this.system.definitions.get(quest.definitionId)?.stages.find(item => item.id === quest.stageId)
  for (const interaction of stage?.interactions ?? []) {
    if (interaction.nextStageId === undefined) continue
    const actorLabel = quest.bindings[interaction.actor]
    const npc = (context.players ?? [])
      .flatMap(player => player.units ?? [])
      .find(unit => unit.label === actorLabel && unit.owner?.label === quest.owner.playerLabel)
    if (!npc || !eligible(npc) || !this.system.canInteract(quest, interaction, this.environment(npc))) continue
    // Readiness does not require the recipient to be awake or in the hero's current space.
    if ((npc.spaceId ?? 'outside') !== spaceId || !Number.isFinite(npc.i) || !Number.isFinite(npc.j)) return []
    return [
      {
        id: 'quest-return',
        kind: 'return' as const,
        spaceId,
        position: { i: npc.i, j: npc.j },
        label: { key: 'questReturnToGiver' },
      },
    ]
  }
  return this.system.getTrackedMarkers(spaceId, regionId).map(marker => ({ ...marker, kind: 'area' as const }))
}
