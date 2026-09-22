import { BUILDING_TYPES, UNIT_TYPES, SHEET_TYPES } from '../../constants'
import { refreshPlayerVisibility } from '../UnitPerception'
import { tutorialHuntQuest } from '../quests/TutorialHuntQuest'
import { t } from '../../lib/lang'
import { getInstanceDegree } from '../../lib/maths'
import { getMapSpace, moveEntityToMapSpace } from '../../lib/mapSpaces'
import { ensureAndRefreshBakedLpcUnitAssets } from '../../lib/lpc'
import { setUnitOverheadIndicator, clearUnitOverheadIndicator } from '../../lib/entities/overheadIndicator'
import {
  ensureBuildingInteriorSpace, activateBuildingInteriorSpace, getBuildingInteriorSpaceForUnit,
  refreshMapSpaceEntityVisibility, routeUnitOutOfBuildingInteriorSpace,
} from '../BuildingInteriorSpaceSystem'
import { prepareUnitForSpaceTransfer, routeUnitThroughSpacePortal } from '../SpacePortalSystem'
import { setSleepingOutsideFinalVisual, playSleepingWakeVisual } from '../rest/UnitSleepVisuals'
import type { BuildingInteriorRuntimeSpace } from '../BuildingInteriorSpaceSystem'
import type { GameContextLike } from '../../types/context'
import type { CampaignSave } from '../../types/save'
import type { BuildingEntity, UnitEntity } from '../../types/entities'
import type { MapBlueprint } from '../../classes/map/MapGenerationTypes'

type TutorialHost = {
  _campaignSave: CampaignSave | null
  _activeBuildingInteriorSpace: BuildingInteriorRuntimeSpace | null
  _gameContext(): GameContextLike
  _loadRequiredInteriorBlueprint(options: { buildingType: string; buildingSize: number; random: () => number }): Promise<MapBlueprint | undefined>
  togglePause(paused: boolean, options?: { silent?: boolean }): void
  autosave(): unknown
}

/** The first playable tutorial step. The camp introduction is reserved for its later ending. */
export async function prepareTutorialOpening(host: TutorialHost): Promise<void> {
  const campaign = host._campaignSave
  if (!campaign || campaign.tutorial || campaign.introduction) return
  const context = host._gameContext()
  const { map, player } = context
  const hero = context.controls?.heroUnit
  if (!map || !player?.createUnit || !hero) throw new Error('Cannot prepare the tutorial without a hero.')
  const village = (context.players ?? [player]).find(owner => !owner.isPlayed && owner.type === 'AI' && owner.civ === player.civ) ?? player
  const center = village.buildings.find(building =>
    building.type === BUILDING_TYPES.townCenter && building.isBuilt && !building.isDead && !building.isDestroyed
  ) ?? hero
  const house = village.buildings.filter(building =>
    building.type === BUILDING_TYPES.house && building.isBuilt && !building.isDead && !building.isDestroyed
  ).sort((a, b) =>
    Math.abs(b.i - center.i) + Math.abs(b.j - center.j) - Math.abs(a.i - center.i) - Math.abs(a.j - center.j)
  )[0]
  const chief = village.units.find(unit => unit.type === UNIT_TYPES.chief && !unit.isDead && !unit.isDestroyed)
  if (!house || !chief) throw new Error('The generated tutorial village requires a house and chief.')
  host.togglePause(true, { silent: true })
  hero.isChief = false
  refreshPlayerVisibility(context)
  chief.isChief = true
  chief.lookingAtHero = true
  await ensureAndRefreshBakedLpcUnitAssets(chief)
  await placeTutorialActors(host, house, hero, chief)
  resetTutorialOutsideExploration(context)
  // Autosaves can replace the campaign while the interior loads.
  // Publish the opening state on the live campaign, not the earlier snapshot.
  if (!host._campaignSave) throw new Error('The tutorial campaign is unavailable.')
  host._campaignSave.tutorial = { stage: 'sleeping', worldId: campaign.currentWorldId, houseLabel: house.label, chiefLabel: chief.label }
  host.autosave()
}

/** The temporary spawn near the TownCenter is not part of the playable tutorial. */
function resetTutorialOutsideExploration(context: GameContextLike): void {
  const { player, map, menu } = context
  const reset = () => {
    let removed = 0
    for (const row of map.grid) {
      for (const cell of row) {
        if (cell && player.views.isViewed(cell.i, cell.j)) removed++
      }
    }
    player.views.clearVisibility()
    player.views.clearExploration()
    player.cellViewed = Math.max(0, player.cellViewed - removed)

  }
  if (player.views.withSpace) player.views.withSpace('outside', reset)
  else reset()
  menu.rebuildTerrainMiniMapFromViews?.()
  menu.updateResourcesMiniMap?.()
}

