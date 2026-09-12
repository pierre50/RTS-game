import { updateInstanceVisibility } from '../../lib/grid/visibility'
import { BUILDING_TYPES, UNIT_TYPES, SHEET_TYPES } from '../../constants'
import { getInstanceDegree } from '../../lib/maths'
import { ensureAndRefreshBakedLpcUnitAssets } from '../../lib/lpc'
import { t } from '../../lib/lang'
import { findIntroductionPlacement } from './IntroductionPlacement'
import type { GameContextLike } from '../../types/context'
import type { CampaignSave } from '../../types/save'

type IntroductionHost = {
  _campaignSave: CampaignSave | null
  _gameContext(): GameContextLike
  autosave(): unknown
  togglePause(paused: boolean, options?: { silent?: boolean }): void
}

/** Called only by new-game boot, never by travel, load or restart. */
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
    },
    { preserveType: true }
  )
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
    worldId: campaign.currentWorldId,
    companionLabel: companion.label,
    campfireLabel: camp.label,
  }
  host.autosave()
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
  if (!companion || !context.menu?.openNpcOrders) return
  host.togglePause(true, { silent: true })
  context.controls?.heroUnit?.stop?.()
  companion.stop?.()
  context.menu.closeNpcOrders?.()
  context.menu.openNpcOrders([companion], {
    chatterLine: t('introductionCampDialogue'),
    ordersEnabled: false,
    scriptedReply: {
      label: t('introductionCampReply'),
      onSelect: () => {
        // Saving can replace the campaign object while this dialogue is open.
        const current = host._campaignSave?.introduction
        if (!current || current.status !== 'prepared' || current.companionLabel !== companion.label) return
        current.status = 'completed'
        context.menu?.closeNpcOrders?.()
        host.togglePause(false, { silent: true })
        host.autosave()
      },
    },
  })
}
