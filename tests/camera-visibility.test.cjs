const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')
const { requireFromTsFile } = require('./helpers/loadTsModule.cjs')

function loadCameraController(zoom = 1) {
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
    '../lib/audio/settings': { getCameraZoom: () => zoom },
    '../lib/mapSpaces': {
      OUTSIDE_SPACE_ID: 'outside',
      getActiveMapSpace: map => {
        const activeId = map.activeSpaceId || 'outside'
        return (
          map.spaces?.get?.(activeId) ?? {
            container: map,
            grid: map.grid,
            id: 'outside',
            kind: 'outside',
            origin: { x: 0, y: 0 },
            size: map.size,
          }
        )
      },
    },
  }
  const localRequire = request =>
    Object.hasOwn(mocks, request) ? mocks[request] : requireFromTsFile(request, filename, mocks)
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

test('tracks visible cells from the active interior space instead of the outside map', () => {
  const CameraController = loadCameraController()
  let outsideUpdates = 0
  let interiorUpdates = 0
  let renderChunkUpdates = 0
  const outsideCell = {
    has: null,
    corpses: new Set(),
    updateVisible: () => outsideUpdates++,
  }
  const interiorCell = {
    has: null,
    corpses: new Set(),
    updateVisible: () => interiorUpdates++,
  }
  const interiorSpace = {
    container: {},
    grid: [[interiorCell]],
    id: 'interior:house',
    kind: 'interior',
    origin: { x: 1200, y: 640 },
    size: 0,
  }
  const map = {
    activeSpaceId: 'interior:house',
    grid: [[outsideCell]],
    size: 0,
    spaces: new Map([
      [
        'outside',
        {
          container: null,
          grid: [[outsideCell]],
          id: 'outside',
          kind: 'outside',
          origin: { x: 0, y: 0 },
          size: 0,
        },
      ],
      ['interior:house', interiorSpace],
    ]),
    updateRenderChunks: () => renderChunkUpdates++,
  }
  map.spaces.get('outside').container = map
  const controller = new CameraController({
    app: { screen: { width: 64, height: 32 } },
    map,
    player: { views: {} },
  })
  controller.getViewportRect = () => ({
    visibleLeft: 1200,
    visibleTop: 640,
    visibleWidth: 64,
    visibleHeight: 32,
  })

  controller.updateVisibleCells()

  assert.equal(interiorUpdates, 1)
  assert.equal(outsideUpdates, 0)
  assert.equal(renderChunkUpdates, 0)
  assert.equal(controller.visibleCells.has(interiorCell), true)
})

test('can move the camera without edge-slide adjustments', () => {
  const CameraController = loadCameraController()
  const mapSize = 80
  const map = {
    grid: Array.from({ length: mapSize + 1 }, () =>
      Array.from({ length: mapSize + 1 }, () => ({ corpses: new Set() }))
    ),
    setCoordinate: () => {},
    size: mapSize,
    updateRenderChunks: () => {},
  }
  const controller = new CameraController({
    app: { screen: { width: 640, height: 360 } },
    map,
    player: { views: {} },
  })
  controller.camera = { x: 900, y: 900 }
  const previousRequestAnimationFrame = global.requestAnimationFrame
  global.requestAnimationFrame = () => 0

  try {
    controller.move('left', 20, false, 1, false)
  } finally {
    global.requestAnimationFrame = previousRequestAnimationFrame
  }

  assert.equal(controller.camera.x, 880)
  assert.equal(controller.camera.y, 900)
})

function createLocalCamera(zoom = 1, screen = { width: 640, height: 360 }) {
  const CameraController = loadCameraController(zoom)
  const controller = new CameraController({
    app: { screen },
    map: { grid: [], size: 100, localGridLayout: { columns: 21, rows: 81 }, setCoordinate() {} },
  })
  return controller
}

test('local camera clamps the full zoomed viewport at every corner for centered and direct sets', () => {
  // The local map spans x [-640, 640], y [320, 1600].
  for (const zoom of [0.75, 1, 2]) {
    for (const direct of [false, true]) {
      for (const x of [-10000, 10000]) {
        for (const y of [-10000, 10000]) {
          const controller = createLocalCamera(zoom)
          controller.set(x, y, direct)
          const view = controller.getViewportRect()
          assert.ok(Math.abs(view.visibleLeft - (x < 0 ? -640 : 640 - view.visibleWidth)) < 1e-8)
          assert.ok(Math.abs(view.visibleTop - (y < 0 ? 320 : 1600 - view.visibleHeight)) < 1e-8)
        }
      }
    }
  }
})

test('local camera centers oversized viewport axes independently', () => {
  const controller = createLocalCamera(0.5, { width: 1000, height: 200 })
  controller.set(10000, -10000)
  const view = controller.getViewportRect()
  assert.equal(view.visibleLeft + view.visibleWidth / 2, 0)
  assert.equal(view.visibleTop, 320)
  const both = createLocalCamera(0.25)
  both.set(10000, 10000)
  const oversized = both.getViewportRect()
  assert.equal(oversized.visibleLeft + oversized.visibleWidth / 2, 0)
  assert.equal(oversized.visibleTop + oversized.visibleHeight / 2, 960)
})

