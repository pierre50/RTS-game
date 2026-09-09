import { definedProperties } from '../../../lib/definedProperties'
import { SOUND_CUES } from '../../../constants'
import { showHitPointGainFeedback, SLASH_IMPACT_FRAME } from '../../../lib'
import { syncEntityHealthDisplay } from '../../../lib/entities/entityHealthDisplay'
import { spawnWorkImpactFragments } from '../../../lib/entities/workImpactFragments'
import { isHeroControlled } from '../../../lib/units/unitControl'
import { spendOrWaitForEnergy } from '../../../lib/units/unitEnergy'
import { getBuildRateXpMultiplier, grantUnitXp, XP_BUILD_TICK, XP_CATEGORIES } from '../../../lib/units/unitExperience'
import type { BuildingEntity } from '../../../types/entities'
import { shouldSyncBuildHealthDisplay } from '../UnitBuildVisuals'
import { stopManualHeroAction } from '../UnitManualHeroWork'
import { isBuildingEntity } from '../UnitResourceGathering'
import { finishWorkSwing, getWorkAnimationReleaseFrame } from './UnitWorkSwing'

import type { UnitResourceActions } from '../UnitResourceActions'

export function handleBuildAction(runtime: UnitResourceActions) {
  const unit = runtime.unit
  if (!runtime.prepareLoopingWorkAction()) return
  const sprite = unit.sprite
  if (!sprite) return
  const workTickFrame = getWorkAnimationReleaseFrame(unit, SLASH_IMPACT_FRAME)
  runtime.bindWorkImpact(workTickFrame, () => buildImpact(runtime, workTickFrame))
}

function buildImpact(runtime: UnitResourceActions, workTickFrame: number): void {
  const unit = runtime.unit

  const dest = isBuildingEntity(unit.dest) ? unit.dest : null
  if (!unit.getActionCondition?.(dest)) {
    if (dest?.isBuilt && unit.continueBuildingQueue?.()) return
    unit.affectNewDest?.()
    return
  }
  if (!dest) return
  if ((dest.hitPoints ?? 0) < (dest.totalHitPoints ?? 0)) {
    if (!runtime.ensureWorkContact(dest)) return
    if (!spendOrWaitForEnergy(unit, unit.action, dest)) {
      if (isHeroControlled(unit)) stopManualHeroAction(unit)
      return
    }
    advanceConstruction(runtime, dest)
  } else {
    if (!dest.isBuilt) {
      dest.updateHitPoints?.(unit.action ?? '')
      dest.isBuilt = true
    }
    if (unit.continueBuildingQueue?.()) return
    unit.affectNewDest?.()
  }
  finishWorkSwing(unit, workTickFrame, workTickFrame)
}

function advanceConstruction(runtime: UnitResourceActions, dest: BuildingEntity): void {
  const unit = runtime.unit
  const menu = unit.context?.menu
  const player = unit.owner
  spawnWorkImpactFragments(unit, dest)
  runtime.playSound(runtime.getWorkSound('build', SOUND_CUES.villager.buildLoop))
  const beforeHitPoints = dest.hitPoints ?? 0
  dest.hitPoints = Math.min(
    Math.round(
      beforeHitPoints + ((dest.totalHitPoints ?? 0) / (dest.constructionTime ?? 1)) * getBuildRateXpMultiplier(unit)
    ),
    dest.totalHitPoints ?? 0
  )
  showHitPointGainFeedback(dest, (dest.hitPoints ?? 0) - beforeHitPoints)
  grantUnitXp(unit, XP_CATEGORIES.building, XP_BUILD_TICK)
  if (shouldSyncBuildHealthDisplay(dest)) {
    syncEntityHealthDisplay(dest, definedProperties({ menu, player, forceInfo: unit.owner?.isPlayed }))
  }
  dest.updateHitPoints?.(unit.action ?? '')
}
