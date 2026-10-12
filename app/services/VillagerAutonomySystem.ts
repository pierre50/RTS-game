import { isRpgVillage, isRpgVillager } from '../config/rpgVillages'
import { ACTION_TYPES, SHEET_TYPES, UNIT_TYPES } from '../constants'
import { flushTrainingRequests } from '../lib/training/trainingRequests'
import { hasVillagerAutonomyTarget } from '../lib/units/autonomy/villagerAutonomy'
import { villagerAutonomySuspension } from '../lib/units/autonomy/villagerAutonomyAvailability'
import { markVillagerAutonomyTargetRejected } from '../lib/units/autonomy/villagerAutonomyTargeting'
import { cancelVillagerExplorationResume } from '../lib/units/autonomy/villagerExploration'
import { hasInvalidTarget, observeWalking, progressSnapshot, workTarget } from '../lib/units/autonomy/villagerProgress'
import { resumeVillagerJobIntent } from '../lib/units/autonomy/villagerTaskRecovery'
import { isUnitSuspended } from '../lib/units/unitSuspension'
import { isVillageResourceWorker } from '../lib/units/village/villageSupplyTrips'
import type { GameContextLike } from '../types/context'
import type { UnitEntity, VillagerAutonomyJob } from '../types/entities'
import { AutonomyPlanningQueue, hasPendingAutonomyPlan } from './AutonomyPlanningQueue'
import { flushCollectiveVillageWork } from './CollectiveVillageWork'

const SCAN_INTERVAL_MS = 1000
const SCAN_BATCH_SIZE = 32
const MAX_RECOVERIES_PER_SCAN = 4
const STALLED_MOVE_MS = 15000
const STALLED_WORK_MS = 60000
const MAX_RETRY_MS = 30000
const JOB_ACTIONS: Record<VillagerAutonomyJob, string[]> = {
  food: [ACTION_TYPES.forageberry, ACTION_TYPES.farm, ACTION_TYPES.takemeat, ACTION_TYPES.hunt],
  wood: [ACTION_TYPES.chopwood],
  stone: [ACTION_TYPES.minestone],
  gold: [ACTION_TYPES.minegold],
  copper: [ACTION_TYPES.minecopper],
  tin: [ACTION_TYPES.minetin],
  iron: [ACTION_TYPES.mineiron],
  construction: [ACTION_TYPES.build],
  horseCapture: [ACTION_TYPES.captureHorse],
}

type Observation = {
  job: VillagerAutonomyJob
  space: UnitEntity['spaceId']
  progress: unknown[]
  lastProgressMs: number
  nextRetryMs: number
  attempts: number
  reason: string
}

export class VillagerAutonomySystem {
  private walkingObservations = new WeakMap<
    UnitEntity,
    { x: number; y: number; space: UnitEntity['spaceId']; since: number; logged: boolean }
  >()
  private observations = new WeakMap<UnitEntity, Observation>()
  private taskId: number | null = null
  private planning: AutonomyPlanningQueue | null = null
  private cursor = 0
  private lastScanMs = -1

  constructor(private readonly context: GameContextLike) {
    if (context.editor || !context.scheduler) return
    this.planning = new AutonomyPlanningQueue(context)
    // The first scheduler tick runs after restore, travel-party placement and rest synchronization.
    this.taskId = context.scheduler.add(() => this.update(), SCAN_INTERVAL_MS, 'unit.autonomy.reconcile')
  }

  getStatus(unit: UnitEntity): { reason: string; attempts: number; nextRetryMs: number } | null {
    const state = this.observations.get(unit)
    return state ? { reason: state.reason, attempts: state.attempts, nextRetryMs: state.nextRetryMs } : null
  }

  update(): void {
    if (this.taskId == null) return
    const now = this.context.scheduler.elapsedMs
    if (now === this.lastScanMs) return
    this.lastScanMs = now
    for (const player of this.context.players ?? []) {
      if (!isRpgVillage(player) && (player.isPlayed || player.type === 'AI')) {
        flushTrainingRequests(player, this.context)
        flushCollectiveVillageWork(player, now)
      }
    }
    const units = (this.context.players ?? []).flatMap(player => player.units ?? [])
    let recoveries = 0
    for (let count = 0; count < Math.min(SCAN_BATCH_SIZE, units.length); count++) {
      const unit = units[this.cursor++ % units.length]
      if (unit && this.check(unit, now, recoveries < MAX_RECOVERIES_PER_SCAN)) recoveries++
    }
    this.cursor %= Math.max(1, units.length)
  }

