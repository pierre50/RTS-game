import {
  CAMP_RESOURCES,
  CAMP_AXE,
  CAMP_HAMMER,
  CAMP_SPEAR,
  observeCampPreparation,
  campPreparationDone,
  hasEquippedCampSpear,
} from './CampPreparationProgress'
import { BUILDING_TYPES, UNIT_TYPES } from '../../constants'
import { t } from '../../lib/lang'
import type { GameContextLike } from '../../types/context'
import type { UnitEntity } from '../../types/entities'
import type { QuestDefinition, QuestInstance } from '../../types/quest'
import type { QuestSystem } from './QuestSystem'

type FoundingStep = {
  id: string
  types: readonly string[]
  count: number
  text: string
  kind: 'building' | 'unit' | 'preparation'
}

const steps: readonly FoundingStep[] = [
  { id: CAMP_RESOURCES, kind: 'preparation', types: [], count: 1, text: 'campResources' },
  { id: CAMP_AXE, kind: 'preparation', types: [], count: 1, text: 'campAxe' },
  { id: CAMP_HAMMER, kind: 'preparation', types: [], count: 1, text: 'campHammer' },
  { id: 'camp-first-house', kind: 'building', types: [BUILDING_TYPES.house], count: 1, text: 'firstHouse' },
  { id: 'village-forum', kind: 'building', types: [BUILDING_TYPES.townCenter], count: 1, text: 'foundingForum' },
  { id: 'village-granary', kind: 'building', types: [BUILDING_TYPES.granary], count: 1, text: 'foundingGranary' },
  { id: 'village-storage', kind: 'building', types: [BUILDING_TYPES.storagePit], count: 1, text: 'foundingStorage' },
  {
    id: 'village-military',
    kind: 'building',
    types: [BUILDING_TYPES.barracks, BUILDING_TYPES.archeryRange],
    count: 1,
    text: 'foundingMilitary',
  },
  {
    id: 'village-defenders',
    kind: 'unit',
    types: [UNIT_TYPES.infantry, UNIT_TYPES.bowman],
    count: 2,
    text: 'foundingDefenders',
  },
  { id: 'village-forge', kind: 'building', types: [BUILDING_TYPES.forge], count: 1, text: 'foundingForge' },
] as const

const defense: FoundingStep = { id: CAMP_SPEAR, kind: 'preparation', types: [], count: 1, text: 'campSpear' }

export const villageFoundingQuests: QuestDefinition[] = [...steps, defense].map(step => ({
  id: step.id,
  title: { key: `${step.text}Title` },
  description: { key: `${step.text}Description` },
  stages: [
    {
      id: 'develop',
      objectives: [
        {
          id: 'objective',
          text: { key: `${step.text}Objective` },
          conditions: [{ type: 'fact', key: 'done', value: true }],
        },
      ],
      interactions: [],
    },
  ],
}))

function offerStep(
  system: QuestSystem,
  step: FoundingStep,
  origin: Pick<QuestInstance, 'regionId' | 'owner'>
): boolean {
  return system.offer({
    id: step.id,
    definitionId: step.id,
    regionId: origin.regionId,
    owner: origin.owner,
    assigneeId: null,
    parameters: {},
    bindings: {},
    status: 'available',
    stageId: 'develop',
    facts: {},
    usedInteractions: [],
    markers: {},
    unread: true,
    repeatable: false,
  })
}

export function assignVillageFoundingQuests(
  context: GameContextLike,
  system: QuestSystem,
  companion: UnitEntity
): void {
  const player = context.player
  const regionId = context.map?.worldRegionId ?? context.getCurrentWorldId?.() ?? ''
  if (!player?.label || !regionId) return
  // Existing saves continue their current guide; never insert new prerequisites retroactively.
  if (system.state?.quests.some(q => steps.some(step => step.id === q.definitionId))) return
  if (
    !offerStep(system, steps[0], {
      regionId,
      owner: { entityLabel: companion.label, playerLabel: player.label, name: companion.name || player.name || '' },
    })
  )
    return
  system.accept(steps[0].id, player.label)
  system.track(steps[0].id)
  const origin = system.state?.quests.find(q => q.id === steps[0].id)
  if (origin && offerStep(system, defense, origin)) system.accept(defense.id, player.label)
  updateVillageFoundingQuests(context, system)
}

/** A single active task; completed local buildings also count when built ahead of the guide. */
export function updateVillageFoundingQuests(context: GameContextLike, system: QuestSystem): void {
  const state = system.state
  const player = context.player
  if (!state || !player) return
  const regionId = context.map?.worldRegionId ?? context.getCurrentWorldId?.() ?? ''
  let changed = observeCampPreparation(context, state)
  const houseBuilt = (player.buildings ?? []).some(
    b => b.type === BUILDING_TYPES.house && b.isBuilt && !b.isDead && !b.isDestroyed
  )
  const optional = state.quests.find(
    q => q.id === CAMP_SPEAR && q.status === 'active' && q.assigneeId === player.label && q.regionId === regionId
  )
  if (optional && hasEquippedCampSpear(context.controls?.heroUnit)) {
    optional.facts.done = true
    optional.status = 'completed'
    optional.unread = true
    if (state.trackedQuestId === optional.id) state.trackedQuestId = null
    changed = true
    context.menu?.showMessage?.(t('campSpearCompleted'), 'success')
  }
  let guideCompleted = false
  let nextObjective: string | null = null
  for (const [index, step] of steps.entries()) {
    const quest = state.quests.find(item => item.definitionId === step.id && item.status === 'active')
    if (!quest || quest.assigneeId !== player.label || quest.regionId !== regionId) continue
    const count =
      step.kind === 'preparation'
        ? Number(houseBuilt || campPreparationDone(state, step.id))
        : step.kind === 'building'
          ? player.buildings.filter(
              building =>
                step.types.includes(building.type) && building.isBuilt && !building.isDead && !building.isDestroyed
            ).length
          : (player.units ?? []).filter(
              unit =>
                step.types.includes(unit.type) &&
                !unit.isDead &&
                !unit.isDestroyed &&
                !unit.trainingTargetType &&
                unit.controlMode !== 'hero' &&
                unit !== context.controls?.heroUnit
            ).length
    if (count < step.count) break
    const tracked = state.trackedQuestId
    quest.facts.done = true
    quest.status = 'completed'
    quest.unread = true
    changed = true
    guideCompleted = true
    if (tracked === quest.id) state.trackedQuestId = null
    const next = steps[index + 1]
    nextObjective = next ? `${next.text}Objective` : null
    if (next && offerStep(system, next, quest)) {
      system.accept(next.id, player.label)
      // Preserve another quest's tracking, or the player's choice to hide the guide.
      state.trackedQuestId = tracked === quest.id ? next.id : tracked
    }
  }
  if (!changed) return
  if (guideCompleted)
    context.menu?.showMessage?.(
      nextObjective ? t('foundingNext', { objective: t(nextObjective) }) : t('foundingCompleted'),
      'success'
    )
  context.autosave?.()
}
