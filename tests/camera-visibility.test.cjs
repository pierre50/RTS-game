const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')

function loadCameraController() {
  const filename = path.join(__dirname, '../app/controllers/CameraController.ts')
  const source = fs.readFileSync(filename, 'utf8')
  const { code } = babel.transformSync(source, {
    filename,
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }], '@babel/preset-typescript'],
  })
  const module = { exports: {} }
  const mocks = {
    '../lib': {
      isometricToCartesian: () => [0, 0],
      pointInRectangle: () => true,
      pointIsBetweenTwoPoint: () => true,
      updateInstanceRenderVisibility: instance => {
        if (!instance) return false
        instance.visible = false
        instance.__renderRecomputed = true
        return false
      },
    },
    '../lib/graphics/chunkCulling': {
      rectangleIntersectsViewport: (bounds, viewport, margin = 0) => {
        const left = viewport.visibleLeft - margin
        const top = viewport.visibleTop - margin
        const right = viewport.visibleLeft + viewport.visibleWidth + margin
        const bottom = viewport.visibleTop + viewport.visibleHeight + margin
        return (
          bounds.minX + bounds.width >= left &&
          bounds.minX <= right &&
          bounds.minY + bounds.height >= top &&
          bounds.minY <= bottom
        )
      },
    },
    '../constants': { CELL_HEIGHT: 32, CELL_WIDTH: 64 },
    '../lib/settings': { getCameraZoom: () => 1 },
  }
  const localRequire = request => (Object.hasOwn(mocks, request) ? mocks[request] : require(request))
  new Function('module', 'exports', 'require', code)(module, module.exports, localRequire)
  return module.exports.CameraController
}

test('refreshes camera-culled entities when their cell remains in the preload area', () => {
  const CameraController = loadCameraController()
  let updates = 0
  const cell = {
    has: { family: 'resource' },
    corpses: new Set(),
    updateVisible: () => updates++,
  }
  const map = {
    grid: [[cell]],
    size: 0,
    updateRenderChunks: () => {},
  }
  const controller = new CameraController({
    app: { screen: { width: 64, height: 32 } },
    map,
    player: { views: {} },
  })
  controller.getViewportRect = () => ({
    visibleLeft: 0,
    visibleTop: 0,
    visibleWidth: 0,
    visibleHeight: 0,
  })

  controller.updateVisibleCells()
  controller.updateVisibleCells()

  assert.equal(updates, 2)
})

test('recomputes render visibility instead of blindly hiding when a cell drops out of the tracked halo', () => {
  const CameraController = loadCameraController()
  const cell = {
    has: { label: 'building', visible: true },
    corpses: new Set(),
    updateVisible: () => {},
  }
  const otherCell = { has: null, corpses: new Set(), updateVisible: () => {} }
  const map = {
    grid: [[cell]],
    size: 0,
    updateRenderChunks: () => {},
  }
  const controller = new CameraController({
    app: { screen: { width: 64, height: 32 } },
    map,
    player: { views: {} },
  })
  controller.getViewportRect = () => ({
    visibleLeft: 0,
    visibleTop: 0,
    visibleWidth: 0,
    visibleHeight: 0,
  })

  controller.updateVisibleCells()
  assert.equal(controller.visibleCells.has(cell), true)

  // The cell drops out of the tracked halo (e.g. the camera panned far away).
  map.grid = [[otherCell]]
  controller.updateVisibleCells()

  assert.equal(cell.has.visible, false)
  assert.equal(cell.has.__renderRecomputed, true)
})

test('skips scheduled visible-cell refreshes while the camera stays in the same culling bucket', () => {
  const CameraController = loadCameraController()
  let updates = 0
  let renderChunkUpdates = 0
  const cell = {
    has: null,
    corpses: new Set(),
    updateVisible: () => updates++,
  }
  const map = {
    grid: [[cell]],
    size: 0,
    updateRenderChunks: () => renderChunkUpdates++,
  }
  const controller = new CameraController({
    app: { screen: { width: 64, height: 32 } },
    map,
    player: { views: {} },
  })
  controller.getViewportRect = () => ({
    visibleLeft: 0,
    visibleTop: 0,
    visibleWidth: 64,
    visibleHeight: 32,
  })

  controller.updateVisibleCells(false)
  controller.updateVisibleCells(false)
  controller.updateVisibleCells()

  assert.equal(renderChunkUpdates, 2)
  assert.equal(updates, 1)
})
