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
  return loadTsModule('app/services/WeatherSystem.ts', {
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
      '../constants': {
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
          },
        },
      },
      '../lib': {
        isGameplaySoundSuppressed: () => suppressed,
        playSoundCue: () => {},
      },
      '../lib/audio/nightAmbience': {
        getNightAmbienceTargetVolume: () => {
          if (failOnAmbience)
            throw new Error('night ambience should not be calculated while gameplay sound is suppressed')
          return 0
        },
        NIGHT_AMBIENCE_LERP_PER_SECOND: 1,
      },
      '../lib/audio/oceanAmbience': {
        getOceanAmbienceTargetVolume: () => {
          if (failOnAmbience)
            throw new Error('ocean ambience should not be calculated while gameplay sound is suppressed')
          return 0
        },
        OCEAN_AMBIENCE_LERP_PER_SECOND: 1,
      },
      './weather/WeatherProfiles': {
        AMBIENT_CROSSFADE_MID: 0.5,
        BIOME_WEATHER_PROFILES: {
          Temperate: { precipMultiplier: 1, veilMultiplier: 1, windMultiplier: 1 },
        },
        COLOR_LERP_PER_SECOND: 1,
        FIRST_SUNNY_MAX_SECONDS: 1,
        FIRST_SUNNY_MIN_SECONDS: 1,
        MAX_RAIN_DROPS: 0,
        MAX_SAND_GRAINS: 0,
        MAX_SNOW_FLAKES: 0,
        PARTICLE_TARGETS: { sunny: { rain: 0, sand: 0, snow: 0 } },
        RAIN_BASE_SLANT_RATIO: 0,
        RAIN_DRIFT_PER_SECOND: 0,
        RAIN_LERP_PER_SECOND: 1,
        RAIN_LOOP_MAX_VOLUME: 1,
        RAIN_TEXTURE_HEIGHT: 1,
        RAIN_WIND_SLANT_FACTOR: 0,
        SNOW_COLOR: 0,
        TARGET_FRAME_MS: 1000 / 60,
        VEIL_TARGETS: { sunny: 0 },
        WEATHER_COLORS: {
          sunny: {
            blue: 1,
            brightness: 1,
            contrast: 1,
            gamma: 1,
            green: 1,
            red: 1,
            saturation: 1,
          },
        },
        WIND_LERP_PER_SECOND: 1,
        WIND_LOOP_MAX_VOLUME: 1,
        WIND_TARGETS: { sunny: 0 },
      },
      './weather/WeatherUtils': {
        addParticleDrift: () => {},
        biomeKeyFromEnvironment: () => 'Temperate',
        clamp: (value, min, max) => Math.max(min, Math.min(max, value)),
        combineColor: () => ({
          blue: 1,
          brightness: 1,
          contrast: 1,
          gamma: 1,
          green: 1,
          red: 1,
          saturation: 1,
        }),
        crossfadeVolumes: () => ({ high: 0.5, low: 0.5 }),
        lerp: (current, target) => target,
        nextPhase: phase => phase,
        phaseDuration: () => 1,
        randomBetween: () => 0,
        randomDuration: () => 1,
        scaleParticleTarget: value => value,
        seconds: value => value * 1000,
      },
      './weather/WeatherParticles': {
        createRainTexture: () => ({ destroy() {} }),
        createSandTexture: () => ({ destroy() {} }),
        createSnowTexture: () => ({ destroy() {} }),
        Raindrop: MockParticle,
        SandGrain: MockParticle,
        Snowflake: MockParticle,
      },
      './weather/WeatherAudio': {
        startAmbientLoop: (_alias, onReady) => onReady({ stop() {}, volume: 0 }),
      },
      './weather/WeatherColorGrading': {
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
    nightLoop: { volume: 1 },
    oceanLoop: { volume: 1 },
  }
  const weather = {
    ...loops,
    colorGrading: { shouldRender: () => false },
    context: {},
    map: {},
    nightVolume: 0.4,
    oceanVolume: 0.7,
    rainIntensity: 1,
    windIntensity: 1,
  }

  WeatherSystem.prototype.updateAmbientSound.call(weather, 1)

  assert.equal(weather.nightVolume, 0)
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
    nightLoop: { volume: 1 },
    oceanLoop: { volume: 1 },
  }
  const weather = {
    ...loops,
    colorGrading: { shouldRender: () => true },
    context: { paused: true },
    map: {},
    nightVolume: 0.4,
    oceanVolume: 0.7,
    rainIntensity: 1,
    windIntensity: 1,
    updateAmbientSound: WeatherSystem.prototype.updateAmbientSound,
  }

  WeatherSystem.prototype.update.call(weather, 16.67)

  assert.equal(weather.nightVolume, 0)
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
    nightLoop: { volume: 1 },
    oceanLoop: { volume: 1 },
  }
  const weather = {
    ...loops,
    colorGrading: { shouldRender: () => false },
    context: {},
    map,
    nightVolume: 0.4,
    oceanVolume: 0.7,
    rainIntensity: 1,
    windIntensity: 1,
  }

  WeatherSystem.prototype.updateAmbientSound.call(weather, 1)

  assert.equal(weather.nightVolume, 0)
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
