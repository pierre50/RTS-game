import { constructionToolPreparation } from '../lib/units/supplies/toolPreparation'
import { seekGroundToolMaterials } from '../lib/units/village/villageGroundRecovery'
import { getEquippedWorkTool } from '../lib/equipment/workTools'
import { hasPendingAutonomyPlan } from './AutonomyPlanningQueue'
import { planBlockedVillagerRecovery } from '../lib/economy/blockedVillagerInventory'
import { hasConstructionWork } from '../lib/economy/constructionMaterials'
import { isRpgVillage } from '../config/rpgVillages'
import { consumeVillageWorkChange, notifyVillageWorkChanged } from '../lib/units/village/villageWorkEvents'
import { hasCollectiveVillageEvent, settleCollectiveVillageEvents } from './CollectiveVillageEvents'
import {
  clearVillagerGathering,
  gatherIdleVillager,
  isVillagerGathering,
} from '../lib/units/autonomy/villagerGathering'
import { reserveUsesFoodJob } from '../lib/economy/depotReserves'
import { activeConstructionSite, planCollectiveTasks } from '../lib/economy/collectiveTasks'
import { assignVillagerAutonomy } from '../lib/units/autonomy/villagerAutonomy'
import { villagerAutonomySuspension } from '../lib/units/autonomy/villagerAutonomyAvailability'
import { UNIT_TYPES, ACTION_TYPES } from '../constants'
import type { PlayerLike } from '../types/player'
import type { BuildingEntity, UnitEntity, VillagerAutonomyJob } from '../types/entities'

const rejectedJobs = new WeakMap<
  UnitEntity,
  { owner: PlayerLike; space: unknown; expiresAt: number; retryAfter: number; jobs: Set<string> }
>()
const retryAt = new WeakMap<PlayerLike, number>()
function scheduleRetry(owner: PlayerLike, now: number, delay = 1000): void {
  retryAt.set(owner, Math.min(retryAt.get(owner) ?? Infinity, now + delay))
  notifyVillageWorkChanged(owner)
}
function workTime(owner: PlayerLike): number {
  return owner.units?.[0]?.context?.scheduler?.elapsedMs ?? performance.now()
}
function exclusions(unit: UnitEntity, owner: PlayerLike, now: number): Set<string> | undefined {
  const state = rejectedJobs.get(unit)
  if (state && state.owner === owner && state.space === unit.spaceId && state.expiresAt > now) return state.jobs
  rejectedJobs.delete(unit)
  return undefined
}

/** @public Loaded by tests/collective-village-work.test.cjs (loadTsModule). */
export function updateCollectiveVillage(owner: PlayerLike, now = workTime(owner)): number {
  if (isRpgVillage(owner)) return 0
  const retry = retryAt.get(owner)
  if (!hasCollectiveVillageEvent(owner) && (retry == null || now < retry)) return 0
  retryAt.delete(owner)
  const actions = dispatchCollectiveVillage(owner, now)
  // Our own assignments are effects of this event, not reasons to plan again next tick.
  settleCollectiveVillageEvents(owner)
  return actions
}

