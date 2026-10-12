import { constructionAssignment, assignConstructionWork } from '../economy/constructionAssignments'
import { notifyVillageStateChanged } from '../units/village/villageStateEvents'
import type { BuildingEntity } from '../../types/entities'

export function canManageConstructionPause(building: BuildingEntity): boolean {
  return Boolean(
    building.owner &&
      (building.owner.isPlayed || building.owner === building.context?.player) &&
      (!building.isBuilt || building.buildingUpgrade) &&
      !building.isDead &&
      !building.isDestroyed &&
      (building.hitPoints ?? 1) > 0
  )
}

/** Keep cargo and work intact; release both builders and ingredient/transport missions immediately. */
export function setConstructionPaused(building: BuildingEntity, paused: boolean): boolean {
  if (!canManageConstructionPause(building) || Boolean(building.constructionPaused) === paused) return false
  // Capture claims while the site is still active: paused projects are intentionally absent from assignments.
  const workers = (building.owner?.units ?? []).filter(
    unit => constructionAssignment(unit)?.site === building || (unit.dest === building && unit.action === 'build')
  )
  if (paused) building.constructionPaused = true
  else delete building.constructionPaused
  if (paused)
    for (const unit of workers) {
      assignConstructionWork(unit)
      unit.autonomousJob = null
      unit.collectiveTask = null
      unit.resourceDeliveryState = null
      unit.stop?.()
    }
  notifyVillageStateChanged(building.owner)
  building.updateTexture?.()
  building.context?.menu?.syncEntityInfoModal?.()
  building.context?.menu?.syncHeroBuildingMenu?.()
  return true
}
