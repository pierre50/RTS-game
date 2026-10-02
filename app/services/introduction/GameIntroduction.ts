import { assignVillageFoundingQuests } from '../quests/VillageFoundingQuests'
import { QuestSystem } from '../quests/QuestSystem'
import { startingVillagerInventory } from '../../lib/economy/startingProvisions'
import { createCampIntroductionDialogue } from './CampIntroductionDialogue'
import { refreshPlayerVisibility } from '../visibility/UnitPerception'
import { updateInstanceVisibility } from '../../lib/grid/visibility'
import { BUILDING_TYPES, UNIT_TYPES, SHEET_TYPES } from '../../constants'
import { getInstanceDegree } from '../../lib/maths'
import { ensureAndRefreshBakedLpcUnitAssets } from '../../lib/lpc'
import { setSleepingOutsideFinalVisual, playSleepingWakeVisual } from '../rest/UnitSleepVisuals'
import { setUnitOverheadIndicator, clearUnitOverheadIndicator } from '../../lib/entities/overheadIndicator'
import { findIntroductionPlacement } from './IntroductionPlacement'
import { traceLoad } from '../../lib/loadDiagnostics'
import type { GameContextLike } from '../../types/context'
import type { CampaignSave } from '../../types/save'

type IntroductionHost = {
  _campaignSave: CampaignSave | null
  _initialSaveFailed?: boolean
  _gameContext(): GameContextLike
  autosave(): unknown
  togglePause(paused: boolean, options?: { silent?: boolean }): void
}

/** Called only by new-game boot, never by travel or load. */
export async function prepareGameIntroduction(host: IntroductionHost): Promise<void> {
  const campaign = host._campaignSave
  if (!campaign || campaign.introduction) return
  const context = host._gameContext()
  const hero = context.controls?.heroUnit
  const player = context.player
  const map = context.map
  if (!hero || !player?.createUnit || !map || (hero.spaceId && hero.spaceId !== 'outside'))
    throw new Error('Unable to place the starting camp.')
  const placement = findIntroductionPlacement(
    map,
    hero,
    Number(player.config.buildings[BUILDING_TYPES.fireCamp]?.size ?? 1)
  )
  if (!placement) throw new Error('No accessible space for the starting camp.')
  host.togglePause(true, { silent: true })
  hero.isChief = false
  refreshPlayerVisibility(context)
  const camp = player.createBuilding({
    type: BUILDING_TYPES.fireCamp,
    i: placement.camp.i,
    j: placement.camp.j,
    isBuilt: true,
  })
  const companion = player.createUnit(
    {
      type: UNIT_TYPES.villager,
      i: placement.companion.i,
      j: placement.companion.j,
      gender: (hero.gender ?? hero.appearanceVariants?.gender) === 'female' ? 'male' : 'female',
      isChief: false,
      suppressCreateSound: true,
      inventory: startingVillagerInventory(),
    },
    { preserveType: true }
  )
  // createUnit doesn't bump population itself (unlike building-trained units) — do it here so
  // the starting village isn't reported as empty (e.g. offline-economy summaries, alerts).
  player.population = (player.population ?? 0) + 1
  hero.stop?.()
  companion.stop?.()
  companion.degree = getInstanceDegree(companion, hero.x, hero.y)
  hero.degree = getInstanceDegree(hero, companion.x, companion.y)
  companion.setTextures?.(SHEET_TYPES.standing)
  hero.setTextures?.(SHEET_TYPES.standing)
  await ensureAndRefreshBakedLpcUnitAssets(companion)
  updateInstanceVisibility(companion)
  campaign.introduction = {
    status: 'prepared',
    phase: 'approaching',
    arrival: { i: placement.arrival.i, j: placement.arrival.j },
    worldId: campaign.currentWorldId,
    companionLabel: companion.label,
    campfireLabel: camp.label,
  }
  // Capture the complete camp once, under the loading screen, before its animation starts.
  const saved = await host.autosave()
  host._initialSaveFailed = saved === null
}

const pendingStarts = new WeakMap<IntroductionHost, () => void>()

/** Begin movement only after the boot transition has revealed the camp. */
export function startGameIntroduction(host: IntroductionHost): void {
  const start = pendingStarts.get(host)
  pendingStarts.delete(host)
  start?.()
}

