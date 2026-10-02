import { hasConstructionWork } from '../../../lib/economy/constructionMaterials'
import { reserveUsesFoodJob } from '../../../lib/economy/depotReserves'
import {
  activeConstructionSite,
  belongsToSettlement,
  collectiveAnchor,
  planCollectiveTasks,
} from '../../../lib/economy/collectiveTasks'
import { planDepotPickup } from '../../../lib/economy/depotPickup'
import { offlineResourceWork, type OfflineWorkRules } from '../work/OfflineWorkResources'
import type { OfflineWorldSpatial } from './OfflineWorldSpatial'
import type { ResourceAmount } from '../../../types/common'
import { isOfflineWorker, stopOfflineTask } from './OfflineWorldWork'
import type { SaveEntityState, SavePlayerState } from '../../../types/save'
import type { VillagerAutonomyJob } from '../../../types/entities'

type WorkAvailability = {
  resources: SaveEntityState[]
  spatial: OfflineWorldSpatial
  rules: OfflineWorkRules
  playerIndex: number
}

export function planOfflineCollectiveWork(
  player: SavePlayerState,
  autonomousResidents = false,
  availability?: WorkAvailability
): void {
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
          player.buildings?.some(site => hasConstructionWork(site) && !site.constructionMaterials)
        )) ||
        unit.collectiveTask ||
        player.type === 'AI' ||
        (unit.autonomousJob === 'construction' &&
          player.buildings?.some(site => hasConstructionWork(site) && site.constructionMaterials)) ||
        (!unit.autonomousJob && !unit.action && !unit.work))
  )
  const plan = planCollectiveTasks(player, workers, members, (unit, job) => {
    if (!availability || job === 'construction') return true
    const { resources, spatial, rules, playerIndex } = availability
    const anchor = collectiveAnchor(player, unit)
    if (
      (job === 'food' || activeConstructionSite(player, unit)) &&
      planDepotPickup(
        player,
        unit,
        { [job]: 1 } as ResourceAmount,
        depot => belongsToSettlement(player, anchor, depot) && spatial.reachable(unit, depot)
      )
    )
      return true
    const candidate = {
      ...unit,
      collectiveTask: job,
      autonomousJob: reserveUsesFoodJob(job) ? ('food' as const) : (job as VillagerAutonomyJob),
    }
    return resources.some(
      resource =>
        offlineResourceWork(player, candidate, resource, rules.wheatMatureFrame) &&
        (rules.isKnown?.(playerIndex, resource) ?? true) &&
        spatial.reachable(unit, resource)
    )
  })
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
