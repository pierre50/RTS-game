import type { SchedulerTaskId, GameContextLike } from '../types/context'
import type { UnitEntity } from '../types/entities'

type UnitWalkAroundPatrolTaskSetter = (unit: UnitEntity, taskId: SchedulerTaskId | null) => void

export type UnitWalkAroundPatrolControllerOptions = {
  clearTaskId: (unit: UnitEntity) => void
  context: GameContextLike
  getCleanupUnits?: () => Iterable<UnitEntity>
  getTaskId: (unit: UnitEntity) => SchedulerTaskId | null | undefined
  getUnits: () => Iterable<UnitEntity>
  isEligible: (unit: UnitEntity) => boolean
  scanIntervalMs: number
  scanTaskName: string
  scheduleUnit: (unit: UnitEntity, onTaskId: UnitWalkAroundPatrolTaskSetter) => void
  setTaskId: UnitWalkAroundPatrolTaskSetter
}

export class UnitWalkAroundPatrolController {
  private readonly options: UnitWalkAroundPatrolControllerOptions
  private scanTaskId: SchedulerTaskId | null = null
  private taskIds: Set<SchedulerTaskId> = new Set()

  constructor(options: UnitWalkAroundPatrolControllerOptions) {
    this.options = options
  }

  start(): void {
    const scheduler = this.options.context.scheduler
    if (!scheduler || this.options.context.editor) return
    this.scanTaskId ??= scheduler.add(() => this.update(), this.options.scanIntervalMs, this.options.scanTaskName)
    this.update()
  }

  update(): void {
    for (const unit of this.options.getUnits()) {
      if (!this.options.isEligible(unit)) continue
      if (this.options.getTaskId(unit) != null) continue
      this.options.scheduleUnit(unit, (target, taskId) => this.setUnitTaskId(target, taskId))
    }
  }

  destroy(): void {
    const scheduler = this.options.context.scheduler
    if (scheduler) {
      if (this.scanTaskId != null) scheduler.remove(this.scanTaskId)
      for (const taskId of this.taskIds) scheduler.remove(taskId)
    }
    this.scanTaskId = null
    this.taskIds.clear()
    for (const unit of this.options.getCleanupUnits?.() ?? this.options.getUnits()) {
      this.options.clearTaskId(unit)
    }
  }

  private setUnitTaskId(unit: UnitEntity, taskId: SchedulerTaskId | null): void {
    const previousTaskId = this.options.getTaskId(unit)
    if (previousTaskId != null) this.taskIds.delete(previousTaskId)
    this.options.setTaskId(unit, taskId)
    if (taskId != null) this.taskIds.add(taskId)
  }
}
