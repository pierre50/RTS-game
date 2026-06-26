const MAX_SAMPLES = 240
const MAX_SLOW_SAMPLES = 12
const SLOW_CALL_THRESHOLD_MS = 8

export class PerformanceMonitor {
  constructor(app) {
    this.app = app
    this.metrics = new Map()
    this.frameTimes = []
    this._frameTicker = ticker => {
      this.frameTimes.push(ticker.elapsedMS)
      if (this.frameTimes.length > MAX_SAMPLES) this.frameTimes.shift()
    }
    app.ticker.add(this._frameTicker)
  }

  record(name, duration) {
    let metric = this.metrics.get(name)
    if (!metric) {
      metric = { count: 0, total: 0, max: 0, last: 0, slowCount: 0, slowSamples: [] }
      this.metrics.set(name, metric)
    }
    metric.count++
    metric.total += duration
    metric.max = Math.max(metric.max, duration)
    metric.last = duration
    if (duration >= SLOW_CALL_THRESHOLD_MS) {
      metric.slowCount++
      metric.slowSamples.push({ duration, at: performance.now() })
      if (metric.slowSamples.length > MAX_SLOW_SAMPLES) metric.slowSamples.shift()
    }
  }

  measure(name, callback) {
    const startedAt = performance.now()
    try {
      return callback()
    } finally {
      this.record(name, performance.now() - startedAt)
    }
  }

  snapshot() {
    const sortedFrames = [...this.frameTimes].sort((a, b) => a - b)
    const percentile = ratio =>
      sortedFrames[Math.min(sortedFrames.length - 1, Math.floor(sortedFrames.length * ratio))] || 0
    const metrics = {}
    for (const [name, metric] of this.metrics) {
      metrics[name] = {
        count: metric.count,
        totalMs: metric.total,
        averageMs: metric.count ? metric.total / metric.count : 0,
        maxMs: metric.max,
        lastMs: metric.last,
        slowCount: metric.slowCount,
        slowSamples: metric.slowSamples.map(sample => ({ ...sample })),
      }
    }
    return {
      frames: {
        samples: sortedFrames.length,
        averageMs: sortedFrames.length
          ? sortedFrames.reduce((total, duration) => total + duration, 0) / sortedFrames.length
          : 0,
        p95Ms: percentile(0.95),
        p99Ms: percentile(0.99),
      },
      metrics,
    }
  }

  reset() {
    this.metrics.clear()
    this.frameTimes.length = 0
  }

  destroy() {
    this.app.ticker.remove(this._frameTicker)
    this.reset()
  }
}
