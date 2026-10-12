import { SHEET_TYPES } from '../constants'
import { villagerAutonomySuspension } from '../lib/units/autonomy/villagerAutonomyAvailability'
import type { GameContextLike, SchedulerTaskId } from '../types/context'
import type { UnitEntity } from '../types/entities'

type Plan = Generator<void, boolean, void>
type Completion = (accepted: boolean, cancelled?: boolean) => void
type Job = { unit: UnitEntity; valid: () => boolean; plan: Plan; complete?: Completion }
const queues = new WeakMap<GameContextLike, AutonomyPlanningQueue>()
const FRAME_BUDGET_MS = 2
const MAX_STEPS_PER_FRAME = 64

export function hasPendingAutonomyPlan(unit: UnitEntity): boolean {
  return Boolean(unit.context && queues.get(unit.context)?.has(unit))
}

export function runAutonomyPlan(
  unit: UnitEntity,
  create: (incremental: boolean) => Plan,
  complete?: Completion
): boolean {
  const queue = unit.context && queues.get(unit.context)
  if (queue) return queue.request(unit, create, complete)
  const plan = create(false)
  unit.assigningAutonomousJob = true
  try {
    let step = plan.next()
    while (!step.done) step = plan.next()
    complete?.(step.value)
    return step.value
  } finally {
    unit.assigningAutonomousJob = false
  }
}

/** One shared frame budget, with at most four live A* frontiers per game. */
export class AutonomyPlanningQueue {
  private jobs = new Map<UnitEntity, Job>()
  private running = new Set<UnitEntity>()
  private taskId: SchedulerTaskId | null = null
  private frame = -1
  private spent = 0
  private steps = 0

  constructor(private context: GameContextLike) {
    queues.set(context, this)
  }

  has(unit: UnitEntity): boolean {
    return Boolean(this.jobs.get(unit)?.valid())
  }

  request(unit: UnitEntity, create: (incremental: boolean) => Plan, complete?: Completion): boolean {
    if (this.has(unit)) return true
    const previous = this.jobs.get(unit)
    this.jobs.delete(unit)
    this.running.delete(unit)
    previous?.complete?.(false, true)
    if (villagerAutonomySuspension(unit)) {
      complete?.(false, true)
      return false
    }
    // The old work must not move the origin while its replacement is being planned.
    unit.stopInterval?.()
    unit.path = []
    unit.dest = null
    unit.realDest = null
    unit.action = null
    unit.blockedGatherApproach = null
    unit.exploringForAutonomy = false
    unit.inactif = true
    unit.setTextures?.(SHEET_TYPES.standing)
    const { i, j, spaceId, owner, dest, action, autonomousJob, collectiveTask, path } = unit
    const map = this.context.map
    const grid = map?.grid
    const valid = () =>
      unit.context === this.context &&
      this.context.map === map &&
      map?.grid === grid &&
      unit.i === i &&
      unit.j === j &&
      unit.spaceId === spaceId &&
      unit.owner === owner &&
      unit.path === path &&
      unit.dest === dest &&
      unit.action === action &&
      unit.autonomousJob === autonomousJob &&
      unit.collectiveTask === collectiveTask &&
      !villagerAutonomySuspension(unit)
    this.jobs.set(unit, { unit, valid, plan: create(true), complete })
    if (this.taskId == null) {
      this.taskId = this.context.scheduler.add(() => this.flush(), 1, 'unit.autonomy.planning', { maxRunsPerTick: 1 })
    }
    return true
  }

  flush(): void {
    const frame = this.context.scheduler.elapsedMs
    if (frame !== this.frame) {
      this.frame = frame
      this.spent = 0
      this.steps = 0
    }
    const started = performance.now()
    try {
      while (
        this.jobs.size &&
        this.steps < MAX_STEPS_PER_FRAME &&
        this.spent + performance.now() - started < FRAME_BUDGET_MS
      ) {
        let job: Job | undefined
        for (const pending of this.jobs.values()) {
          if (this.running.has(pending.unit) || this.running.size < 4) {
            job = pending
            break
          }
        }
        if (!job) break
        if (!job.valid()) {
          this.remove(job)
          job.complete?.(false, true)
          continue
        }
        this.running.add(job.unit)
        this.steps++
        let step: IteratorResult<void, boolean>
        job.unit.assigningAutonomousJob = true
        try {
          step = job.plan.next()
        } catch (error) {
          this.remove(job)
          job.complete?.(false, true)
          throw error
        } finally {
          job.unit.assigningAutonomousJob = false
        }
        if (step.done) {
          this.remove(job)
          job.complete?.(step.value)
        } else {
          this.jobs.delete(job.unit)
          this.jobs.set(job.unit, job)
        }
      }
    } finally {
      this.spent += performance.now() - started
      if (!this.jobs.size && this.taskId != null) {
        this.context.scheduler.remove(this.taskId)
        this.taskId = null
      }
    }
  }

  private remove(job: Job): void {
    this.jobs.delete(job.unit)
    this.running.delete(job.unit)
  }

  destroy(): void {
    if (this.taskId != null) this.context.scheduler.remove(this.taskId)
    this.taskId = null
    const jobs = [...this.jobs.values()]
    this.jobs.clear()
    this.running.clear()
    queues.delete(this.context)
    for (const job of jobs) job.complete?.(false, true)
  }
}
