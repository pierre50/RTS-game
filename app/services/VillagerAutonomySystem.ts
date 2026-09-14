import { logStationaryVillager } from '../lib/units/autonomy/villagerJobDiagnostics'
import { ACTION_TYPES, SHEET_TYPES, UNIT_TYPES } from '../constants'
import { cancelVillagerExplorationResume } from '../lib/units/autonomy/villagerExploration'
import { villagerAutonomySuspension } from '../lib/units/autonomy/villagerAutonomyAvailability'
import { hasVillagerAutonomyTarget } from '../lib/units/villagerAutonomy'
import { markVillagerAutonomyTargetRejected } from '../lib/units/villagerAutonomyTargeting'
import { resumeVillagerJobIntent } from '../lib/units/villagerTaskRecovery'
import type { GameContextLike } from '../types/context'
import type { RuntimeEntity, UnitEntity, VillagerAutonomyJob } from '../types/entities'

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

function workTarget(unit: UnitEntity): RuntimeEntity | null {
  const target = unit.blockedGatherApproach?.target ?? unit.dest
  return target && !('has' in target) ? target : null
}

function progressSnapshot(unit: UnitEntity): unknown[] {
  const target = workTarget(unit)
  const moving = Boolean(unit.path?.length)
  return [
    unit.x,
    unit.y,
    unit.i,
    unit.j,
    unit.spaceId,
    unit.dest,
    unit.action,
    moving ? null : unit.gatherProgressState?.progress,
    moving ? null : target?.quantity,
    moving ? null : target?.hitPoints,
    target?.isDestroyed,
    target?.isDead,
    ...Object.entries(unit.inventory?.resources ?? {})
      .sort(([a], [b]) => a.localeCompare(b))
      .flat(),
  ]
}

function hasInvalidTarget(unit: UnitEntity): boolean {
  const target = workTarget(unit)
  if (!target) return false
  const action = unit.blockedGatherApproach?.action ?? unit.action
  if (target.isDestroyed || (target.isDead && action !== ACTION_TYPES.takemeat)) return true
  if (target.quantity != null && target.quantity <= 0 && action !== ACTION_TYPES.build) return true
  return Boolean(action && unit.getActionCondition?.(target, action) === false)
}

export class VillagerAutonomySystem {
  private walkingObservations = new WeakMap<UnitEntity, { x: number; y: number; space: UnitEntity['spaceId']; since: number; logged: boolean }>()
  private observations = new WeakMap<UnitEntity, Observation>()
  private taskId: number | null = null
  private cursor = 0
  private lastScanMs = -1

  constructor(private readonly context: GameContextLike) {
    if (context.editor || !context.scheduler) return
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
    const units = (this.context.players ?? []).flatMap(player => player.units ?? [])
    let recoveries = 0
    for (let count = 0; count < Math.min(SCAN_BATCH_SIZE, units.length); count++) {
      const unit = units[this.cursor++ % units.length]
      if (unit && this.check(unit, now, recoveries < MAX_RECOVERIES_PER_SCAN)) recoveries++
    }
    this.cursor %= Math.max(1, units.length)
  }

  private observeWalking(unit: UnitEntity, now: number): void {
    if (unit.type !== UNIT_TYPES.villager || unit.isDead || unit.isDestroyed || unit.currentSheet !== SHEET_TYPES.walking) {
      this.walkingObservations.delete(unit)
      return
    }
    let state = this.walkingObservations.get(unit)
    if (!state || state.x !== unit.x || state.y !== unit.y || state.space !== unit.spaceId) {
      state = { x: unit.x, y: unit.y, space: unit.spaceId, since: now, logged: false }
      this.walkingObservations.set(unit, state)
    }
    if (!state.logged && now - state.since >= 5000) {
      state.logged = true
      logStationaryVillager(unit)
    }
  }

  private check(unit: UnitEntity, now: number, canRecover: boolean): boolean {
    this.observeWalking(unit, now)
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
    const invalid = hasInvalidTarget(unit)
    const missingTarget = Boolean(action && !unit.dest && !unit.blockedGatherApproach && !unit.path?.length)
    const stalled = now - state.lastProgressMs >= (unit.path?.length ? STALLED_MOVE_MS : STALLED_WORK_MS)
    if (hasTask && !invalid && !missingTarget && !stalled) {
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
    if (this.taskId != null) this.context.scheduler.remove(this.taskId)
    this.taskId = null
    this.observations = new WeakMap()
    this.walkingObservations = new WeakMap()
  }
}
