const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

class MockContainer {
  constructor() {
    this.children = []
    this.filters = null
    this.position = {
      set: (x, y) => {
        this.x = x
        this.y = y
      },
    }
  }

  addChild(...children) {
    this.children.push(...children)
    for (const child of children) child.parent = this
    return children[0]
  }

  destroy() {
    this.destroyed = true
  }
}

class MockGraphics extends MockContainer {
  clear() {
    return this
  }

  fill() {
    return this
  }

  rect() {
    return this
  }
}

class MockParticleContainer extends MockContainer {
  addParticle(...particles) {
    return this.addChild(...particles)
  }
}

class MockAdjustmentFilter {
  constructor(options = {}) {
    Object.assign(this, options)
  }
}

class MockRectangle {
  constructor(x = 0, y = 0, width = 0, height = 0) {
    this.x = x
    this.y = y
    this.width = width
    this.height = height
  }
}

class MockParticle {
  constructor(options = {}) {
    Object.assign(this, options)
  }
}

function loadWeatherSystem({ failOnAmbience = false, suppressed = false } = {}) {
  return loadTsModule('app/services/weather/WeatherSystem.ts', {
    mocks: {
      '@pixi/sound': {
        sound: { play: () => ({ stop() {}, volume: 0 }) },
      },
      'pixi.js': {
        Container: MockContainer,
        Graphics: MockGraphics,
        ParticleContainer: MockParticleContainer,
        Rectangle: MockRectangle,
      },
      'pixi-filters': {
        AdjustmentFilter: MockAdjustmentFilter,
      },
      '../../constants': {
        FAMILY_TYPES: { cell: 'cell' },
        SOUND_CUES: {
          weather: {
            ocean: 'ocean',
            night: 'night',
            rainHeavy: 'rain-heavy',
            rainLight: 'rain-light',
            thunder: 'thunder',
            windHeavy: 'wind-heavy',
            windLight: 'wind-light',
            morning: 'morning',
          },
        },
      },
      '../../lib': {
        isGameplaySoundSuppressed: () => suppressed,
        playSoundCue: () => {},
      },
      '../../lib/audio/nightAmbience': {
        getNightAmbienceTargetVolume: () => {
          if (failOnAmbience)
            throw new Error('night ambience should not be calculated while gameplay sound is suppressed')
          return 0
        },
        NIGHT_AMBIENCE_LERP_PER_SECOND: 1,
      },
      '../../lib/audio/morningAmbience': {
        duckNightAmbienceForMorning: (_morningVolume, nightVolume) => nightVolume,
        getMorningAmbienceTargetVolume: () => {
          if (failOnAmbience)
            throw new Error('morning ambience should not be calculated while gameplay sound is suppressed')
          return 0
        },
        MORNING_AMBIENCE_LERP_PER_SECOND: 1,
      },
      '../../lib/audio/oceanAmbience': {
        getOceanAmbienceTargetVolume: () => {
          if (failOnAmbience)
            throw new Error('ocean ambience should not be calculated while gameplay sound is suppressed')
          return 0
        },
        OCEAN_AMBIENCE_LERP_PER_SECOND: 1,
      },
      './WeatherProfiles': loadTsModule('app/services/weather/WeatherProfiles.ts'),
      './WeatherUtils': loadTsModule('app/services/weather/WeatherUtils.ts'),
      './WeatherParticles': {
        createRainTexture: () => ({ destroy() {} }),
        createSandTexture: () => ({ destroy() {} }),
        createSnowTexture: () => ({ destroy() {} }),
        Raindrop: MockParticle,
        SandGrain: MockParticle,
        Snowflake: MockParticle,
      },
      './WeatherAudio': {
        startAmbientLoop: (_alias, onReady) => onReady({ stop() {}, volume: 0 }),
      },
      './WeatherColorGrading': {
        WeatherColorGrading: loadTsModule('app/services/weather/WeatherColorGrading.ts', {
          mocks: {
            'pixi.js': { Container: MockContainer, Rectangle: MockRectangle },
            '../../lib/mapSpaces': {
              getActiveMapSpace: map => map.activeMapSpace ?? map.spaces?.get(map.activeSpaceId) ?? null,
            },
          },
        }).WeatherColorGrading,
      },
    },
  }).WeatherSystem
}

function createCell(i = 0, j = 0) {
  return { i, j, has: null, solid: false }
}

