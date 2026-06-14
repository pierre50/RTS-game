const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')

function loadCameraController() {
  const filename = path.join(__dirname, '../app/controllers/CameraController.js')
  const source = fs.readFileSync(filename, 'utf8')
  const { code } = babel.transformSync(source, {
    filename,
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }]],
  })
  const module = { exports: {} }
  const mocks = {
    '../lib': {
      isometricToCartesian: () => [0, 0],
      pointInRectangle: () => true,
      pointIsBetweenTwoPoint: () => true,
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
