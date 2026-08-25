const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')

function loadModule(relativePath, mocks = {}) {
  const filename = path.join(__dirname, '..', relativePath)
  const source = fs.readFileSync(filename, 'utf8')
  const { code } = babel.transformSync(source, {
    filename,
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }], '@babel/preset-typescript'],
  })
  const module = { exports: {} }
  const localRequire = request => (Object.hasOwn(mocks, request) ? mocks[request] : require(request))
  new Function('module', 'exports', 'require', code)(module, module.exports, localRequire)
  return module.exports
}

const { bindAnimatedSpriteToTicker } = loadModule('app/lib/spriteTextures.ts', {
  '../constants': { SHEET_TYPES: {}, WORK_TYPES: {} },
  './maths': {},
})

function bindSprite(sprite) {
  let tick
  const ticker = {
    add: handler => {
      tick = handler
    },
    remove: () => {},
  }
  bindAnimatedSpriteToTicker(
    {
      autoUpdate: true,
      destroy: () => {},
      update: () => {
        sprite.updates += 1
      },
      ...sprite,
    },
    { ticker }
  )
  return () => tick?.({})
}

const { updateInstanceRenderVisibility } = loadModule('app/lib/grid/visibility.ts', {
  '../../constants': { BUCKET_SIZE: 8, FAMILY_TYPES: { resource: 'resource' } },
  '../../services/FogOfWar': { updateVisibility: () => {} },
  '../insightDetection': { getInsightDetectionRange: (_instance, _target, range) => range },
  './cells': { getBuildingFootprintCells: (i, j) => [{ i, j }] },
})

test('skips animation updates when the entity container is hidden', () => {
  const entity = { visible: false, renderable: true, parent: null }
  const sprite = { playing: true, visible: true, renderable: true, destroyed: false, parent: entity, updates: 0 }
  const tick = bindSprite(sprite)

  tick()
  assert.equal(sprite.updates, 0)
  entity.visible = true
  tick()
  assert.equal(sprite.updates, 1)
})

test('keeps hidden gameplay animations running when they have callbacks', () => {
  const entity = { visible: false, renderable: true, parent: null }
  const sprite = {
    playing: true,
    visible: true,
    renderable: true,
    destroyed: false,
    parent: entity,
    onComplete: () => {},
    updates: 0,
  }
  const tick = bindSprite(sprite)

  tick()
  assert.equal(sprite.updates, 1)
})

test('renders an explored resource only while it is inside the camera', () => {
  let inCamera = false
  const resource = {
    family: 'resource',
    x: 0,
    y: 0,
    context: {
      map: { showResources: true, revealEverything: false, revealTerrain: false },
      player: {},
      controls: { instanceInCamera: () => inCamera },
    },
  }

  assert.equal(updateInstanceRenderVisibility(resource), false)
  assert.equal(resource.visible, false)
  inCamera = true
  assert.equal(updateInstanceRenderVisibility(resource), true)
  assert.equal(resource.visible, true)
})

test('culls a sprite-based entity by its full bounding box, not just its anchor point', () => {
  let receivedBounds
  const building = {
    family: 'building',
    x: 100,
    y: 200,
    sprite: { width: 80, height: 120, anchor: { x: 0.5, y: 1 } },
    context: {
      map: { revealEverything: true },
      player: {},
      controls: {
        instanceInCamera: (_instance, bounds) => {
          receivedBounds = bounds
          return true
        },
      },
    },
  }

  assert.equal(updateInstanceRenderVisibility(building), true)
  assert.equal(building.visible, true)
  assert.deepEqual(receivedBounds, { minX: 60, minY: 80, width: 80, height: 120 })
})