/** Also called after loading a prepared introduction. Missing state means a legacy save. */
export function showGameIntroduction(host: IntroductionHost): void {
  const campaign = host._campaignSave
  const state = campaign?.introduction
  if (!campaign || !state || state.status !== 'prepared' || state.worldId !== campaign.currentWorldId) return
  const context = host._gameContext()
  const companion = context.player?.units.find(
    unit => unit.label === state.companionLabel && !unit.isDead && !unit.isDestroyed
  )
  const hero = context.controls?.heroUnit
  if (!hero || !companion || !context.menu?.openNpcOrders) return
  if (pendingStarts.has(host)) return
  hero.isChief = false
  refreshPlayerVisibility(context)
  for (const player of context.players ?? [context.player]) {
    for (const unit of player?.units ?? []) unit.drawHealthBar?.()
  }
  context.menu.setHudSuppressed?.(true)
  host.togglePause(true, { silent: true })
  context.controls?.setRuntimeInputEnabled?.(false)
  hero.stop?.()
  companion.stop?.()
  const previousActionLocked = hero.actionLocked
  hero.actionLocked = true
  // Suppress autonomous jobs while the scripted movement owns this unit.
  companion.lookingAtHero = true
  const isCurrent = () =>
    host._gameContext().map === context.map &&
    host._campaignSave?.introduction?.status === 'prepared' &&
    host._campaignSave?.currentWorldId === state.worldId &&
    !hero.isDestroyed &&
    !companion.isDestroyed
  const setPhase = (phase: 'approaching' | 'waking' | 'dialogue') => {
    const current = host._campaignSave?.introduction
    if (current) current.phase = phase
  }
  const openDialogueNow = () => {
    if (!isCurrent()) return
    hero.degree = getInstanceDegree(hero, companion.x, companion.y)
    companion.degree = getInstanceDegree(companion, hero.x, hero.y)
    hero.setTextures?.(SHEET_TYPES.standing)
    companion.setTextures?.(SHEET_TYPES.standing)
    setPhase('dialogue')
    host.togglePause(false, { silent: true })
    context.menu?.closeNpcOrders?.()
    context.menu?.openNpcOrders?.([companion], {
      ordersEnabled: false,
      dialogue: createCampIntroductionDialogue({
        nodeId: state.dialogueNodeId,
        onNodeChanged: nodeId => {
          if (!isCurrent()) return
          host._campaignSave!.introduction!.dialogueNodeId = nodeId
        },
        onComplete: () => {
          if (!isCurrent()) return
          const current = host._campaignSave!.introduction!
          // Discard even the partial final tutorial day before enabling world simulation.
          if (context.isTutorialActive?.()) context.updateWorldEconomy?.()
          current.status = 'completed'
          assignVillageFoundingQuests(context, new QuestSystem(() => context.getQuestJournal?.() ?? null), companion)
          hero.isChief = true
          refreshPlayerVisibility(context)
          for (const player of context.players ?? [context.player]) {
            for (const unit of player?.units ?? []) unit.drawHealthBar?.()
          }
          hero.actionLocked = previousActionLocked
          companion.lookingAtHero = false
          context.menu?.closeNpcOrders?.()
          context.menu?.setHudSuppressed?.(false)
          context.controls?.setRuntimeInputEnabled?.(true)
          host.togglePause(false, { silent: true })
          host.autosave()
        },
      }),
    })
  }
  const openDialogue = () => traceLoad('introduction.dialogue', openDialogueNow)
  if (!state.phase || state.phase === 'dialogue') {
    pendingStarts.set(host, openDialogue)
    return
  }
  setSleepingOutsideFinalVisual(hero)
  setUnitOverheadIndicator(hero, 'sleep')
  const wake = () => {
    if (!isCurrent()) return
    companion.stop?.()
    clearUnitOverheadIndicator(hero, { fade: false })
    setPhase('waking')
    traceLoad('introduction.wakeVisual', () => playSleepingWakeVisual(hero, openDialogue))
  }
  pendingStarts.set(host, () => {
    if (!isCurrent()) return
    host.togglePause(false, { silent: true })
    if (state.phase === 'waking') {
      wake()
      return
    }
    const scheduler = context.scheduler
    scheduler.addOneShot(
      () => {
        if (!isCurrent()) return
        const arrival = state.arrival && context.map?.grid[state.arrival.i]?.[state.arrival.j]
        if (!arrival || (arrival.has && arrival.has !== companion) || arrival.solid) {
          wake()
          return
        }
        companion.sendTo?.(arrival)
        const startedAt = scheduler.elapsedMs
        const task = scheduler.add(
          () => {
            if (!isCurrent()) {
              scheduler.remove(task)
              return
            }
            const arrived = companion.i === arrival.i && companion.j === arrival.j && !companion.path?.length
            // A blocked path must never trap the player in the opening scene.
            if (arrived || scheduler.elapsedMs - startedAt >= 12000) {
              scheduler.remove(task)
              wake()
            }
          },
          100,
          'introduction.approach'
        )
      },
      900,
      'introduction.sleep'
    )
  })
}
