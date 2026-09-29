import { reserveUsesFoodJob } from '../../lib/economy/depotReserves'
import { planCollectiveTasks } from '../../lib/economy/collectiveTasks'
import { isOfflineWorker, stopOfflineTask } from './OfflineWorldWork'
import type { SavePlayerState } from '../../types/save'
import type { VillagerAutonomyJob } from '../../types/entities'

export function planOfflineCollectiveWork(player: SavePlayerState, autonomousResidents = false): void {
  const members = (player.units ?? []).filter(
    unit =>
      unit.type === 'Villager' &&
      !unit.isDead &&
      !unit.isDestroyed &&
      !unit.followingHero &&
      unit.controlMode !== 'hero'
  )
  const workers = members.filter(
    unit =>
      isOfflineWorker(unit) &&
      !unit.resourceDelivery?.pickup &&
      !unit.isChief &&
      ((autonomousResidents &&
        !(
          unit.autonomousJob === 'construction' &&
          !unit.collectiveTask &&
          player.buildings?.some(site => !site.isBuilt && !site.constructionMaterials)
        )) ||
        unit.collectiveTask ||
        player.type === 'AI' ||
        (unit.autonomousJob === 'construction' &&
          player.buildings?.some(site => !site.isBuilt && site.constructionMaterials)) ||
        (!unit.autonomousJob && !unit.action && !unit.work))
  )
  const plan = planCollectiveTasks(player, workers, members)
  for (const unit of workers) {
    const task = plan.get(unit)
    if (!task) {
      if (unit.collectiveTask || autonomousResidents) {
        stopOfflineTask(unit)
        unit.autonomousJob = null
        unit.work = null
        unit.collectiveTask = null
      }
      continue
    }
    if (unit.collectiveTask !== task.job) {
      stopOfflineTask(unit)
      delete unit.offlineWork
    }
    if (task.pickup) {
      unit.resourceDelivery = {
        building: [task.pickup.building.i, task.pickup.building.j, task.pickup.building.label],
        pickup: task.pickup.resources,
      }
    }
    unit.collectiveTask = task.job
    unit.autonomousJob = reserveUsesFoodJob(task.job) ? 'food' : (task.job as VillagerAutonomyJob)
    if (task.site && task.job === 'construction') {
      unit.buildQueue = task.site.label ? [task.site.label] : []
      unit.dest = [task.site.i, task.site.j, task.site.label]
      unit.work = 'builder'
    } else unit.work = null
  }
}
