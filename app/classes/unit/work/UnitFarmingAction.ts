import { LOADING_TYPES, MENU_INFO_IDS, SOUND_CUES } from '../../../constants'
import { showResourceGainFeedback, SLASH_IMPACT_FRAME } from '../../../lib'
import { spawnWorkImpactFragments } from '../../../lib/entities/workImpactFragments'
import { isHeroControlled } from '../../../lib/units/unitControl'
import { spendOrWaitForEnergy } from '../../../lib/units/unitEnergy'
import { grantUnitXp, XP_CATEGORIES } from '../../../lib/units/unitExperience'
import type { RuntimeEntity } from '../../../types/entities'
import { stopManualHeroAction } from '../UnitManualHeroWork'
import {
  addGatheredResource,
  getGatherAmount,
  isFarmHarvestTarget,
  notifyIfHeroResourceCarryFull,
  sendVillagerToDeliveryIfFull,
  shouldReleaseGatheredResource,
} from '../UnitResourceGathering'
import { finishWorkSwing, getWorkAnimationReleaseFrame } from './UnitWorkSwing'

import type { UnitResourceActions } from '../UnitResourceActions'

export function handleFarmAction(runtime: UnitResourceActions) {
  const unit = runtime.unit
  if (!unit.getActionCondition?.(unit.dest)) {
    unit.affectNewDest?.()
    return
  }
  const dest = isFarmHarvestTarget(unit.dest) ? unit.dest : null
  if (!dest) return
  if (!isHeroControlled(unit)) dest.isUsedBy = unit
  if (!runtime.prepareLoopingWorkAction()) return
  const sprite = unit.sprite
  if (!sprite) return
  const workTickFrame = getWorkAnimationReleaseFrame(unit, SLASH_IMPACT_FRAME)
  runtime.bindWorkImpact(workTickFrame, () => farmImpact(runtime, workTickFrame))
}

function farmImpact(runtime: UnitResourceActions, workTickFrame: number): void {
  const unit = runtime.unit

  const d = isFarmHarvestTarget(unit.dest) ? unit.dest : null
  if (!unit.getActionCondition?.(d)) {
    if ((d?.quantity ?? 0) <= 0) {
      d?.die?.()
    }
    unit.affectNewDest?.()
    return
  }
  if (d && !isHeroControlled(unit)) d.isUsedBy = unit
  const requestedGain = getGatherAmount(unit)
  if (!d || requestedGain <= 0) {
    if (isHeroControlled(unit)) {
      if (d) {
        d.isUsedBy = null
      }
      stopManualHeroAction(unit)
      return
    }
    if (d) d.isUsedBy = null
    return
  }
  if (!runtime.ensureWorkContact(d)) return
  if (!spendOrWaitForEnergy(unit, unit.action, d)) {
    if (isHeroControlled(unit)) stopManualHeroAction(unit)
    return
  }
  harvestFarm(runtime, d, requestedGain, workTickFrame)
}

function harvestFarm(
  runtime: UnitResourceActions,
  d: RuntimeEntity,
  requestedGain: number,
  workTickFrame: number
): void {
  const unit = runtime.unit
  const menu = unit.context?.menu
  spawnWorkImpactFragments(unit, d)
  runtime.playSound(runtime.getWorkSound('gatherFood', SOUND_CUES.villager.gatherFood))
  if (!shouldReleaseGatheredResource(unit, d, LOADING_TYPES.wheat)) {
    finishWorkSwing(unit, SLASH_IMPACT_FRAME)
    return
  }
  const gain = addGatheredResource(unit, LOADING_TYPES.wheat, requestedGain)
  if (gain <= 0) {
    if (isHeroControlled(unit)) {
      notifyIfHeroResourceCarryFull(unit)
      stopManualHeroAction(unit)
    } else unit.sendToDelivery?.()
    return
  }
  grantUnitXp(unit, XP_CATEGORIES.farming, gain)
  d.quantity = Math.max((d.quantity ?? 0) - gain, 0)
  showResourceGainFeedback(unit, gain)
  if (d.selected) {
    menu?.updateInfo?.(MENU_INFO_IDS.quantityText, d.quantity)
  }
  if ((d.quantity ?? 0) <= 0) {
    d.die?.()
    unit.affectNewDest?.()
  } else if (sendVillagerToDeliveryIfFull(unit, LOADING_TYPES.wheat)) {
    unit.gatherProgressState = null
  }
  finishWorkSwing(unit, workTickFrame, workTickFrame)
}