function dispatchCollectiveVillage(owner: PlayerLike, now: number): number {
  const members = villageMembers(owner)
  const interruptibleDeposit = (unit: (typeof members)[number]) =>
    Boolean(
      unit.resourceDeliveryState?.phase === 'toBuilding' &&
        !unit.resourceDeliveryState.pickup &&
        activeConstructionSite(owner, unit)
    )
  const workers = members.filter(unit => {
    if (hasPendingAutonomyPlan(unit)) return false
    if (unit.isChief || villagerAutonomySuspension(unit, interruptibleDeposit(unit))) return false
    if ([ACTION_TYPES.attack, ACTION_TYPES.flee, ACTION_TYPES.train].includes(unit.action ?? '')) return false
    return Boolean(
      interruptibleDeposit(unit) ||
        isVillagerGathering(unit) ||
        unit.collectiveTask ||
        (!getEquippedWorkTool(unit) && unit.autonomousJob) ||
        (unit.inactif && !unit.autonomousJob) ||
        (unit.autonomousJob === 'construction' &&
          owner.buildings.some(site => hasConstructionWork(site) && site.constructionMaterials)) ||
        owner.type === 'AI'
    )
  })
  const plan = planCollectiveTasks(owner, workers, members, (unit, job) => !exclusions(unit, owner, now)?.has(job))
  let actions = 0
  for (const unit of workers) {
    if (constructionToolPreparation(unit, owner)) {
      if (unit.collectiveTask) {
        unit.collectiveTask = null
        unit.autonomousJob = null
        unit.stop?.()
      }
      seekGroundToolMaterials(unit)
      scheduleRetry(owner, now, 10000)
      continue
    }
    const excluded = exclusions(unit, owner, now)
    let task = plan.get(unit)
    const recovery = !task ? planBlockedVillagerRecovery(unit, members, (_unit, job) => !excluded?.has(job)) : undefined
    if (recovery) task = recovery.task
    if (!task) {
      if (excluded && getEquippedWorkTool(unit)) {
        scheduleRetry(owner, now, Math.max(1000, (rejectedJobs.get(unit)?.expiresAt ?? now) - now))
        continue
      }
      if (interruptibleDeposit(unit)) continue
      if (unit.collectiveTask || (!getEquippedWorkTool(unit) && unit.autonomousJob)) {
        unit.autonomousJob = null
        unit.collectiveTask = null
        unit.stop?.()
        unit.work = null
      }
      if (unit.sendToDelivery?.() === true) {
        actions++
        continue
      }
      gatherIdleVillager(unit)
      continue
    }
    const retryAfter = rejectedJobs.get(unit)?.retryAfter ?? 0
    if (task.job !== 'construction' && now < retryAfter) {
      scheduleRetry(owner, now, retryAfter - now)
      continue
    }
    recovery?.apply()
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
      const sent: unknown = unit.sendToEvt?.(task.pickup.building as BuildingEntity, ACTION_TYPES.delivery, {
        forceRepath: true,
        preserveAutonomy: true,
      })
      if (recovery && (sent === false || !unit.dest)) {
        recovery.rollback()
        unit.resourceDeliveryState = null
        unit.collectiveTask = null
        unit.stop?.()
        continue
      }
      actions++
      continue
    }
    if (unit.collectiveTask === task.job && !unit.inactif && (task.job !== 'construction' || unit.dest === task.site))
      continue
    unit.autonomousJob = null
    unit.stop?.()
    let sent: unknown
    let settled = false
    const taskJob = task.job
    const settle = (accepted: boolean, cancelled = false) => {
      if (settled) return
      settled = true
      if (!accepted) recovery?.rollback()
      if (cancelled || unit.owner !== owner || unit.collectiveTask !== taskJob) return
      if (accepted) {
        rejectedJobs.delete(unit)
      } else if (taskJob !== 'construction') {
        const settledAt = Math.max(now, workTime(owner))
        const failures = exclusions(unit, owner, settledAt) ?? new Set<string>()
        failures.add(taskJob)
        rejectedJobs.set(unit, {
          owner,
          space: unit.spaceId,
          expiresAt: settledAt + 30000,
          retryAfter: settledAt + 1000,
          jobs: failures,
        })
        scheduleRetry(owner, settledAt)
      }
    }
    if (task.job === 'construction') {
      unit.autonomyBlockedJob = null
      const home = unit.collectiveHome
      sent = unit.sendToBuilding?.(task.site as BuildingEntity)
      unit.collectiveHome = home
    } else {
      unit.collectiveTask = task.job
      sent = assignVillagerAutonomy(unit, reserveUsesFoodJob(task.job) ? 'food' : (task.job as VillagerAutonomyJob), {
        preserveRejectedTargets: true,
        onSettled: settle,
        ...(recovery ? { exploreWhenNoTarget: false } : {}),
      })
    }
    // Deferred searches settle through their callback; a pending plan is not a failed job.
    if (!hasPendingAutonomyPlan(unit)) settle(sent !== false)
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
  if (isRpgVillage(owner)) return 0
  const previous = dispatchState.get(owner)
  const notified = consumeVillageWorkChange(owner)
  const retry = retryAt.get(owner)
  if (previous && !notified && (retry == null || now < retry) && now - previous.checkedAt < 30000) return 0
  const actions = updateCollectiveVillage(owner, now)
  dispatchState.set(owner, { checkedAt: now })
  return actions
}

function villageMembers(owner: PlayerLike): UnitEntity[] {
  return (owner.units ?? []).filter(
    unit =>
      unit.type === UNIT_TYPES.villager &&
      !unit.isDead &&
      !unit.isDestroyed &&
      !unit.followingHero &&
      unit.controlMode !== 'hero'
  )
}
