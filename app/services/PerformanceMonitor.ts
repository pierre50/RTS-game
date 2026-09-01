const MAX_SAMPLES = 240
const MAX_SLOW_SAMPLES = 12
const MAX_SLOW_FRAMES = 24
const MAX_FRAME_METRIC_DETAILS = 8
const MAX_RENDER_STATS = 12
const SLOW_CALL_THRESHOLD_MS = 8
const SLOW_FRAME_THRESHOLD_MS = 24
const RUNTIME_SAMPLE_RATES = new Map([
  ['animal.step', 16],
  ['animal.behavior', 16],
  ['unit.step', 8],
  ['unit.move', 8],
  ['visibility.update', 4],
  ['projectile.step', 8],
])

type AppLike = {
  renderer?: object
  ticker: {
    FPS: number
    add: (callback: (ticker: { elapsedMS: number }) => void) => void
    remove: (callback: (ticker: { elapsedMS: number }) => void) => void
    speed: number
  }
}

type Metric = {
  count: number
  exclusiveTotal: number
  last: number
  lastExclusive: number
  max: number
  maxExclusive: number
  measuredCount: number
  measuredExclusiveTotal: number
  measuredTotal: number
  slowCount: number
  slowSamples: Array<{ at: number; duration: number }>
  total: number
}

type FrameMetric = {
  count: number
  exclusiveMs: number
  measuredMs: number
  measuredCount: number
  total: number
}

type FrameMetricStats = {
  maxFrameExclusiveMs: number
  frames: number
  maxFrameCalls: number
  maxFrameMs: number
  totalFrameExclusiveMs: number
  totalFrameMs: number
}

type MeasureStackEntry = {
  childMs: number
  name: string
}

type SlowFrame = {
  at: number
  estimatedExclusiveMs: number
  duration: number
  estimatedMs: number
  exclusiveMeasuredMs: number
  measuredMs: number
  metrics: Array<{
    count: number
    exclusiveMs: number
    measuredCount: number
    measuredMs: number
    name: string
    phase: string
    totalMs: number
  }>
  mixedPhases: boolean
  phase: string
  phaseFrame: number
  untrackedMs: number
}

type RenderStats = {
  at: number
  duration: number
  effectiveRenderable: number
  effectiveVisible: number
  maxDepth: number
  nodes: number
  renderable: number
  target: 'screen' | 'texture'
  visible: number
}

type RenderNode = {
  children?: RenderNode[]
  renderable?: boolean
  visible?: boolean
}

export class PerformanceMonitor {
  app: AppLike
  currentFrameMetrics: Map<string, FrameMetric>
  frameMetricStats: Map<string, FrameMetricStats>
  frameTimes: number[]
  measureStack: MeasureStackEntry[]
  metrics: Map<string, Metric>
  phase: string
  phaseFrameCount: number
  renderStats: RenderStats[]
  sampleCounters: Map<string, number>
  slowFrameCount: number
  slowFrames: SlowFrame[]
  _frameTicker: (ticker: { elapsedMS: number }) => void
  _originalRendererRender: ((...args: unknown[]) => unknown) | null

  constructor(app: AppLike) {
    this.app = app
    this.phase = 'load'
    this.phaseFrameCount = 0
    this.renderStats = []
    this.currentFrameMetrics = new Map()
    this.frameMetricStats = new Map()
    this.measureStack = []
    this.metrics = new Map()
    this.sampleCounters = new Map()
    this.slowFrameCount = 0
    this.slowFrames = []
    this._originalRendererRender = null
    this.frameTimes = []
    this._frameTicker = ticker => {
      this.finalizeFrame(ticker.elapsedMS)
      this.frameTimes.push(ticker.elapsedMS)
      if (this.frameTimes.length > MAX_SAMPLES) this.frameTimes.shift()
    }
    app.ticker.add(this._frameTicker)
    this.wrapRendererRender()
  }

  setPhase(phase: string): void {
    if (this.phase !== phase) {
      this.flushCurrentFrameMetrics()
      this.phaseFrameCount = 0
    }
    this.phase = phase
  }

  metricName(name: string): string {
    if (name.startsWith('load.') || name.startsWith('runtime.')) return name
    return `${this.phase}.${name}`
  }

  sampleRate(name: string): number {
    if (this.phase !== 'runtime') return 1
    return RUNTIME_SAMPLE_RATES.get(name) || 1
  }

  shouldSample(name: string): boolean {
    const rate = this.sampleRate(name)
    if (rate <= 1) return true
    const metricName = this.metricName(name)
    const counter = ((this.sampleCounters.get(metricName) || 0) + 1) % rate
    this.sampleCounters.set(metricName, counter)
    return counter === 0
  }

