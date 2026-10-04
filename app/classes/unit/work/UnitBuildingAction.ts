import { getForgeBuildMultiplier } from '../../../lib/equipment/forgeUpgrades'
import { notifyVillageWorkChanged } from '../../../lib/units/villageWorkEvents'
import { t } from '../../../lib/lang'
import {
  advanceMaterialConstruction,
  applyConstructionWork,
  constructionWorkSite,
  constructionWorkPoints,
  missingConstructionMaterialsForNextPoint,
} from '../../../lib/economy/constructionMaterials'
import { advanceConstruction as advanceConstructionProgress } from '../../../lib/economy/workRules'
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
  if (blockUnfundedBuild(runtime)) return
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
  if (!dest.isBuilt || dest.buildingUpgrade || (dest.hitPoints ?? 0) < (dest.totalHitPoints ?? 0)) {
    if (!runtime.ensureWorkContact(dest)) return
    if (blockUnfundedBuild(runtime)) return
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
  const site = constructionWorkSite(dest)
  const beforeWork = constructionWorkPoints(dest)
  const requested = advanceConstructionProgress(
    beforeWork,
    site.totalHitPoints ?? 0,
    dest.buildingUpgrade?.constructionTime ?? dest.constructionTime ?? 1,
    getBuildRateXpMultiplier(unit) * getForgeBuildMultiplier(unit.owner, unit.type)
  )
  const next = advanceMaterialConstruction(dest, requested, [unit.inventory?.resources ?? {}])
  if (next === beforeWork) return
  const healthBefore = dest.hitPoints ?? 0
  applyConstructionWork(dest, next)
  notifyVillageWorkChanged(unit.owner)
  spawnWorkImpactFragments(unit, dest)
  runtime.playSound(runtime.getWorkSound('build', SOUND_CUES.villager.buildLoop))
  if (!dest.buildingUpgrade) showHitPointGainFeedback(dest, (dest.hitPoints ?? 0) - healthBefore)
  grantUnitXp(unit, XP_CATEGORIES.building, XP_BUILD_TICK)
  if (shouldSyncBuildHealthDisplay(dest)) {
    syncEntityHealthDisplay(dest, definedProperties({ menu, player, forceInfo: unit.owner?.isPlayed }))
  }
  dest.updateHitPoints?.(unit.action ?? '')
}

function blockUnfundedBuild(runtime: UnitResourceActions): boolean {
  const unit = runtime.unit
  if (!isBuildingEntity(unit.dest)) return false
  const missing = missingConstructionMaterialsForNextPoint(unit.dest, unit.inventory?.resources)
  if (!Object.keys(missing).length) return false
  if (!isHeroControlled(unit)) {
    // stop() resumes autonomous work first; release the job so the collective planner can resupply.
    unit.autonomousJob = null
    unit.collectiveTask = 'construction'
    unit.stop?.()
    unit.work = null
    notifyVillageWorkChanged(unit.owner)
    return true
  }
  const resources = Object.entries(missing)
    .map(([key, count]) => `${count} ${t(key)}`)
    .join(', ')
  unit.context?.menu?.showMessage(t('constructionMissingMaterials', { resources }), 'warning')
  stopManualHeroAction(unit)
  return true
}
