export class ActionScheduler {
  constructor(app, getPaused) {
    this._app = app
    this._getPaused = getPaused
    this._tasks = new Map()
    this._nextId = 1
    this._toRemove = []
    this.timeScale = 1
    this.elapsedMs = 0
    this._onTick = ticker => this._tick(ticker.deltaMS)
    app.ticker.add(this._onTick)
  }

  add(callback, intervalMs) {
    const id = this._nextId++
    this._tasks.set(id, { callback, interval: intervalMs, elapsed: 0 })
    return id
  }

  addOneShot(callback, delayMs) {
    const id = this._nextId++
    this._tasks.set(id, { callback, interval: delayMs, elapsed: 0, oneShot: true })
    return id
  }

  remove(id) {
    this._tasks.delete(id)
  }

  update(id, intervalMs) {
    const task = this._tasks.get(id)
    if (task) task.interval = intervalMs
  }

  clear() {
    this._tasks.clear()
    this._toRemove.length = 0
  }

  destroy() {
    this.clear()
    this._app.ticker.remove(this._onTick)
  }

  _tick(deltaMS) {
    if (this._getPaused()) return
    this.elapsedMs += deltaMS
    this._toRemove.length = 0
    for (const [id, task] of this._tasks) {
      task.elapsed += deltaMS
      if (task.oneShot) {
        if (task.elapsed >= task.interval) {
          task.elapsed -= task.interval
          task.callback()
          this._toRemove.push(id)
        }
        continue
      }

      while (task.elapsed >= task.interval) {
        task.elapsed -= task.interval
        task.callback()

        // The callback may remove or replace this task, so stop safely.
        if (!this._tasks.has(id) || this._tasks.get(id) !== task) {
          break
        }
      }
    }
    for (const id of this._toRemove) this._tasks.delete(id)
  }
}