async function placeTutorialActors(host: TutorialHost, house: BuildingEntity, hero: UnitEntity, chief: UnitEntity): Promise<void> {
  const context = host._gameContext()
  const map = context.map
  const size = Number(house.size ?? 2)
  const blueprint = await host._loadRequiredInteriorBlueprint({ buildingType: house.type, buildingSize: size, random: () => map.random() })
  if (!blueprint) throw new Error('The tutorial house interior is unavailable.')
  const space = ensureBuildingInteriorSpace(context, house, blueprint)
  const free = space.idleCells.filter(cell => !cell.solid && !cell.has && cell !== space.entryCell)
  const heroCell = free.find(cell => free.some(other => Math.abs(cell.i - other.i) + Math.abs(cell.j - other.j) === 1))
  const chiefCell = heroCell && free.find(cell => Math.abs(cell.i - heroCell.i) + Math.abs(cell.j - heroCell.j) === 1)
  if (!heroCell || !chiefCell) throw new Error('No room for the tutorial characters inside the house.')
  prepareUnitForSpaceTransfer(hero)
  prepareUnitForSpaceTransfer(chief)
  moveEntityToMapSpace(map, hero, space, heroCell)
  if (host._campaignSave?.tutorial?.stage === 'dialogue') {
    moveEntityToMapSpace(map, chief, space, chiefCell)
  } else {
    const outside = getMapSpace(map, space.entryPortal.sourceSpaceId)
    if (!outside || !space.entryPortal.sourceCell) throw new Error('The tutorial house entrance is unavailable.')
    moveEntityToMapSpace(map, chief, outside, space.entryPortal.sourceCell)
  }
  chief.lookingAtHero = true
  activateBuildingInteriorSpace(context, space)
  host._activeBuildingInteriorSpace = space
  refreshMapSpaceEntityVisibility(context)
}

/** House saves normally project occupants outside; restore only the unfinished scripted scene. */
export async function restoreTutorialOpening(host: TutorialHost): Promise<void> {
  const state = host._campaignSave?.tutorial
  if (!state || state.stage === 'wood-requested' || state.worldId !== host._campaignSave?.currentWorldId) return
  const context = host._gameContext()
  // Older saves assigned this quest before the opening conversation was completed.
  const journal = context.getQuestJournal?.()
  const prematureQuestId = JSON.stringify(['tutorial-wood', state.worldId, state.chiefLabel])
  if (journal?.quests.some(quest => quest.id === prematureQuestId && quest.stageId === 'wood')) {
    journal.quests = journal.quests.filter(quest => quest.id !== prematureQuestId)
    if (journal.trackedQuestId === prematureQuestId) journal.trackedQuestId = null
  }
  const hero = context.controls?.heroUnit
  if (!hero || getBuildingInteriorSpaceForUnit(hero)) return
  const chief = (context.players ?? [context.player]).flatMap(player => player?.units ?? []).find(unit => unit.label === state.chiefLabel && !unit.isDead && !unit.isDestroyed)
  const house = (context.players ?? [context.player]).flatMap(player => player?.buildings ?? []).find(building => building.label === state.houseLabel && !building.isDead && !building.isDestroyed)
  if (!chief || !house) throw new Error('The saved tutorial characters or house are missing.')
  await placeTutorialActors(host, house, hero, chief)
}

const pendingStarts = new WeakMap<TutorialHost, () => void>()