  record(name: string, duration: number, weight = 1, exclusiveDuration = duration): void {
    const metricName = this.metricName(name)
    let metric = this.metrics.get(metricName)
    if (!metric) {
      metric = {
        count: 0,
        exclusiveTotal: 0,
        total: 0,
        max: 0,
        maxExclusive: 0,
        last: 0,
        lastExclusive: 0,
        measuredCount: 0,
        measuredExclusiveTotal: 0,
        measuredTotal: 0,
        slowCount: 0,
        slowSamples: [],
      }
      this.metrics.set(metricName, metric)
    }
    metric.count += weight
    metric.total += duration * weight
    metric.exclusiveTotal += exclusiveDuration * weight
    metric.measuredCount += 1
    metric.measuredTotal += duration
    metric.measuredExclusiveTotal += exclusiveDuration
    metric.max = Math.max(metric.max, duration)
    metric.maxExclusive = Math.max(metric.maxExclusive, exclusiveDuration)
    metric.last = duration
    metric.lastExclusive = exclusiveDuration
    this.recordFrameMetric(metricName, duration, exclusiveDuration, weight)
    if (duration >= SLOW_CALL_THRESHOLD_MS) {
      metric.slowCount++
      metric.slowSamples.push({ duration, at: performance.now() })
      if (metric.slowSamples.length > MAX_SLOW_SAMPLES) metric.slowSamples.shift()
    }
  }

  recordFrameMetric(name: string, duration: number, exclusiveDuration: number, weight: number): void {
    let metric = this.currentFrameMetrics.get(name)
    if (!metric) {
      metric = { count: 0, exclusiveMs: 0, measuredCount: 0, measuredMs: 0, total: 0 }
      this.currentFrameMetrics.set(name, metric)
    }
    metric.count += weight
    metric.exclusiveMs += exclusiveDuration * weight
    metric.measuredCount += 1
    metric.measuredMs += duration
    metric.total += duration * weight
  }

  finalizeFrame(duration: number): void {
    this.phaseFrameCount++
    if (!this.currentFrameMetrics.size) {
      if (duration >= SLOW_FRAME_THRESHOLD_MS) {
        this.slowFrameCount++
        this.slowFrames.push(this.createSlowFrame(duration, 0, 0, 0, 0, []))
        if (this.slowFrames.length > MAX_SLOW_FRAMES) this.slowFrames.shift()
      }
      return
    }

    this.flushCurrentFrameMetricStats()

    if (duration >= SLOW_FRAME_THRESHOLD_MS) {
      this.slowFrameCount++
      let estimatedMs = 0
      let estimatedExclusiveMs = 0
      let measuredMs = 0
      let exclusiveMeasuredMs = 0
      for (const metric of this.currentFrameMetrics.values()) {
        estimatedMs += metric.total
        estimatedExclusiveMs += metric.exclusiveMs
        measuredMs += metric.measuredMs
        exclusiveMeasuredMs += metric.exclusiveMs
      }
      const metrics = [...this.currentFrameMetrics.entries()]
        .sort(([, a], [, b]) => b.exclusiveMs - a.exclusiveMs)
        .slice(0, MAX_FRAME_METRIC_DETAILS)
        .map(([name, metric]) => ({
          name,
          count: metric.count,
          exclusiveMs: metric.exclusiveMs,
          measuredCount: metric.measuredCount,
          measuredMs: metric.measuredMs,
          phase: this.metricPhase(name),
          totalMs: metric.total,
        }))
      this.slowFrames.push(
        this.createSlowFrame(duration, estimatedMs, estimatedExclusiveMs, measuredMs, exclusiveMeasuredMs, metrics)
      )
      if (this.slowFrames.length > MAX_SLOW_FRAMES) this.slowFrames.shift()
    }

    this.currentFrameMetrics.clear()
  }

  flushCurrentFrameMetrics(): void {
    if (!this.currentFrameMetrics.size) return
    this.flushCurrentFrameMetricStats()
    this.currentFrameMetrics.clear()
  }

