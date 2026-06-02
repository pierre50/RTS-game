export class ActionScheduler {
  constructor(app, getPaused) {
    this._getPaused = getPaused
    this._tasks = new Map()
    this._nextId = 1
    this._toRemove = []
    this.timeScale = 1
    app.ticker.add(ticker => this._tick(ticker.deltaMS))
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

  _tick(deltaMS) {
    if (this._getPaused()) return
    const scaledDeltaMS = deltaMS * this.timeScale
    this._toRemove.length = 0
    for (const [id, task] of this._tasks) {
      task.elapsed += scaledDeltaMS
      if (task.elapsed >= task.interval) {
        task.elapsed -= task.interval
        task.callback()
        if (task.oneShot) this._toRemove.push(id)
      }
    }
    for (const id of this._toRemove) this._tasks.delete(id)
  }
}
