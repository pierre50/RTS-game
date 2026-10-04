import type { GameContextLike } from '../../types/context'
import type { UnitEntity } from '../../types/entities'
import type { QuestInstance } from '../../types/quest'
import { PLAYER_TYPES } from '../../constants'
import { isUnitAlive } from '../../lib/playerState'
import { assignBanditCamp } from './BanditCampSelection'
import { banditCampQuest } from './BanditCampQuest'

const retryTimes = new WeakMap<QuestInstance, number>()

export function maintainBanditCampEncounter(context: GameContextLike, quest: QuestInstance, npc: UnitEntity): void {
  if (
    quest.definitionId !== banditCampQuest.id ||
    quest.status !== 'active' ||
    quest.facts.campCleared ||
    quest.regionId !== (context.map.worldRegionId ?? context.getCurrentWorldId?.())
  )
    return
  // Repair accepted legacy quests that never found a place for their generated camp.
  if (!quest.encounters?.bandits?.entityLabels.length) {
    const now = context.scheduler?.elapsedMs ?? performance.now()
    if (now < (retryTimes.get(quest) ?? 0)) return
    retryTimes.set(quest, now + 5000)
    if (!assignBanditCamp(context, quest, npc)) return
    context.autosave?.()
  }
  const encounter = quest.encounters?.bandits
  if (!encounter?.entityLabels.length) return
  // Track this assigned generation only; a later natural respawn cannot undo completion.
  const alive = new Set(
    (context.players ?? [])
      .filter(player => player.type === PLAYER_TYPES.bandits)
      .flatMap(player => player.units ?? [])
      .filter(isUnitAlive)
      .map(unit => unit.label)
  )
  if (encounter.entityLabels.some(label => alive.has(label))) return
  quest.facts.campCleared = true
  quest.unread = true
  quest.markers = {}
  context.autosave?.()
}
