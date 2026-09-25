const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')

function loadPerformanceMonitor() {
  const filename = path.join(__dirname, '../app/services/PerformanceMonitor.ts')
  const source = fs.readFileSync(filename, 'utf8')
  const { code } = babel.transformSync(source, {
    filename,
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }], '@babel/preset-typescript'],
  })
  const module = { exports: {} }
  new Function('module', 'exports', code)(module, module.exports)
  return module.exports.PerformanceMonitor
}

test('render stats distinguish raw renderable flags from effective renderable nodes', () => {
  const PerformanceMonitor = loadPerformanceMonitor()
  const monitor = new PerformanceMonitor({
    renderer: {},
    ticker: {
      FPS: 120,
      add() {},
      remove() {},
      speed: 1,
    },
  })
  const root = {
    children: [
      {
        children: [{ renderable: true, visible: true }],
        renderable: true,
        visible: false,
      },
      {
        children: [{ renderable: true, visible: true }],
        renderable: true,
        visible: true,
      },
    ],
    renderable: true,
    visible: true,
  }

  const stats = monitor.collectRenderStats(root)

  assert.equal(stats.nodes, 5)
  assert.equal(stats.renderable, 5)
  assert.equal(stats.visible, 4)
  assert.equal(stats.effectiveRenderable, 3)
  assert.equal(stats.effectiveVisible, 3)
})

function createMonitor() {
  const PerformanceMonitor = loadPerformanceMonitor()
  return new PerformanceMonitor({ renderer: {}, ticker: { FPS: 61, speed: 1, add() {}, remove() {} } })
}

test('sampled frame peaks and unexplained time use measured durations, not weighted estimates', () => {
  const monitor = createMonitor()
  monitor.setPhase('runtime')
  monitor.record('animal.step', 32, 16, 30)
  monitor.finalizeFrame(125)
  const report = monitor.snapshot()
  const metric = report.metrics['runtime.animal.step']
  assert.equal(metric.totalMs, 512, 'aggregate estimate remains available')
  assert.equal(metric.count, 16)
  assert.equal(metric.measuredCount, 1)
  assert.equal(metric.maxFrameMs, 32)
  assert.equal(metric.maxFrameExclusiveMs, 30)
  assert.equal(metric.maxFrameCalls, 1)
  assert.equal(report.slowFrames[0].exclusiveMeasuredMs, 30)
  assert.equal(report.slowFrames[0].untrackedMs, 95)
  assert.equal(report.slowFrames[0].metrics[0].exclusiveMs, 30)
})

test('window FPS and slow count use the same interval samples; severe spikes survive later frames', () => {
  const monitor = createMonitor()
  monitor._frameTicker({ elapsedMS: 125 })
  for (let i = 0; i < 30; i++) monitor._frameTicker({ elapsedMS: 25 })
  const report = monitor.snapshot()
  assert.equal(report.frames.fps, 1000 / (875 / 31))
  assert.equal(report.frames.tickerFps, 61)
  assert.equal(report.frames.windowSlowCount, 31)
  assert.equal(report.slowFrames.length, 24)
  assert.ok(report.slowFrames.some(frame => frame.duration === 125))
})

test('scene census is throttled independently from recording every render duration', () => {
  const PerformanceMonitor = loadPerformanceMonitor()
  const monitor = new PerformanceMonitor({
    renderer: { render() {} },
    ticker: { FPS: 60, speed: 1, add() {}, remove() {} },
  })
  let visits = 0
  const root = {
    get children() {
      visits++
      return []
    },
  }
  monitor.app.renderer.render(root)
  const firstVisits = visits
  for (let i = 0; i < 100; i++) monitor.app.renderer.render(root)
  assert.equal(visits, firstVisits)
  assert.equal(monitor.snapshot().metrics['load.pixi.render'].count, 101)
  assert.equal(monitor.renderStats.length, 1)
  monitor.reset()
  monitor.app.renderer.render(root)
  assert.ok(visits > firstVisits)
})

test('nested scheduler, AI and manually recorded paths do not double count exclusive CPU', t => {
  let now = 0
  t.mock.method(performance, 'now', () => now)
  const monitor = createMonitor()
  monitor.setPhase('runtime')
  monitor.measure('scheduler.tick', () => {
    now = 5
    monitor.measure('ai.economy', () => {
      now = 15
      monitor.record('pathfinding', 10)
      now = 35
    })
    now = 40
  })
  monitor.finalizeFrame(50)
  const frame = monitor.snapshot().slowFrames[0]
  assert.equal(frame.exclusiveMeasuredMs, 40)
  assert.equal(frame.untrackedMs, 10)
  assert.equal(monitor.snapshot().metrics['runtime.ai.economy'].exclusiveMs, 20)
  assert.equal(monitor.snapshot().metrics['runtime.scheduler.tick'].exclusiveMs, 10)
})

test('slow frames retain nearby teleport context independently of the bounded event history', t => {
  let now = 0
  t.mock.method(performance, 'now', () => now)
  const monitor = createMonitor()
  monitor.setPhase('runtime')
  monitor.markEvent('teleport.minimap', { toI: 123, toJ: 456 })
  now = 1000
  monitor.markEvent('ai.slowStep', { civilization: 'Kemet', durationMs: 400 })
  monitor.record('ai.step', 400)
  monitor.finalizeFrame(500)
  for (let i = 0; i < 200; i++) monitor.markEvent('later', { i })
  const snapshot = monitor.snapshot()
  assert.equal(snapshot.events.length, 128)
  assert.equal(snapshot.slowFrames[0].events[0].name, 'teleport.minimap')
  snapshot.slowFrames[0].events[0].details.toI = 999
  assert.equal(monitor.snapshot().slowFrames[0].events[0].details.toI, 123)
  monitor.reset()
  assert.deepEqual(monitor.snapshot().events, [])
})
