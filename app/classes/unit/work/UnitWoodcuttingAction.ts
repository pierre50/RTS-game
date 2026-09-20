import { definedProperties } from '../../../lib/definedProperties'
import { LOADING_TYPES, MENU_INFO_IDS, RESOURCE_TYPES, SOUND_CUES } from '../../../constants'
import { showDamageFeedback, showResourceGainFeedback, SLASH_IMPACT_FRAME } from '../../../lib'
import { syncEntityHealthDisplay } from '../../../lib/entities/entityHealthDisplay'
import { spawnWorkImpactFragments } from '../../../lib/entities/workImpactFragments'
import { isHeroControlled } from '../../../lib/units/unitControl'
import { spendOrWaitForEnergy } from '../../../lib/units/unitEnergy'
import { grantUnitXp, XP_CATEGORIES, XP_FELL_TREE_TICK } from '../../../lib/units/unitExperience'
import type { ResourceEntity, RuntimeEntity } from '../../../types/entities'
import { stopManualHeroAction } from '../UnitManualHeroWork'
import {
  addGatheredResource,
  clampDepletedBerrybushHitPoints,
  getGatherAmount,
  isChoppableBerrybush,
  isResourceEntity,
  notifyIfHeroResourceCarryFull,
  sendVillagerToDeliveryIfFull,
  shouldReleaseGatheredResource,
} from '../UnitResourceGathering'
import { finishWorkSwing, getWorkAnimationReleaseFrame } from './UnitWorkSwing'

import type { UnitResourceActions } from '../UnitResourceActions'

export function handleChopWoodAction(runtime: UnitResourceActions) {
  const unit = runtime.unit
  if (!runtime.prepareLoopingWorkAction()) return
  const sprite = unit.sprite
  if (!sprite) return
  const workTickFrame = getWorkAnimationReleaseFrame(unit, SLASH_IMPACT_FRAME)
  runtime.bindWorkImpact(workTickFrame, () => chopImpact(runtime, workTickFrame))
}

function chopImpact(runtime: UnitResourceActions, workTickFrame: number): void {
  const unit = runtime.unit

  const dest = isResourceEntity(unit.dest) ? unit.dest : null
  if (!unit.getActionCondition?.(dest)) {
    if ((dest?.quantity ?? 0) <= 0) {
      dest?.die?.()
    }
    unit.affectNewDest?.()
    return
  }
  if (!dest) return
  if (!runtime.ensureWorkContact(dest)) return
  if (!spendOrWaitForEnergy(unit, unit.action, dest)) {
    if (isHeroControlled(unit)) stopManualHeroAction(unit)
    return
  }
  spawnWorkImpactFragments(unit, dest)
  runtime.playSound(runtime.getWorkSound('chopWood', SOUND_CUES.villager.chopWood))
  if ((dest.hitPoints ?? 0) > 0) {
    damageChoppableResource(runtime, dest)
  } else if (!isChoppableBerrybush(dest)) {
    if (!collectChoppedWood(runtime, dest, workTickFrame)) return
  }
  finishWorkSwing(unit, workTickFrame, workTickFrame)
}

function damageChoppableResource(runtime: UnitResourceActions, dest: ResourceEntity): void {
  const unit = runtime.unit
  const menu = unit.context?.menu
  const player = unit.owner
  clampDepletedBerrybushHitPoints(dest)
  const previousHitPoints = dest.hitPoints ?? 0
  dest.hitPoints = Math.max(previousHitPoints - 1, 0)
  showDamageFeedback(dest, previousHitPoints - (dest.hitPoints ?? 0))
  grantUnitXp(unit, XP_CATEGORIES.woodcutting, XP_FELL_TREE_TICK)
  if (dest.selected) {
    syncEntityHealthDisplay(dest, definedProperties({ menu, player, emptyWhenDepleted: true }))
  }
  if ((dest.hitPoints ?? 0) <= 0) {
    dest.hitPoints = 0
    if (dest.type === RESOURCE_TYPES.berrybush) {
      dest.die?.()
      unit.affectNewDest?.()
    } else {
      dest.setCuttedTreeTexture?.()
    }
  }
}

function collectChoppedWood(runtime: UnitResourceActions, dest: RuntimeEntity, workTickFrame: number): boolean {
  const unit = runtime.unit
  const menu = unit.context?.menu
  const requestedGain = getGatherAmount(unit)
  if (!shouldReleaseGatheredResource(unit, dest, LOADING_TYPES.wood)) {
    finishWorkSwing(unit, workTickFrame, workTickFrame)
    return false
  }
  const gain = addGatheredResource(unit, LOADING_TYPES.wood, requestedGain)
  if (gain <= 0) {
    if (isHeroControlled(unit)) {
      notifyIfHeroResourceCarryFull(unit)
      stopManualHeroAction(unit)
    } else unit.sendToDelivery?.()
    return false
  }
  grantUnitXp(unit, XP_CATEGORIES.woodcutting, gain)
  dest.quantity = Math.max((dest.quantity ?? 0) - gain, 0)
  showResourceGainFeedback(unit, gain)
  if (dest.selected) {
    menu?.updateInfo?.(MENU_INFO_IDS.quantityText, dest.quantity)
  }
  if ((dest.quantity ?? 0) <= 0) {
    dest.die?.()
    unit.affectNewDest?.()
  } else if (sendVillagerToDeliveryIfFull(unit, LOADING_TYPES.wood)) {
    unit.gatherProgressState = null
  }
  return true
}
