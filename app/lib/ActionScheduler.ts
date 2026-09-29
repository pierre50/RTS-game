export type SchedulerOptions = {
  /** A calendar deadline that must interrupt simplified sleep. */
  interruptSleep?: boolean
  /** Spread the initial deadline of tasks with the same name. */
  stagger?: boolean
  /** Opt-in for current-state checks only; excess overdue checks are discarded. */
  maxRunsPerTick?: number
}

type SchedulerTask = {
  callback: () => void
  elapsed: number
  interval: number
  name: string
  interruptSleep?: boolean
  oneShot?: boolean
  maxRunsPerTick?: number
}

type PerformanceLike = {
  markEvent?: (name: string, details: Record<string, string | number | boolean | null>) => void
  measureSampled: (name: string, callback: () => void) => void
  record: (name: string, duration: number) => void
}

type TickerLike = {
  add: (callback: (ticker: { deltaMS: number }) => void) => void
  remove: (callback: (ticker: { deltaMS: number }) => void) => void
}

export class ActionScheduler {
  _app: { ticker: TickerLike }
  _getPaused: () => boolean
  _getPerformance: () => PerformanceLike | null
  _nextId: number
  _onTick: (ticker: { deltaMS: number }) => void
  _tasks: Map<number, SchedulerTask>
  _toRemove: number[]
  elapsedMs: number
  suspended = false
  timeScale: number
  private staggerCounts = new Map<string, number>()

  constructor(
    app: { ticker: TickerLike },
    getPaused: () => boolean,
    getPerformance: () => PerformanceLike | null = () => null
  ) {
    this._app = app
    this._getPaused = getPaused
    this._getPerformance = getPerformance
    this._tasks = new Map()
    this._nextId = 1
    this._toRemove = []
    this.timeScale = 1
    this.elapsedMs = 0
    this._onTick = ticker => this._tick(ticker.deltaMS)
    app.ticker.add(this._onTick)
  }

  add(callback: () => void, intervalMs: number, name = 'scheduler.task', options: SchedulerOptions = {}): number {
    const id = this._nextId++
    const ordinal = this.staggerCounts.get(name) ?? 0
    if (options.stagger) this.staggerCounts.set(name, ordinal + 1)
    // A low-discrepancy phase avoids needing to know the final number of AIs.
    const delay = options.stagger ? ((ordinal * 0.618033988749895) % 1) * intervalMs : 0
    this._tasks.set(id, {
      callback,
      interval: intervalMs,
      elapsed: -delay,
      name,
      maxRunsPerTick: options.maxRunsPerTick,
      interruptSleep: options.interruptSleep,
    })
    return id
  }

  addOneShot(
    callback: () => void,
    delayMs: number,
    name = 'scheduler.oneShot',
    options: SchedulerOptions = {}
  ): number {
    const id = this._nextId++
    this._tasks.set(id, {
      callback,
      interval: delayMs,
      elapsed: 0,
      oneShot: true,
      name,
      interruptSleep: options.interruptSleep,
    })
    return id
  }

  remove(id: number): void {
    this._tasks.delete(id)
  }

  update(id: number, intervalMs: number): void {
    const task = this._tasks.get(id)
    if (task) task.interval = intervalMs
  }

  clear(): void {
    this._tasks.clear()
    this.staggerCounts.clear()
    this._toRemove.length = 0
  }

  destroy(): void {
    this.clear()
    this._app.ticker.remove(this._onTick)
  }

  getSleepDeadlineMs(): number {
    let remaining = Infinity
    for (const task of this._tasks.values())
      if (task.interruptSleep) remaining = Math.min(remaining, Math.max(0, task.interval - task.elapsed))
    return remaining
  }

  /** Advance the calendar without creating a backlog of movement/visual callbacks. */
  advanceSleepTime(deltaMs: number): void {
    this.elapsedMs += deltaMs
    for (const task of this._tasks.values()) if (task.interruptSleep) task.elapsed += deltaMs
  }

  _tick(deltaMS: number): void {
    if (this.suspended || this._getPaused()) return
    const monitor = this._getPerformance()
    if (monitor) monitor.measureSampled('scheduler.tick', () => this.runTick(deltaMS))
    else this.runTick(deltaMS)
  }

  private runTick(deltaMS: number): void {
    let calls = 0
    let catchUpCalls = 0
    let mostRepeated = ''
    let maxRepeats = 0
    this.elapsedMs += deltaMS
    this._toRemove.length = 0
    const lastTaskId = this._nextId - 1
    for (const [id, task] of this._tasks) {
      if (this.suspended) break
      // Map iteration includes newly added tasks. Defer them so retries cannot
      // repeatedly consume this frame's delta and starve rendering/input.
      if (id > lastTaskId) break
      task.elapsed += deltaMS
      if (task.oneShot) {
        if (task.elapsed >= task.interval) {
          task.elapsed -= task.interval
          this._runTask(task)
          calls++
          this._toRemove.push(id)
        }
        continue
      }

      let runs = 0
      while (!this.suspended && task.elapsed >= task.interval) {
        task.elapsed -= task.interval
        this._runTask(task)
        calls++
        runs++

        // The callback may remove or replace this task, so stop safely.
        if (!this._tasks.has(id) || this._tasks.get(id) !== task) {
          break
        }
        if (task.maxRunsPerTick != null && runs >= task.maxRunsPerTick) {
          // Keep the fractional remainder, but do not carry a burst of obsolete
          // observations into the next frame. Simulation tasks never opt in.
          task.elapsed %= task.interval
          break
        }
      }
      catchUpCalls += Math.max(0, runs - 1)
      if (runs > maxRepeats) {
        maxRepeats = runs
        mostRepeated = task.name
      }
    }
    for (const id of this._toRemove) this._tasks.delete(id)
    if (catchUpCalls > 0 && (deltaMS >= 50 || maxRepeats >= 4))
      this._getPerformance()?.markEvent?.('scheduler.catchUp', {
        deltaMs: deltaMS,
        calls,
        catchUpCalls,
        mostRepeated,
        maxRepeats,
      })
  }

  _runTask(task: SchedulerTask): void {
    const performanceMonitor = this._getPerformance()
    try {
      if (!performanceMonitor) {
        task.callback()
        return
      }
      performanceMonitor.measureSampled(task.name, task.callback)
    } catch (error) {
      // A throwing task must not stop the tick loop: _tasks is a Map, so an
      // uncaught error here would silently freeze every task registered
      // after this one (in insertion order) on every subsequent frame.
      console.error(`[ActionScheduler] task "${task.name}" threw and was skipped`, error)
    }
  }
}
