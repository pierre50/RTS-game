const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')
const { requireFromTsFile } = require('./helpers/loadTsModule.cjs')

function loadModule(relativePath, mocks = {}) {
  const filename = path.join(__dirname, '..', relativePath)
  const source = fs.readFileSync(filename, 'utf8')
  const { code } = babel.transformSync(source, {
    filename,
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }], '@babel/preset-typescript'],
  })
  const module = { exports: {} }
  const localRequire = request => (Object.hasOwn(mocks, request) ? mocks[request] : requireFromTsFile(request, filename, mocks))
  new Function('module', 'exports', 'require', code)(module, module.exports, localRequire)
  return module.exports
}

const { bindAnimatedSpriteToTicker } = loadModule('app/lib/entities/spriteTextures.ts', {
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
  '../units/insightDetection': { getInsightDetectionRange: (_instance, _target, range) => range },
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

test('hides exterior instances while a runtime interior space is active', () => {
  const unit = {
    owner: { isPlayed: true },
    x: 0,
    y: 0,
    context: {
      map: { activeSpaceId: 'interior:test', revealEverything: true },
      player: {},
      controls: { instanceInCamera: () => true },
    },
    syncShadow() {
      this.shadowSynced = true
    },
  }

  assert.equal(updateInstanceRenderVisibility(unit), false)
  assert.equal(unit.visible, false)
  assert.equal(unit.shadowSynced, true)
})

test('renders interior instances while their runtime space is active', () => {
  const unit = {
    owner: { isPlayed: true },
    spaceId: 'interior:test',
    x: 12,
    y: 24,
    context: {
      map: {
        activeSpaceId: 'interior:test',
        grid: [[]],
        revealEverything: true,
        size: 1,
        spaces: new Map([
          [
            'interior:test',
            {
              container: {},
              grid: [[]],
              id: 'interior:test',
              kind: 'interior',
              origin: { x: 400, y: 200 },
              size: 1,
            },
          ],
        ]),
      },
      player: {},
      controls: { instanceInCamera: () => true },
    },
    syncShadow() {
      this.shadowSynced = true
    },
  }

  assert.equal(updateInstanceRenderVisibility(unit), true)
  assert.equal(unit.visible, true)
  assert.equal(unit.shadowSynced, true)
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