  flushCurrentFrameMetricStats(): void {
    for (const [name, frameMetric] of this.currentFrameMetrics) {
      let stats = this.frameMetricStats.get(name)
      if (!stats) {
        stats = {
          frames: 0,
          totalFrameMs: 0,
          totalFrameExclusiveMs: 0,
          maxFrameMs: 0,
          maxFrameExclusiveMs: 0,
          maxFrameCalls: 0,
        }
        this.frameMetricStats.set(name, stats)
      }
      stats.frames += 1
      stats.totalFrameMs += frameMetric.total
      stats.totalFrameExclusiveMs += frameMetric.exclusiveMs
      stats.maxFrameMs = Math.max(stats.maxFrameMs, frameMetric.total)
      stats.maxFrameExclusiveMs = Math.max(stats.maxFrameExclusiveMs, frameMetric.exclusiveMs)
      stats.maxFrameCalls = Math.max(stats.maxFrameCalls, frameMetric.count)
    }
  }

  metricPhase(name: string): string {
    const separator = name.indexOf('.')
    return separator > 0 ? name.slice(0, separator) : this.phase
  }

  createSlowFrame(
    duration: number,
    estimatedMs: number,
    estimatedExclusiveMs: number,
    measuredMs: number,
    exclusiveMeasuredMs: number,
    metrics: SlowFrame['metrics']
  ): SlowFrame {
    const phases = new Set(metrics.map(metric => metric.phase))
    if (this.phase) phases.add(this.phase)
    return {
      at: performance.now(),
      duration,
      estimatedExclusiveMs,
      estimatedMs,
      exclusiveMeasuredMs,
      measuredMs,
      metrics,
      mixedPhases: phases.size > 1,
      phase: this.phase,
      phaseFrame: this.phaseFrameCount,
      untrackedMs: Math.max(0, duration - exclusiveMeasuredMs),
    }
  }

  measure<T>(name: string, callback: () => T): T {
    const startedAt = performance.now()
    this.measureStack.push({ name, childMs: 0 })
    try {
      return callback()
    } finally {
      this.finishMeasure(name, performance.now() - startedAt)
    }
  }

  measureSampled<T>(name: string, callback: () => T): T {
    const rate = this.sampleRate(name)
    if (rate <= 1) return this.measure(name, callback)
    if (!this.shouldSample(name)) return callback()
    const startedAt = performance.now()
    this.measureStack.push({ name, childMs: 0 })
    try {
      return callback()
    } finally {
      this.finishMeasure(name, performance.now() - startedAt, rate)
    }
  }

  wrapRendererRender(): void {
    const renderer = this.app.renderer as { render?: (...args: unknown[]) => unknown } | undefined
    if (!renderer?.render || this._originalRendererRender) return
    const originalRender = renderer.render.bind(renderer)
    this._originalRendererRender = originalRender
    renderer.render = (...args: unknown[]) => {
      const options = args[0] as { target?: unknown } | undefined
      const metricName = options && typeof options === 'object' && 'target' in options && options.target
        ? 'pixi.renderTexture'
        : 'pixi.render'
      const startedAt = performance.now()
      try {
        return this.measure(metricName, () => originalRender(...args))
      } finally {
        if (metricName === 'pixi.render') this.recordRenderStats(args[0], performance.now() - startedAt, 'screen')
      }
    }
  }

  recordRenderStats(root: unknown, duration: number, target: RenderStats['target']): void {
    const stats = this.collectRenderStats(root)
    if (!stats) return
    this.renderStats.push({ ...stats, at: performance.now(), duration, target })
    if (this.renderStats.length > MAX_RENDER_STATS) this.renderStats.shift()
  }

  collectRenderStats(root: unknown): Omit<RenderStats, 'at' | 'duration' | 'target'> | null {
    const container = this.renderRoot(root)
    if (!container) return null
    const stack: Array<{ depth: number; node: RenderNode; parentRenderable: boolean; parentVisible: boolean }> = [
      { node: container, depth: 0, parentRenderable: true, parentVisible: true },
    ]
    let effectiveRenderable = 0
    let effectiveVisible = 0
    let maxDepth = 0
    let nodes = 0
    let renderable = 0
    let visible = 0
    while (stack.length) {
      const { node, depth, parentRenderable, parentVisible } = stack.pop()!
      const nodeVisible = node.visible !== false
      const nodeRenderable = node.renderable !== false
      const nodeEffectiveVisible = parentVisible && nodeVisible
      const nodeEffectiveRenderable = parentRenderable && nodeVisible && nodeRenderable
      nodes++
      if (nodeRenderable) renderable++
      if (nodeVisible) visible++
      if (nodeEffectiveVisible) effectiveVisible++
      if (nodeEffectiveRenderable) effectiveRenderable++
      maxDepth = Math.max(maxDepth, depth)
      const children = node.children
      if (!children?.length) continue
      for (let i = children.length - 1; i >= 0; i--) {
        stack.push({
          node: children[i],
          depth: depth + 1,
          parentRenderable: nodeEffectiveRenderable,
          parentVisible: nodeEffectiveVisible,
        })
      }
    }
    return { effectiveRenderable, effectiveVisible, maxDepth, nodes, renderable, visible }
  }