test('local camera movement never slides along a diamond or moves vertically twice', () => {
  for (const useEdgeSlide of [false, true]) {
    for (const [direction, dx, dy] of [
      ['left', -20, 0],
      ['right', 20, 0],
      ['up', 0, -20],
      ['down', 0, 20],
    ]) {
      const controller = createLocalCamera()
      controller.set(0, 960)
      const before = { ...controller.camera }
      controller.move(direction, 20, false, 1, useEdgeSlide)
      assert.equal(controller.camera.x, before.x + dx)
      assert.equal(controller.camera.y, before.y + dy)
    }
    const controller = createLocalCamera()
    controller.set(-10000, 960)
    const before = { ...controller.camera }
    controller.move('left', 20, false, 1, useEdgeSlide)
    assert.deepEqual(controller.camera, before)
    controller.move('down', 20, false, 1, useEdgeSlide)
    assert.deepEqual(controller.camera, { x: before.x, y: before.y + 20 })
  }
})

test('legacy no-edge-slide vertical movement applies speed exactly once', () => {
  const controller = createLocalCamera()
  delete controller.context.map.localGridLayout
  controller.set(0, 1600)
  const before = { ...controller.camera }
  controller.move('up', 20, false, 1, false)
  assert.deepEqual(controller.camera, { x: before.x, y: before.y - 20 })
  controller.move('down', 20, false, 1, false)
  assert.deepEqual(controller.camera, before)
})

test('local camera bounds do not apply to interiors', () => {
  const controller = createLocalCamera()
  controller.context.map.activeSpaceId = 'interior:house'
  controller.context.map.spaces = new Map([
    [
      'interior:house',
      {
        id: 'interior:house',
        container: {},
        origin: { x: 2000, y: 3000 },
        grid: [],
        size: 10,
      },
    ],
  ])
  controller.set(2000, 3160)
  assert.deepEqual(controller.camera, { x: 1680, y: 2980 })
})

function createExplorationCamera(zoom = 1) {
  const CameraController = loadCameraController(zoom)
  const { loadTsModule } = require('./helpers/loadTsModule.cjs')
  const { VisionGrid } = loadTsModule('app/services/VisionGrid.ts')
  const size = 30
  const grid = Array.from({ length: size + 1 }, (_, i) =>
    Array.from({ length: size + 1 }, (_, j) => ({
      i,
      j,
      x: (i - j) * 32,
      y: (i + j) * 16,
      has: null,
      corpses: new Set(),
      updateVisible() {},
    }))
  )
  const context = {
    app: { screen: { width: 64, height: 32 } },
    map: { size, grid, updateRenderChunks() {} },
    controls: { heroUnit: { spaceId: 'outside' }, freeCameraActive: false },
    player: { views: new VisionGrid(size), cellViewed: 0 },
  }
  const controller = new CameraController(context)
  controller.camera = { x: 0, y: 300 }
  return { controller, context, views: context.player.views }
}

test('only the actual camera footprint is explored, never its render halo', () => {
  const { controller, context, views } = createExplorationCamera()
  controller.updateVisibleCells()
  assert.equal(views.isViewed(10, 10), true)
  assert.equal(controller.visibleCells.has(context.map.grid[15][10]), true)
  assert.equal(views.isViewed(15, 10), false)
  const discovered = context.player.cellViewed
  assert.ok(discovered > 0)
  controller.updateVisibleCells()
  assert.equal(context.player.cellViewed, discovered)
  controller.camera.x = 300
  controller.updateVisibleCells(false)
  assert.equal(views.isViewed(10, 10), true, 'exploration remains after leaving the viewport')
  assert.ok(context.player.cellViewed > discovered)
})

test('debug camera cannot explore and switching it off refreshes even an unchanged viewport', () => {
  const { controller, context, views } = createExplorationCamera()
  context.controls.freeCameraActive = true
  controller.updateVisibleCells(false)
  assert.equal(context.player.cellViewed, 0)
  assert.ok(controller.visibleCells.size > 0, 'debug rendering still works')
  context.controls.freeCameraActive = false
  controller.updateVisibleCells(false)
  assert.equal(views.isViewed(10, 10), true)
})

test('camera boot, editor and a different hero space never explore', () => {
  for (const mode of ['boot', 'editor', 'other-space']) {
    const { controller, context } = createExplorationCamera()
    if (mode === 'boot') context.controls.heroUnit = null
    if (mode === 'editor') context.editor = {}
    if (mode === 'other-space') context.controls.heroUnit.spaceId = 'interior:house'
    controller.updateVisibleCells()
    assert.equal(context.player.cellViewed, 0, mode)
  }
})

test('camera exploration respects interior origins and keeps exterior coordinates untouched', () => {
  const { controller, context, views } = createExplorationCamera()
  const spaceId = 'interior:house'
  context.map.activeSpaceId = spaceId
  context.controls.heroUnit.spaceId = spaceId
  context.map.spaces = new Map([
    [
      spaceId,
      {
        id: spaceId,
        container: {},
        origin: { x: 1000, y: 2000 },
        size: context.map.size,
        grid: context.map.grid,
      },
    ],
  ])
  controller.camera = { x: 1000, y: 2300 }
  controller.updateVisibleCells()
  assert.equal(views.isViewed(10, 10), false)
  assert.equal(
    views.withSpace(spaceId, () => views.isViewed(10, 10)),
    true
  )
})

test('zoom changes the explored footprint and sub-cell movement reuses camera candidates', () => {
  const near = createExplorationCamera(2)
  const far = createExplorationCamera(0.5)
  near.controller.updateVisibleCells(false)
  far.controller.updateVisibleCells(false)
  assert.ok(far.context.player.cellViewed > near.context.player.cellViewed)
  const previous = near.controller.visibleCells
  near.controller.camera.x += 0.5
  near.controller.updateVisibleCells(false)
  assert.equal(near.controller.visibleCells, previous)
  assert.equal(near.controller.visibleCellsStats.samples, 0)
})
