const MAX_SAMPLES = 240
const MAX_SLOW_SAMPLES = 12
const SLOW_CALL_THRESHOLD_MS = 8
const RUNTIME_SAMPLE_RATES = new Map([
  ['animal.step', 16],
  ['animal.behavior', 16],
  ['unit.step', 8],
  ['unit.move', 8],
  ['visibility.update', 4],
  ['building.production', 8],
  ['projectile.step', 8],
])

export class PerformanceMonitor {
  constructor(app) {
    this.app = app
    this.phase = 'load'
    this.metrics = new Map()
    this.sampleCounters = new Map()
    this.frameTimes = []
    this._frameTicker = ticker => {
      this.frameTimes.push(ticker.elapsedMS)
      if (this.frameTimes.length > MAX_SAMPLES) this.frameTimes.shift()
    }
    app.ticker.add(this._frameTicker)
  }

  setPhase(phase) {
    this.phase = phase
  }

  metricName(name) {
    if (name.startsWith('load.') || name.startsWith('runtime.')) return name
    return `${this.phase}.${name}`
  }

  sampleRate(name) {
    if (this.phase !== 'runtime') return 1
    return RUNTIME_SAMPLE_RATES.get(name) || 1
  }

  shouldSample(name) {
    const rate = this.sampleRate(name)
    if (rate <= 1) return true
    const metricName = this.metricName(name)
    const counter = ((this.sampleCounters.get(metricName) || 0) + 1) % rate
    this.sampleCounters.set(metricName, counter)
    return counter === 0
  }

  record(name, duration, weight = 1) {
    const metricName = this.metricName(name)
    let metric = this.metrics.get(metricName)
    if (!metric) {
      metric = { count: 0, total: 0, max: 0, last: 0, slowCount: 0, slowSamples: [] }
      this.metrics.set(metricName, metric)
    }
    metric.count += weight
    metric.total += duration * weight
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

  measureSampled(name, callback) {
    const rate = this.sampleRate(name)
    if (rate <= 1) return this.measure(name, callback)
    if (!this.shouldSample(name)) return callback()
    const startedAt = performance.now()
    try {
      return callback()
    } finally {
      this.record(name, performance.now() - startedAt, rate)
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
        fps: this.app.ticker.FPS,
        speed: this.app.ticker.speed,
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
    this.sampleCounters.clear()
    this.frameTimes.length = 0
  }

  destroy() {
    this.app.ticker.remove(this._frameTicker)
    this.reset()
  }
}