  renderRoot(root: unknown): RenderNode | null {
    if (!root || typeof root !== 'object') return null
    const maybeOptions = root as { container?: unknown }
    const candidate = maybeOptions.container ?? root
    if (!candidate || typeof candidate !== 'object') return null
    const maybeNode = candidate as Partial<RenderNode>
    return Array.isArray(maybeNode.children) ? (maybeNode as RenderNode) : null
  }

  restoreRendererRender(): void {
    if (!this._originalRendererRender || !this.app.renderer) return
    ;(this.app.renderer as { render: (...args: unknown[]) => unknown }).render = this._originalRendererRender
    this._originalRendererRender = null
  }

  finishMeasure(name: string, duration: number, weight = 1): void {
    const entry = this.measureStack.pop()
    const childMs = entry?.name === name ? entry.childMs : 0
    const exclusiveDuration = Math.max(0, duration - childMs)
    const parent = this.measureStack[this.measureStack.length - 1]
    if (parent) parent.childMs += duration
    this.record(name, duration, weight, exclusiveDuration)
  }

  snapshot() {
    const sortedFrames = [...this.frameTimes].sort((a, b) => a - b)
    const percentile = (ratio: number) =>
      sortedFrames[Math.min(sortedFrames.length - 1, Math.floor(sortedFrames.length * ratio))] || 0
    const metrics: Record<
      string,
      {
        count: number
        totalMs: number
        exclusiveMs: number
        averageMs: number
        averageExclusiveMs: number
        measuredCount: number
        measuredAverageMs: number
        measuredAverageExclusiveMs: number
        maxMs: number
        maxExclusiveMs: number
        lastMs: number
        lastExclusiveMs: number
        slowCount: number
        slowSamples: Array<{ at: number; duration: number }>
        frames: number
        averageFrameMs: number
        averageFrameExclusiveMs: number
        maxFrameMs: number
        maxFrameExclusiveMs: number
        maxFrameCalls: number
      }
    > = {}
    for (const [name, metric] of this.metrics) {
      const frameStats = this.frameMetricStats.get(name)
      metrics[name] = {
        count: metric.count,
        totalMs: metric.total,
        exclusiveMs: metric.exclusiveTotal,
        averageMs: metric.count ? metric.total / metric.count : 0,
        averageExclusiveMs: metric.count ? metric.exclusiveTotal / metric.count : 0,
        measuredCount: metric.measuredCount,
        measuredAverageMs: metric.measuredCount ? metric.measuredTotal / metric.measuredCount : 0,
        measuredAverageExclusiveMs: metric.measuredCount ? metric.measuredExclusiveTotal / metric.measuredCount : 0,
        maxMs: metric.max,
        maxExclusiveMs: metric.maxExclusive,
        lastMs: metric.last,
        lastExclusiveMs: metric.lastExclusive,
        slowCount: metric.slowCount,
        slowSamples: metric.slowSamples.map((sample: { at: number; duration: number }) => ({ ...sample })),
        frames: frameStats?.frames ?? 0,
        averageFrameMs: frameStats?.frames ? frameStats.totalFrameMs / frameStats.frames : 0,
        averageFrameExclusiveMs: frameStats?.frames ? frameStats.totalFrameExclusiveMs / frameStats.frames : 0,
        maxFrameMs: frameStats?.maxFrameMs ?? 0,
        maxFrameExclusiveMs: frameStats?.maxFrameExclusiveMs ?? 0,
        maxFrameCalls: frameStats?.maxFrameCalls ?? 0,
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
        slowCount: this.slowFrameCount,
      },
      metrics,
      renderStats: this.renderStats.map(stats => ({ ...stats })),
      slowFrames: this.slowFrames.map(frame => ({
        ...frame,
        metrics: frame.metrics.map(metric => ({ ...metric })),
      })),
    }
  }

  reset(): void {
    this.currentFrameMetrics.clear()
    this.frameMetricStats.clear()
    this.measureStack.length = 0
    this.metrics.clear()
    this.phaseFrameCount = 0
    this.renderStats.length = 0
    this.sampleCounters.clear()
    this.slowFrameCount = 0
    this.slowFrames.length = 0
    this.frameTimes.length = 0
  }

  destroy(): void {
    this.app.ticker.remove(this._frameTicker)
    this.restoreRendererRender()
    this.reset()
  }
}