function createMap(extra = {}) {
  const map = new MockContainer()
  map.grid = [[createCell()]]
  map.size = 0
  map.x = 0
  map.y = 0
  map.instantMode = false
  map.revealEverything = true
  map.revealTerrain = true
  map.startingResources = {}
  map.resources = new Set()
  map.spaces = new Map()
  map.random = () => 0.5
  map.randomRange = () => 0
  map.randomItem = items => items[0]
  map.invalidateReliefCoastDistances = () => {}
  map.setCoordinate = () => {}
  map.addToInstanceBucket = () => {}
  map.removeFromInstanceBucket = () => {}
  map.updateInstanceBucket = () => {}
  Object.assign(map, extra)
  return map
}

function createContext(map, viewport = { visibleLeft: 0, visibleTop: 0, visibleWidth: 800, visibleHeight: 600 }) {
  return {
    app: {
      ticker: {
        add() {},
        remove() {},
      },
    },
    controls: {
      heroUnit: null,
      getViewportMetrics: () => viewport,
    },
    dayNight: {
      getColorAdjustment: () => ({
        blue: 1,
        brightness: 1,
        contrast: 1,
        gamma: 1,
        green: 1,
        red: 1,
        saturation: 1,
      }),
      getDarknessLevel: () => 0,
    },
    map,
  }
}

test('weather ambient loops are silenced while gameplay sound is suppressed', () => {
  const WeatherSystem = loadWeatherSystem({ failOnAmbience: true, suppressed: true })
  const loops = {
    rainLoopLight: { volume: 1 },
    rainLoopHeavy: { volume: 1 },
    windLoopLight: { volume: 1 },
    windLoopHeavy: { volume: 1 },
    morningLoop: { volume: 1 },
    nightLoop: { volume: 1 },
    oceanLoop: { volume: 1 },
  }
  const weather = {
    ...loops,
    colorGrading: { shouldRender: () => false },
    context: {},
    map: {},
    morningVolume: 0.2,
    nightVolume: 0.4,
    oceanVolume: 0.7,
    rainIntensity: 1,
    windIntensity: 1,
  }

  WeatherSystem.prototype.updateAmbientSound.call(weather, 1)

  assert.equal(weather.nightVolume, 0)
  assert.equal(weather.morningVolume, 0)
  assert.equal(weather.oceanVolume, 0)
  for (const loop of Object.values(loops)) {
    assert.equal(loop.volume, 0)
  }
})

test('weather ambient loops are silenced while the game is paused', () => {
  const WeatherSystem = loadWeatherSystem({ failOnAmbience: true })
  const loops = {
    rainLoopLight: { volume: 1 },
    rainLoopHeavy: { volume: 1 },
    windLoopLight: { volume: 1 },
    windLoopHeavy: { volume: 1 },
    morningLoop: { volume: 1 },
    nightLoop: { volume: 1 },
    oceanLoop: { volume: 1 },
  }
  const weather = {
    ...loops,
    colorGrading: { shouldRender: () => true },
    context: { paused: true },
    map: {},
    morningVolume: 0.2,
    nightVolume: 0.4,
    oceanVolume: 0.7,
    rainIntensity: 1,
    windIntensity: 1,
    updateAmbientSound: WeatherSystem.prototype.updateAmbientSound,
  }

  WeatherSystem.prototype.update.call(weather, 16.67)

  assert.equal(weather.nightVolume, 0)
  assert.equal(weather.morningVolume, 0)
  assert.equal(weather.oceanVolume, 0)
  for (const loop of Object.values(loops)) {
    assert.equal(loop.volume, 0)
  }
})

test('weather ambient loops are silenced while a runtime interior is active', () => {
  const WeatherSystem = loadWeatherSystem({ failOnAmbience: true })
  const map = createMap({
    activeSpaceId: 'interior:test',
    spaces: new Map([
      [
        'interior:test',
        {
          id: 'interior:test',
          kind: 'interior',
          grid: [[createCell()]],
          size: 0,
          container: new MockContainer(),
          origin: { x: 0, y: 0 },
        },
      ],
    ]),
  })
  const loops = {
    rainLoopLight: { volume: 1 },
    rainLoopHeavy: { volume: 1 },
    windLoopLight: { volume: 1 },
    windLoopHeavy: { volume: 1 },
    morningLoop: { volume: 1 },
    nightLoop: { volume: 1 },
    oceanLoop: { volume: 1 },
  }
  const weather = {
    ...loops,
    colorGrading: { shouldRender: () => false },
    context: {},
    map,
    morningVolume: 0.2,
    nightVolume: 0.4,
    oceanVolume: 0.7,
    rainIntensity: 1,
    windIntensity: 1,
  }

  WeatherSystem.prototype.updateAmbientSound.call(weather, 1)

  assert.equal(weather.nightVolume, 0)
  assert.equal(weather.morningVolume, 0)
  assert.equal(weather.oceanVolume, 0)
  for (const loop of Object.values(loops)) {
    assert.equal(loop.volume, 0)
  }
})