  private check(unit: UnitEntity, now: number, canRecover: boolean): boolean {
    if (isRpgVillager(unit) || isUnitSuspended(unit)) return false
    if (hasPendingAutonomyPlan(unit)) return false
    observeWalking(unit, now, this.walkingObservations)
    const job = unit.autonomousJob
    if (
      unit.type !== UNIT_TYPES.villager ||
      !job ||
      !Object.hasOwn(JOB_ACTIONS, job) ||
      unit.isDead ||
      unit.isDestroyed
    ) {
      this.observations.delete(unit)
      return false
    }
    const progress = progressSnapshot(unit)
    let state = this.observations.get(unit)
    if (!state || state.job !== job || state.space !== unit.spaceId) {
      state = { job, space: unit.spaceId, progress, lastProgressMs: now, nextRetryMs: 0, attempts: 0, reason: 'idle' }
      this.observations.set(unit, state)
    }
    const suspension = villagerAutonomySuspension(unit)
    const action = unit.blockedGatherApproach?.action ?? unit.action
    const ownsTask = action ? JOB_ACTIONS[job].includes(action) : unit.exploringForAutonomy
    const hasTask = Boolean(unit.dest || unit.action || unit.path?.length || unit.blockedGatherApproach)
    if (suspension || (hasTask && !ownsTask)) {
      state.reason = suspension ?? 'other-order'
      state.lastProgressMs = now
      state.nextRetryMs = 0
      state.attempts = 0
      state.progress = progress
      return false
    }
    if (progress.length !== state.progress.length || progress.some((value, index) => value !== state.progress[index])) {
      state.lastProgressMs = now
      state.nextRetryMs = 0
      state.attempts = 0
      state.progress = progress
    }
    const obsoleteExploration = Boolean(
      (unit.owner?.isPlayed || isVillageResourceWorker(unit)) && unit.exploringForAutonomy
    )
    const invalid = hasInvalidTarget(unit)
    const missingTarget = Boolean(action && !unit.dest && !unit.blockedGatherApproach && !unit.path?.length)
    const stalled = now - state.lastProgressMs >= (unit.path?.length ? STALLED_MOVE_MS : STALLED_WORK_MS)
    if (hasTask && !obsoleteExploration && !invalid && !missingTarget && !stalled) {
      state.reason = unit.exploringForAutonomy ? 'exploring' : 'working'
      return false
    }
    if (now < state.nextRetryMs) return false
    state.reason = invalid || missingTarget ? 'invalid-target' : hasTask ? 'no-progress' : 'idle'
    if (!canRecover) return false

    const target = workTarget(unit)
    const huntedCarcass =
      action === ACTION_TYPES.hunt && target?.isDead && !target.isDestroyed && (target.quantity ?? 0) > 0
    if (target && (invalid || stalled) && !huntedCarcass) markVillagerAutonomyTargetRejected(unit, target)
    cancelVillagerExplorationResume(unit)
    unit.stopInterval?.()
    unit.blockedGatherApproach = null
    unit.exploringForAutonomy = false
    unit.action = null
    unit.realDest = null
    if (obsoleteExploration) {
      unit.dest = null
      unit.path = []
    }
    const resumed = resumeVillagerJobIntent(unit)
    state.attempts++
    state.nextRetryMs = now + Math.min(MAX_RETRY_MS, 2000 * 2 ** Math.min(state.attempts - 1, 4))
    state.lastProgressMs = now
    state.progress = progressSnapshot(unit)
    state.reason = resumed ? 'resumed' : hasVillagerAutonomyTarget(unit, job) ? 'no-accepted-route' : 'no-known-target'
    // This service owns retries after recovery; do not leave a second exploration timer racing it.
    if (!resumed) {
      cancelVillagerExplorationResume(unit)
      if (!unit.dest && !unit.action && !unit.path?.length) unit.setTextures?.(SHEET_TYPES.standing)
    }
    return true
  }

  destroy(): void {
    this.planning?.destroy()
    this.planning = null
    if (this.taskId != null) this.context.scheduler.remove(this.taskId)
    this.taskId = null
    this.observations = new WeakMap()
    this.walkingObservations = new WeakMap()
  }
}