export function showTutorialOpening(host: TutorialHost): void {
  const state = host._campaignSave?.tutorial
  if (!state || state.worldId !== host._campaignSave?.currentWorldId || pendingStarts.has(host)) return
  const context = host._gameContext()
  const hero = context.controls?.heroUnit
  const chief = (context.players ?? [context.player]).flatMap(player => player?.units ?? []).find(unit => unit.label === state.chiefLabel && !unit.isDead && !unit.isDestroyed)
  if (!hero || !chief) return
  const assignWoodQuest = () => context.neutralQuests?.assignResourceRequest(
    JSON.stringify(['tutorial-wood', state.worldId, chief.label]), chief, 'wood', 10, tutorialHuntQuest.id
  )
  const leave = () => {
    chief.lookingAtHero = false
    routeUnitOutOfBuildingInteriorSpace(context, chief, getBuildingInteriorSpaceForUnit(chief), {
      onTransferred: () => {
        if (host._gameContext().map !== context.map || chief.isDead || chief.isDestroyed) return
        const center = chief.owner?.buildings.find(building =>
          building.type === BUILDING_TYPES.townCenter && building.isBuilt && !building.isDead && !building.isDestroyed
        )
        if (center) chief.sendTo?.(center)
      },
    })
  }
  if (state.stage === 'wood-requested') {
    assignWoodQuest()
    if (getBuildingInteriorSpaceForUnit(chief)) pendingStarts.set(host, leave)
    return
  }
  host.togglePause(true, { silent: true })
  context.menu?.setHudSuppressed?.(true)
  context.controls?.setRuntimeInputEnabled?.(false)
  hero.isChief = false
  refreshPlayerVisibility(context)
  hero.stop?.()
  chief.lookingAtHero = true
  chief.stop?.()
  hero.actionLocked = true
  chief.degree = getInstanceDegree(chief, hero.x, hero.y)
  chief.setTextures?.(SHEET_TYPES.standing)
  const current = () => host._gameContext().map === context.map &&
    host._campaignSave?.tutorial?.chiefLabel === chief.label && !hero.isDestroyed && !chief.isDestroyed
  const dialogue = () => {
    if (!current()) return
    host._campaignSave!.tutorial!.stage = 'dialogue'
    hero.degree = getInstanceDegree(hero, chief.x, chief.y)
    hero.setTextures?.(SHEET_TYPES.standing)
    host.autosave()
    context.menu?.openNpcOrders?.([chief], {
      ordersEnabled: false,
      dialogue: {
        startId: ['wake', 'polite', 'rebel'].includes(state.dialogueNodeId ?? '') ? state.dialogueNodeId! : 'wake',
        nodes: [
          { id: 'wake', line: t('tutorialWakeChief'), choices: [
            { id: 'polite', label: t('tutorialWakePolite'), nextId: 'polite' },
            { id: 'rebel', label: t('tutorialWakeRebel'), nextId: 'rebel' },
          ] },
          { id: 'polite', line: t('tutorialWoodPolite'), choices: [{ id: 'accept', label: t('tutorialWakeReply') }] },
          { id: 'rebel', line: t('tutorialWoodRebel'), choices: [{ id: 'accept', label: t('tutorialWoodRebelReply') }] },
        ],
        onNodeChanged: nodeId => {
          if (!current()) return
          host._campaignSave!.tutorial!.dialogueNodeId = nodeId
          host.autosave()
        },
        onComplete: () => {
          if (!current() || host._campaignSave?.tutorial?.stage !== 'dialogue') return
          if (!assignWoodQuest()) return
          host._campaignSave.tutorial.stage = 'wood-requested'
          hero.actionLocked = false
          context.menu?.closeNpcOrders?.()
          context.menu?.setHudSuppressed?.(false)
          context.controls?.setRuntimeInputEnabled?.(true)
          leave()
          host.autosave()
        },
      },
    })
  }
  if (state.stage === 'sleeping') {
    setSleepingOutsideFinalVisual(hero)
    setUnitOverheadIndicator(hero, 'sleep')
  }
  pendingStarts.set(host, () => {
    host.togglePause(false, { silent: true })
    if (state.stage === 'dialogue') { dialogue(); return }
    context.scheduler.addOneShot(() => {
      if (!current()) return
      const space = getBuildingInteriorSpaceForUnit(hero)
      if (!space) return
      const arrival = space.idleCells.find(cell =>
        !cell.solid && (!cell.has || cell.has === chief) &&
        Math.abs(cell.i - hero.i) + Math.abs(cell.j - hero.j) === 1)
      if (!arrival) throw new Error('The tutorial chief cannot approach the hero.')
      const approach = () => {
        if (!current()) return
        chief.lookingAtHero = true
        chief.sendToEvt?.(arrival, null, { forceRepath: true, preserveAutonomy: true })
        const task = context.scheduler.add(() => {
          if (!current()) { context.scheduler.remove(task); return }
          if (chief.i !== arrival.i || chief.j !== arrival.j || chief.path?.length) return
          context.scheduler.remove(task)
          chief.stop?.()
          chief.degree = getInstanceDegree(chief, hero.x, hero.y)
          chief.setTextures?.(SHEET_TYPES.standing)
          clearUnitOverheadIndicator(hero, { fade: false })
          playSleepingWakeVisual(hero, dialogue)
        }, 100, 'tutorial.approach')
      }
      if (getBuildingInteriorSpaceForUnit(chief) === space) approach()
      else routeUnitThroughSpacePortal(context, chief, space.entryPortal, {
        shouldContinue: current, onTransferred: approach,
      })
    }, 900, 'tutorial.enter')
  })
}

export function startTutorialOpening(host: TutorialHost): void {
  const start = pendingStarts.get(host)
  pendingStarts.delete(host)
  start?.()
}
