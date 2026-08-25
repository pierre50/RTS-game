const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function loadLightSystem() {
  return loadTsModule('app/services/LightSystem.ts', {
    mocks: {
      'pixi.js': {
        Container: class Container {},
        Sprite: class Sprite {},
        Texture: class Texture {},
      },
      '../lib/grid/visibility': {
        getInstanceScreenBounds: () => ({ height: 32, width: 32, x: 0, y: 0 }),
      },
    },
  }).LightSystem
}

function createLightSystemHarness() {
  const LightSystem = loadLightSystem()
  const system = Object.create(LightSystem.prototype)
  system.context = {
    controls: {
      camera: { x: 0, y: 0 },
      getViewportMetrics: () => ({ visibleHeight: 720, visibleLeft: 0, visibleTop: 0, visibleWidth: 1280, zoom: 1 }),
      instanceInCamera: () => true,
    },
    map: { instanceBuckets: [[new Set()]] },
  }
  system.fadingLights = new Map()
  system.lightFadeRatios = new Map()
  system.lights = []
  system.previousLightFadeRatios = new Map()
  system.trackedLights = new Map()
  system.activeLightElapsedMs = null
  return system
}

function setVisibleInstances(system, instances) {
  system.context.map.instanceBuckets = [[new Set(instances)]]
}

function createUnit(overrides = {}) {
  return {
    family: 'unit',
    i: 4,
    j: 7,
    x: 320,
    y: 240,
    type: 'Villager',
    owner: { isPlayed: true },
    visible: true,
    ...overrides,
  }
}

test('played villagers carry a small implicit light', () => {
  const system = createLightSystemHarness()

  system.addEntityLights(createUnit(), 120, 80, 2, 1000)

  assert.equal(system.lights.length, 1)
  assert.equal(system.lights[0].x, 200)
  assert.equal(system.lights[0].y, 152)
  assert.equal(system.lights[0].radius, 105)
  assert.equal(system.lights[0].verticalScale, 0.7)
  assert.equal(system.lights[0].color, '255,192,111')
  assert.ok(system.lights[0].intensity > 0.77 && system.lights[0].intensity < 0.87)
})

test('sleeping outside villagers do not keep their lamp on', () => {
  const system = createLightSystemHarness()

  system.addEntityLights(
    createUnit({
      shelterState: { status: 'outside', reason: 'sleep', location: 'outside' },
    }),
    0,
    0,
    1,
    1000
  )

  assert.equal(system.lights.length, 0)
})

test('villager lamps fade out when villagers sleep outside', () => {
  const system = createLightSystemHarness()
  const villager = createUnit({ label: 'villager-1' })

  setVisibleInstances(system, [villager])
  system.updateLights(16)
  const activeIntensity = system.lights[0].intensity

  villager.shelterState = { status: 'outside', reason: 'sleep', location: 'outside' }
  system.updateLights(350)

  assert.equal(system.lights.length, 1)
  assert.ok(system.lights[0].intensity > 0)
  assert.ok(system.lights[0].intensity < activeIntensity)

  system.updateLights(1000)

  assert.equal(system.lights.length, 0)
  assert.equal(system.fadingLights.size, 0)
})

test('villager lamps fade in when villagers appear', () => {
  const system = createLightSystemHarness()
  const villager = createUnit({ label: 'villager-1' })

  setVisibleInstances(system, [villager])
  system.updateLights(16)
  const firstFrameIntensity = system.lights[0].intensity

  system.updateLights(250)

  assert.equal(system.lights.length, 1)
  assert.ok(firstFrameIntensity > 0)
  assert.ok(system.lights[0].intensity > firstFrameIntensity)
})

test('villager lamps fade out when villagers die', () => {
  const system = createLightSystemHarness()
  const villager = createUnit({ label: 'villager-1' })

  setVisibleInstances(system, [villager])
  system.updateLights(600)
  const activeIntensity = system.lights[0].intensity

  villager.isDead = true
  system.updateLights(350)

  assert.equal(system.lights.length, 1)
  assert.ok(system.lights[0].intensity > 0)
  assert.ok(system.lights[0].intensity < activeIntensity)

  system.updateLights(1000)

  assert.equal(system.lights.length, 0)
  assert.equal(system.fadingLights.size, 0)
})

test('villager lamps do not fade out after villagers enter shelter', () => {
  const system = createLightSystemHarness()
  const villager = createUnit({ label: 'villager-1' })

  setVisibleInstances(system, [villager])
  system.updateLights(16)

  villager.shelterState = { status: 'inside', reason: 'sleep', location: 'shelter' }
  villager.visible = false
  setVisibleInstances(system, [])
  system.updateLights(350)

  assert.equal(system.lights.length, 0)
  assert.equal(system.fadingLights.size, 0)
})

test('military units and non-played villagers do not get implicit light', () => {
  const system = createLightSystemHarness()

  system.addEntityLights(createUnit({ type: 'Fantassin' }), 0, 0, 1, 1000)
  system.addEntityLights(createUnit({ owner: { isPlayed: false } }), 0, 0, 1, 1000)

  assert.equal(system.lights.length, 0)
})
