import { consumeVillageWorkChange } from '../lib/units/villageWorkEvents'
import { hasCollectiveVillageEvent, settleCollectiveVillageEvents } from './CollectiveVillageEvents'
import { clearVillagerGathering, gatherIdleVillager, isVillagerGathering } from '../lib/units/villagerGathering'
import { reserveUsesFoodJob } from '../lib/economy/depotReserves'
import { activeConstructionSite, planCollectiveTasks } from '../lib/economy/collectiveTasks'
import { assignVillagerAutonomy } from '../lib/units/villagerAutonomy'
import { villagerAutonomySuspension } from '../lib/units/autonomy/villagerAutonomyAvailability'
import { UNIT_TYPES, ACTION_TYPES } from '../constants'
import type { PlayerLike } from '../types/player'
import type { BuildingEntity, VillagerAutonomyJob } from '../types/entities'

export function updateCollectiveVillage(owner: PlayerLike): number {
  if (!hasCollectiveVillageEvent(owner)) return 0
  const actions = dispatchCollectiveVillage(owner)
  // Our own assignments are effects of this event, not reasons to plan again next tick.
  settleCollectiveVillageEvents(owner)
  return actions
}

function dispatchCollectiveVillage(owner: PlayerLike): number {
  const members = (owner.units ?? []).filter(
    unit =>
      unit.type === UNIT_TYPES.villager &&
      !unit.isDead &&
      !unit.isDestroyed &&
      !unit.followingHero &&
      unit.controlMode !== 'hero'
  )
  const interruptibleDeposit = (unit: (typeof members)[number]) =>
    Boolean(
      unit.resourceDeliveryState?.phase === 'toBuilding' &&
        !unit.resourceDeliveryState.pickup &&
        activeConstructionSite(owner, unit)
    )
  const workers = members.filter(unit => {
    if (unit.isChief || villagerAutonomySuspension(unit, interruptibleDeposit(unit))) return false
    if ([ACTION_TYPES.attack, ACTION_TYPES.flee, ACTION_TYPES.train].includes(unit.action ?? '')) return false
    return Boolean(
      interruptibleDeposit(unit) ||
        isVillagerGathering(unit) ||
        unit.collectiveTask ||
        (unit.inactif && !unit.autonomousJob) ||
        (unit.autonomousJob === 'construction' &&
          owner.buildings.some(site => !site.isBuilt && site.constructionMaterials)) ||
        owner.type === 'AI'
    )
  })
  const plan = planCollectiveTasks(owner, workers, members)
  let actions = 0
  const rejected = new Map<(typeof workers)[number], Set<string>>()
  const queue = [...workers]
  for (const unit of queue) {
    const excluded = rejected.get(unit)
    const task = excluded
      ? planCollectiveTasks(owner, [unit], members, (_unit, job) => !excluded.has(job)).get(unit)
      : plan.get(unit)
    if (!task) {
      if (excluded) continue
      if (interruptibleDeposit(unit)) continue
      if (unit.collectiveTask) {
        unit.autonomousJob = null
        unit.collectiveTask = null
        unit.stop?.()
        unit.work = null
        unit.sendToDelivery?.()
      }
      gatherIdleVillager(unit)
      continue
    }
    clearVillagerGathering(unit)
    if (interruptibleDeposit(unit)) {
      const taskId = unit.resourceDeliveryState?.taskId
      if (taskId != null) unit.context?.scheduler?.remove(taskId)
      unit.resourceDeliveryState = null
      unit.autonomousJob = null
      unit.stop?.()
    }
    if (task.pickup) {
      unit.autonomousJob = null
      unit.stop?.()
      unit.collectiveTask = task.job
      unit.resourceDeliveryState = {
        building: task.pickup.building as BuildingEntity,
        phase: 'toBuilding',
        pickup: task.pickup.resources,
        returnTask:
          task.job === 'construction' && task.site
            ? {
                dest: task.site as BuildingEntity,
                action: ACTION_TYPES.build,
                work: 'builder',
                autonomousJob: 'construction',
              }
            : null,
      }
      unit.sendToEvt?.(task.pickup.building as BuildingEntity, ACTION_TYPES.delivery, {
        forceRepath: true,
        preserveAutonomy: true,
      })
      actions++
      continue
    }
    if (unit.collectiveTask === task.job && !unit.inactif && (task.job !== 'construction' || unit.dest === task.site))
      continue
    unit.autonomousJob = null
    unit.stop?.()
    let sent: unknown
    if (task.job === 'construction') {
      unit.autonomyBlockedJob = null
      const home = unit.collectiveHome
      sent = unit.sendToBuilding?.(task.site as BuildingEntity)
      unit.collectiveHome = home
    } else {
      unit.collectiveTask = task.job
      sent = assignVillagerAutonomy(unit, reserveUsesFoodJob(task.job) ? 'food' : (task.job as VillagerAutonomyJob), {
        preserveRejectedTargets: true,
      })
    }
    if (sent === false && task.job !== 'construction') {
      const failures = excluded ?? new Set<string>()
      failures.add(task.job)
      rejected.set(unit, failures)
      if (failures.size < 16) queue.push(unit)
    }
    // Keep ownership while exploration or target discovery retries the assignment.
    unit.collectiveTask = task.job
    if (sent !== false && (unit.dest || unit.action || unit.path?.length)) {
      actions++
    }
  }
  return actions
}

const dispatchState = new WeakMap<PlayerLike, { checkedAt: number }>()
/** Flush coalesced events; a slow audit also catches legacy inventory adapters without notifications. */
export function flushCollectiveVillageWork(
  owner: PlayerLike,
  now = owner.units?.[0]?.context?.scheduler?.elapsedMs ?? performance.now()
): number {
  const previous = dispatchState.get(owner)
  const notified = consumeVillageWorkChange(owner)
  if (previous && !notified && now - previous.checkedAt < 30000) return 0
  const actions = updateCollectiveVillage(owner)
  dispatchState.set(owner, { checkedAt: now })
  return actions
}
