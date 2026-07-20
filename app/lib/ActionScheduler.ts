type SchedulerTask = {
  callback: () => void
  elapsed: number
  interval: number
  name: string
  oneShot?: boolean
}

type PerformanceLike = {
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
  timeScale: number

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

  add(callback: () => void, intervalMs: number, name = 'scheduler.task'): number {
    const id = this._nextId++
    this._tasks.set(id, { callback, interval: intervalMs, elapsed: 0, name })
    return id
  }

  addOneShot(callback: () => void, delayMs: number, name = 'scheduler.oneShot'): number {
    const id = this._nextId++
    this._tasks.set(id, { callback, interval: delayMs, elapsed: 0, oneShot: true, name })
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
    this._toRemove.length = 0
  }

  destroy(): void {
    this.clear()
    this._app.ticker.remove(this._onTick)
  }

  _tick(deltaMS: number): void {
    if (this._getPaused()) return
    const tickStartedAt = performance.now()
    this.elapsedMs += deltaMS
    this._toRemove.length = 0
    for (const [id, task] of this._tasks) {
      task.elapsed += deltaMS
      if (task.oneShot) {
        if (task.elapsed >= task.interval) {
          task.elapsed -= task.interval
          this._runTask(task)
          this._toRemove.push(id)
        }
        continue
      }

      while (task.elapsed >= task.interval) {
        task.elapsed -= task.interval
        this._runTask(task)

        // The callback may remove or replace this task, so stop safely.
        if (!this._tasks.has(id) || this._tasks.get(id) !== task) {
          break
        }
      }
    }
    for (const id of this._toRemove) this._tasks.delete(id)
    this._getPerformance()?.record('scheduler.tick', performance.now() - tickStartedAt)
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
