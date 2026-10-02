const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function loadLightSystem() {
  return loadTsModule('app/services/lighting/LightSystem.ts', {
    mocks: {
      'pixi.js': {
        Container: class Container {},
        Sprite: class Sprite {},
        Texture: class Texture {},
      },
      '../../lib/grid/visibility': {
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

test('sleeping units do not emit attached light sources', () => {
  const system = createLightSystemHarness()

  system.addEntityLights(
    createUnit({
      sleepVisualState: 'sleeping',
      lightSource: { color: '#ffffff', intensity: 1, radius: 180 },
      children: [{ label: 'torch', lightSource: { color: '#ffaa55', intensity: 1, radius: 120 } }],
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
  system.updateLights(20)

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
  system.updateLights(20)

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
  system.updateLights(20)

  assert.equal(system.lights.length, 0)
  assert.equal(system.fadingLights.size, 0)
})

test('non-played villagers do not get implicit light', () => {
  const system = createLightSystemHarness()

  system.addEntityLights(createUnit({ owner: { isPlayed: false } }), 0, 0, 1, 1000)

  assert.equal(system.lights.length, 0)
})

test('lightning temporarily reduces rendered night darkness', () => {
  const system = createLightSystemHarness()
  system.currentDarkness = 1
  system.context.weather = { getLightningBrightness: () => 0.75 }

  assert.ok(system.getEffectiveDarkness() < 0.35)
})

test('lightning does not add darkness during daylight', () => {
  const system = createLightSystemHarness()
  system.currentDarkness = 0
  system.context.weather = { getLightningBrightness: () => 1 }

  assert.equal(system.getEffectiveDarkness(), 0)
})

test('active cave and building interiors stay dark during daylight and exterior lightning', () => {
  const system = createLightSystemHarness()
  system.currentDarkness = 0
  system.context.weather = { getLightningBrightness: () => 1 }
  system.context.map.spaces = new Map([
    ['cave', { id: 'cave', kind: 'interior' }],
    ['house', { id: 'house', kind: 'interior' }],
  ])
  for (const id of ['cave', 'house']) {
    system.context.map.activeSpaceId = id
    assert.equal(system.getEffectiveDarkness(), 1)
    assert.equal(system.currentDarkness, 0)
  }
  system.context.map.activeSpaceId = null
  assert.equal(system.getEffectiveDarkness(), 0)
})

test('leaving an interior restores the current outdoor dusk or night lighting', () => {
  const system = createLightSystemHarness()
  system.context.map.spaces = new Map([['room', { id: 'room', kind: 'interior' }]])
  for (const darkness of [0, 0.45, 1]) {
    system.context.map.activeSpaceId = 'room'
    system.currentDarkness = darkness
    assert.equal(system.getEffectiveDarkness(), 1)
    system.context.map.activeSpaceId = null
    assert.equal(system.getEffectiveDarkness(), darkness)
  }
})

test('standalone interior maps also use night lighting', () => {
  const system = createLightSystemHarness()
  system.currentDarkness = 0
  system.context.map.mapType = 'interior'
  assert.equal(system.getEffectiveDarkness(), 1)
})

test('refresh prepares interior darkness while the tutorial is paused, before the first render', () => {
  const system = createLightSystemHarness()
  system.context.paused = true
  system.context.map.spaces = new Map([['room', { id: 'room', kind: 'interior' }]])
  system.context.map.activeSpaceId = 'room'
  system.currentDarkness = 0
  system.getScreenRect = () => ({ x: 10, y: 20, width: 1280, height: 720 })
  const calls = []
  system.layer = { visible: false, position: { set: (x, y) => calls.push(['position', x, y]) } }
  system.resizeCanvas = rect => calls.push(['resize', rect.width, rect.height])
  system.updateLights = elapsed => calls.push(['lights', elapsed])
  system.draw = () => calls.push(['draw', system.getEffectiveDarkness()])

  system.refresh()

  assert.equal(system.layer.visible, true)
  assert.equal(system.currentDarkness, 0)
  assert.deepEqual(calls, [
    ['position', 10, 20],
    ['resize', 1280, 720],
    ['lights', 0],
    ['draw', 1],
  ])
  system.context.map.activeSpaceId = null
  system.refresh()
  assert.equal(system.layer.visible, false)
})

test('resizing the night overlay keeps it full-screen on the first frame after a zoom change', async () => {
  const { Sprite, Texture, TextureSource } = await import('pixi.js')
  const system = createLightSystemHarness()
  system.canvas = { width: 1946, height: 1536 }
  system.texture = new Texture({ source: new TextureSource({ width: 1946, height: 1536 }), dynamic: true })
  system.sprite = new Sprite(system.texture)
  try {
    for (const [width, height] of [
      [973, 768],
      [1946, 1536],
      [1297.5, 1024],
    ]) {
      system.resizeCanvas({ x: 0, y: 0, width, height })
      // Drawing uploads the canvas after sizing the sprite, as in the first reveal.
      system.texture.source.resize(system.canvas.width, system.canvas.height)
      assert.equal(system.texture.width, Math.ceil(width))
      assert.equal(system.texture.height, Math.ceil(height))
      assert.ok(Math.abs(system.sprite.width - width) < 0.000001)
      assert.ok(Math.abs(system.sprite.height - height) < 0.000001)
    }
  } finally {
    system.sprite.destroy()
    system.texture.destroy(true)
  }
})

test('light collection visits only camera buckets on a giant map and follows camera movement', () => {
  const system = createLightSystemHarness()
  const near = createUnit({ label: 'near' })
  const far = createUnit({ label: 'far', i: 4000, j: 4000 })
  let bucketReads = 0
  const empty = new Set()
  const buckets = new Proxy(new Array(938), {
    get(target, key) {
      if (key === 'length') return target.length
      const i = Number(key)
      assert.ok(Number.isInteger(i), 'must not iterate the whole bucket grid')
      return new Proxy(new Array(938), {
        get(column, jKey) {
          if (jKey === 'length') return column.length
          bucketReads++
          const j = Number(jKey)
          if (i === 0 && j === 0) return new Set([near])
          if (i === 500 && j === 500) return new Set([far])
          return empty
        },
      })
    },
  })
  system.context.map.instanceBuckets = buckets
  const visited = []
  system.addEntityLights = entity => visited.push(entity.label)
  system.updateLights(16)
  assert.deepEqual(visited, ['near'])
  assert.ok(bucketReads < 1000, `visited ${bucketReads} buckets`)

  visited.length = 0
  bucketReads = 0
  system.context.controls.getViewportMetrics = () => ({
    visibleLeft: -640,
    visibleTop: 127640,
    visibleWidth: 1280,
    visibleHeight: 720,
    zoom: 1,
  })
  system.updateLights(16)
  assert.deepEqual(visited, ['far'])
  assert.ok(bucketReads < 1000, `visited ${bucketReads} buckets after moving`)
})

test('light collection uses the active interior origin and ignores outside buckets', () => {
  const system = createLightSystemHarness()
  const unit = createUnit({ label: 'interior', spaceId: 'room' })
  system.context.map.activeSpaceId = 'room'
  system.context.map.spaces = new Map([
    [
      'room',
      {
        id: 'room',
        kind: 'interior',
        origin: { x: 50000, y: 80000 },
        instanceBuckets: [[new Set([unit])]],
      },
    ],
  ])
  system.context.controls.getViewportMetrics = () => ({
    visibleLeft: 50000,
    visibleTop: 80000,
    visibleWidth: 640,
    visibleHeight: 360,
    zoom: 2,
  })
  system.context.map.instanceBuckets = new Proxy([], {
    get() {
      throw new Error('outside queried')
    },
  })
  const visited = []
  system.addEntityLights = entity => visited.push(entity.label)
  system.updateLights(16)
  assert.deepEqual(visited, ['interior'])
})

test('lighting ticker runs once per frame when measurement returns undefined', () => {
  const previousDocument = global.document
  global.document = { createElement: () => ({ width: 1, height: 1 }) }
  try {
    const { LightSystem } = loadTsModule('app/services/lighting/LightSystem.ts', {
      mocks: {
        'pixi.js': {
          Container: class {
            position = { set() {} }
            addChild() {}
          },
          Sprite: class {},
          Texture: { from: () => ({ source: { resize() {} } }) },
        },
      },
    })
    for (const monitored of [false, true]) {
      let tick
      const context = {
        app: {
          ticker: {
            add: callback => {
              tick = callback
            },
          },
        },
        map: {},
        performance: monitored ? { measure: (_name, callback) => callback() } : undefined,
      }
      const system = new LightSystem(
        context,
        () => ({ x: 0, y: 0, width: 800, height: 600 }),
        () => 0
      )
      const updates = []
      system.update = ms => {
        updates.push(ms)
      }
      tick({ deltaMS: 16 })
      assert.deepEqual(updates, [16])
    }
  } finally {
    global.document = previousDocument
  }
})

test('player and AI infantry and bowmen reuse the villager lamp', () => {
  for (const type of ['Fantassin', 'Bowman']) {
    for (const owner of [{ isPlayed: true }, { type: 'AI', isPlayed: false }]) {
      const system = createLightSystemHarness()
      system.addEntityLights(createUnit({ type, owner }), 120, 80, 2, 1000)
      assert.equal(system.lights.length, 1)
      assert.equal(system.lights[0].radius, 105)
      assert.equal(system.lights[0].color, '255,192,111')
    }
  }
})

test('bandits, sleeping soldiers and soldiers outside the camera have no implicit lamp', () => {
  for (const overrides of [
    { type: 'BanditSword' },
    { type: 'BanditArcher' },
    { type: 'Fantassin', owner: { type: 'Bandits' } },
    { type: 'Bowman', owner: { type: 'AI', banditCampOwner: true } },
    { type: 'Fantassin', sleepVisualState: 'sleeping' },
    { type: 'Bowman', shelterState: { status: 'outside', reason: 'sleep', location: 'outside' } },
    { type: 'Fantassin', isDead: true },
  ]) {
    const system = createLightSystemHarness()
    system.addEntityLights(createUnit(overrides), 0, 0, 1, 1000)
    assert.equal(system.lights.length, 0, JSON.stringify(overrides))
  }
  const system = createLightSystemHarness()
  system.context.controls.instanceInCamera = () => false
  system.addEntityLights(createUnit({ type: 'Fantassin' }), 0, 0, 1, 1000)
  assert.equal(system.lights.length, 0)
})
