import { BUILDING_TYPES, UNIT_TYPES } from '../../constants'
import { t } from '../../lib/lang'
import type { GameContextLike } from '../../types/context'
import type { UnitEntity } from '../../types/entities'
import type { QuestDefinition, QuestInstance } from '../../types/quest'
import type { QuestSystem } from './QuestSystem'

type FoundingStep = { id: string; types: readonly string[]; count: number; text: string; kind: 'building' | 'unit' }

const steps: readonly FoundingStep[] = [
  { id: 'camp-first-house', kind: 'building', types: [BUILDING_TYPES.house], count: 1, text: 'firstHouse' },
  { id: 'village-forum', kind: 'building', types: [BUILDING_TYPES.townCenter], count: 1, text: 'foundingForum' },
  { id: 'village-granary', kind: 'building', types: [BUILDING_TYPES.granary], count: 1, text: 'foundingGranary' },
  { id: 'village-storage', kind: 'building', types: [BUILDING_TYPES.storagePit], count: 1, text: 'foundingStorage' },
  { id: 'village-military', kind: 'building', types: [BUILDING_TYPES.barracks, BUILDING_TYPES.archeryRange], count: 1, text: 'foundingMilitary' },
  { id: 'village-defenders', kind: 'unit', types: [UNIT_TYPES.infantry, UNIT_TYPES.bowman], count: 2, text: 'foundingDefenders' },
  { id: 'village-forge', kind: 'building', types: [BUILDING_TYPES.forge], count: 1, text: 'foundingForge' },
] as const

export const villageFoundingQuests: QuestDefinition[] = steps.map(step => ({
  id: step.id,
  title: { key: `${step.text}Title` },
  description: { key: `${step.text}Description` },
  stages: [{
    id: 'develop',
    objectives: [{ id: 'objective', text: { key: `${step.text}Objective` },
      conditions: [{ type: 'fact', key: 'done', value: true }] }],
    interactions: [],
  }],
}))

function offerStep(system: QuestSystem, index: number, origin: Pick<QuestInstance, 'regionId' | 'owner'>): boolean {
  const step = steps[index]
  return system.offer({
    id: step.id, definitionId: step.id, regionId: origin.regionId, owner: origin.owner,
    assigneeId: null, parameters: {}, bindings: {}, status: 'available', stageId: 'develop',
    facts: {}, usedInteractions: [], markers: {}, unread: true, repeatable: false,
  })
}

export function assignVillageFoundingQuests(context: GameContextLike, system: QuestSystem, companion: UnitEntity): void {
  const player = context.player
  const regionId = context.map?.worldRegionId ?? context.getCurrentWorldId?.() ?? ''
  if (!player?.label || !regionId) return
  if (!offerStep(system, 0, {
    regionId,
    owner: { entityLabel: companion.label, playerLabel: player.label, name: companion.name || player.name || '' },
  })) return
  system.accept(steps[0].id, player.label)
  system.track(steps[0].id)
}

/** A single active task; completed local buildings also count when built ahead of the guide. */
export function updateVillageFoundingQuests(context: GameContextLike, system: QuestSystem): void {
  const state = system.state
  const player = context.player
  if (!state || !player) return
  const regionId = context.map?.worldRegionId ?? context.getCurrentWorldId?.() ?? ''
  let changed = false
  let nextObjective: string | null = null
  for (const [index, step] of steps.entries()) {
    const quest = state.quests.find(item => item.definitionId === step.id && item.status === 'active')
    if (!quest || quest.assigneeId !== player.label || quest.regionId !== regionId) continue
    const count = step.kind === 'building'
      ? player.buildings.filter(building => step.types.includes(building.type) &&
        building.isBuilt && !building.isDead && !building.isDestroyed).length
      : (player.units ?? []).filter(unit => step.types.includes(unit.type) &&
        !unit.isDead && !unit.isDestroyed && !unit.trainingTargetType && unit.controlMode !== 'hero' &&
        unit !== context.controls?.heroUnit).length
    if (count < step.count) break
    const tracked = state.trackedQuestId
    quest.facts.done = true
    quest.status = 'completed'
    quest.unread = true
    changed = true
    if (tracked === quest.id) state.trackedQuestId = null
    const next = steps[index + 1]
    nextObjective = next ? `${next.text}Objective` : null
    if (next && offerStep(system, index + 1, quest)) {
      system.accept(next.id, player.label)
      // Preserve another quest's tracking, or the player's choice to hide the guide.
      state.trackedQuestId = tracked === quest.id ? next.id : tracked
    }
  }
  if (!changed) return
  context.menu?.showMessage?.(
    nextObjective ? t('foundingNext', { objective: t(nextObjective) }) : t('foundingCompleted'),
    'success'
  )
  context.autosave?.()
}