test('weather color grading targets the exterior map without per-entity filters', () => {
  const WeatherSystem = loadWeatherSystem()
  const existingMapFilter = { name: 'existing-map-filter' }
  const existingFilterArea = { name: 'existing-filter-area' }
  const terrainChunk = new MockContainer()
  terrainChunk.label = 'terrainChunk'
  const terrainLayer = new MockContainer()
  terrainLayer.label = 'streamedTerrain'
  const building = new MockContainer()
  building.label = 'TownCenter'
  const map = createMap({
    children: [building],
    filters: [existingMapFilter],
    filterArea: existingFilterArea,
    renderChunks: [{ displayObjects: [terrainChunk, building] }],
    terrainChunkManager: { terrainLayer },
  })
  const weather = new WeatherSystem(
    createContext(map, { visibleLeft: 24, visibleTop: 48, visibleWidth: 640, visibleHeight: 360 }),
    map,
    () => ({ height: 600, width: 800, x: 0, y: 0 })
  )

  assert.deepEqual(map.filters, [existingMapFilter, weather.tintFilter])
  assert.deepEqual(
    {
      height: map.filterArea.height,
      width: map.filterArea.width,
      x: map.filterArea.x,
      y: map.filterArea.y,
    },
    { height: 360, width: 640, x: 24, y: 48 }
  )
  assert.equal(terrainChunk.filters, null)
  assert.equal(terrainLayer.filters, null)
  assert.equal(building.filters, null)

  weather.destroy()

  assert.equal(terrainChunk.filters, null)
  assert.equal(terrainLayer.filters, null)
  assert.deepEqual(map.filters, [existingMapFilter])
  assert.equal(map.filterArea, existingFilterArea)
})

test('weather visuals and exterior map grading pause while a runtime interior is active', () => {
  const WeatherSystem = loadWeatherSystem()
  const terrainChunk = new MockContainer()
  terrainChunk.label = 'terrainChunk'
  const map = createMap({
    renderChunks: [{ displayObjects: [terrainChunk] }],
  })
  const weather = new WeatherSystem(createContext(map), map, () => ({ height: 600, width: 800, x: 0, y: 0 }))
  assert.deepEqual(map.filters, [weather.tintFilter])
  assert.equal(terrainChunk.filters, null)

  map.activeSpaceId = 'interior:test'
  map.spaces.set('interior:test', {
    id: 'interior:test',
    kind: 'interior',
    grid: map.grid,
    size: 0,
    container: new MockContainer(),
    origin: { x: 0, y: 0 },
  })
  weather.update(16)

  assert.equal(weather.layer.visible, false)
  assert.equal(map.filters, null)
  assert.equal(map.filterArea, undefined)
  assert.equal(terrainChunk.filters, null)
})

test('daily weather survives saving and follows world time while cosmetics are suppressed', () => {
  const WeatherSystem = loadWeatherSystem({ suppressed: true })
  const { DailyWeatherSchedule } = loadTsModule('app/services/weather/DailyWeatherSchedule.ts')
  const map = createMap()
  const context = createContext(map)
  let worldMs = 0
  context.dayNight.getElapsedMs = () => worldMs
  context.timeSkip = { suppressCosmetics: true }
  const weather = new WeatherSystem(context, map, () => ({ height: 600, width: 800, x: 0, y: 0 }))
  weather.applyState({ dailyWeatherSeed: 3 })
  assert.equal(weather.phase, 'clouding')
  const { DAY_NIGHT_CONFIG } = loadTsModule('app/config/gameplay.ts')
  worldMs = (10 - DAY_NIGHT_CONFIG.startHour) * DAY_NIGHT_CONFIG.dayLengthMs / DAY_NIGHT_CONFIG.hoursPerDay // 10:00.
  weather.update(1000)
  assert.equal(weather.elapsedMs, worldMs)
  assert.equal(weather.phase, 'rainLight')
  assert.ok(weather.rainIntensity > 0.25)
  assert.equal(weather.layer.visible, false)
  const saved = JSON.parse(JSON.stringify(weather.serializeState()))
  const restored = new WeatherSystem(context, map, () => ({ height: 600, width: 800, x: 0, y: 0 }))
  restored.applyState(saved)
  assert.deepEqual(restored.serializeState(), saved)
  const schedule = new DailyWeatherSchedule(saved.dailyWeatherSeed, 'Temperate')
  for (const target of [8 * 60000, 25 * 60000, 4 * 24 * 60000]) {
    worldMs = target
    weather.update(1000)
    restored.update(1000)
    assert.equal(restored.phase, schedule.sample(worldMs).phase)
    assert.equal(restored.phaseEndsAt, weather.phaseEndsAt)
    assert.equal(restored.rainIntensity, weather.rainIntensity)
  }
  weather.destroy()
  restored.destroy()
})

