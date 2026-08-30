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
