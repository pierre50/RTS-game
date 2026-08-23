import type { SchedulerTaskId, GameContextLike } from '../types/context'
import type { RuntimeCell } from '../types/map'

export type AmbientMovementControllerOptions<THost extends { context: GameContextLike }> = {
  delayMaxMs: (host: THost) => number
  delayMinMs: (host: THost) => number
  move: (host: THost, destination: RuntimeCell) => void
  pickDestination: (host: THost) => RuntimeCell | null
  taskName: string
}

export class AmbientMovementController<THost extends { context: GameContextLike }> {
  host: THost
  nextMoveAt: number
  taskId: SchedulerTaskId | null
  options: AmbientMovementControllerOptions<THost>

  constructor(host: THost, options: AmbientMovementControllerOptions<THost>) {
    this.host = host
    this.nextMoveAt = 0
    this.taskId = null
    this.options = options
  }

  get ready(): boolean {
    return this.host.context.scheduler.elapsedMs >= this.nextMoveAt
  }

  schedule(): void {
    const { map, scheduler } = this.host.context
    const minDelay = this.options.delayMinMs(this.host)
    const maxDelay = Math.max(minDelay, this.options.delayMaxMs(this.host))
    this.nextMoveAt = scheduler.elapsedMs + map.randomRange(minDelay, maxDelay)
  }

  start(intervalMs: number, update: () => void): void {
    if (this.taskId != null) return
    this.schedule()
    this.taskId = this.host.context.scheduler.add(update, intervalMs, this.options.taskName)
  }

  stop(): void {
    if (this.taskId == null) return
    this.host.context.scheduler.remove(this.taskId)
    this.taskId = null
  }

  tryMove(): boolean {
    const destination = this.options.pickDestination(this.host)
    if (!destination) return false
    this.options.move(this.host, destination)
    this.schedule()
    return true
  }
}

export type ScheduledAmbientMoveOptions<THost> = {
  canMove?: (host: THost) => boolean
  delayMaxMs: (host: THost) => number
  delayMinMs: (host: THost) => number
  move: (host: THost, destination: RuntimeCell) => void
  pickDestination: (host: THost) => RuntimeCell | null
  scheduler: GameContextLike['scheduler']
  randomRange: (min: number, max: number) => number
  shouldContinue: (host: THost) => boolean
  taskName: string
  onTaskId?: (host: THost, taskId: SchedulerTaskId | null) => void
}

export function scheduleAmbientMove<THost>(
  host: THost,
  options: ScheduledAmbientMoveOptions<THost>
): SchedulerTaskId | null {
  if (!options.shouldContinue(host)) {
    options.onTaskId?.(host, null)
    return null
  }
  const minDelay = options.delayMinMs(host)
  const maxDelay = Math.max(minDelay, options.delayMaxMs(host))
  const taskId = options.scheduler.addOneShot(() => {
    options.onTaskId?.(host, null)
    if (!options.shouldContinue(host)) return
    if (!options.canMove || options.canMove(host)) {
      const destination = options.pickDestination(host)
      if (destination) options.move(host, destination)
    }
    scheduleAmbientMove(host, options)
  }, options.randomRange(minDelay, maxDelay), options.taskName)
  options.onTaskId?.(host, taskId)
  return taskId
}