test('legacy saves adopt the daily plan and debug overrides expire back into it', () => {
  const WeatherSystem = loadWeatherSystem()
  const map = createMap()
  const context = createContext(map)
  let worldMs = 0
  context.dayNight.getElapsedMs = () => worldMs
  const weather = new WeatherSystem(
    context,
    map,
    () => ({ height: 600, width: 800, x: 0, y: 0 }),
    () => 0
  )
  weather.applyState({ dailyWeatherSeed: 5 })
  weather.applyState({ phase: 'rainHeavy', elapsedMs: 5000, phaseEndsAt: 5100 })
  assert.equal(weather.phase, 'sunny')
  assert.equal(weather.elapsedMs, worldMs)
  weather.forcePhase('rainHeavy')
  worldMs = 16
  weather.update(16)
  assert.equal(weather.phase, 'rainHeavy')
  assert.ok(weather.rainIntensity < 0.01)
  assert.ok(weather.currentColor.brightness > 0.99)
  assert.ok(weather.veilIntensity < 0.001)
  worldMs = 3 * 60000
  weather.update(1000)
  assert.equal(weather.phase, 'sunny')
  assert.ok(weather.rainIntensity < 0.001)
  weather.destroy()
})

test('arrival refresh prepares weather at the final viewport while paused without advancing simulation', () => {
  const WeatherSystem = loadWeatherSystem({ failOnAmbience: true })
  for (const [phase, rain, snow, sand] of [
    ['rainHeavy', 0.9, 0, 0],
    ['snow', 0, 0.8, 0],
    ['sandstorm', 0, 0, 0.8],
    ['sunny', 0, 0, 0],
  ]) {
    const map = createMap()
    const viewport = { visibleLeft: 0, visibleTop: 0, visibleWidth: 800, visibleHeight: 600 }
    let screen = { x: 0, y: 0, width: 800, height: 600 }
    const context = createContext(map, viewport)
    const weather = new WeatherSystem(context, map, () => screen)
    weather.applyState({ phase, forcedUntilMs: 100000, rainIntensity: rain, snowIntensity: snow, sandIntensity: sand })
    context.paused = true
    screen = { x: -100, y: -75, width: 1000, height: 750 }
    Object.assign(viewport, { visibleLeft: 3200, visibleTop: 1800, visibleWidth: 1000, visibleHeight: 750 })
    map.x = -3300
    map.y = -1875
    const veilRects = []
    weather.rainVeil.rect = (...args) => { veilRects.push(args); return weather.rainVeil }
    const stateBefore = weather.serializeState()

    weather.refresh()

    assert.deepEqual(weather.serializeState(), stateBefore)
    assert.equal(weather.layer.visible, true)
    assert.equal(weather.layer.x, screen.x)
    assert.equal(weather.layer.y, screen.y)
    assert.equal(map.filterArea.x, viewport.visibleLeft)
    assert.equal(map.filterArea.y, viewport.visibleTop)
    assert.equal(map.filterArea.width, screen.width)
    assert.equal(map.filterArea.height, screen.height)
    assert.equal(weather.lastMapX, map.x)
    assert.equal(weather.lastMapY, map.y)
    assert.equal(weather.raindrops.some(drop => drop.alpha > 0), rain > 0)
    assert.equal(weather.snowflakes.some(flake => flake.alpha > 0), snow > 0)
    assert.equal(weather.sandGrains.some(grain => grain.alpha > 0), sand > 0)
    if (veilRects.length) assert.deepEqual(veilRects[0], [0, 0, screen.width, screen.height])
    weather.destroy()
  }
})
