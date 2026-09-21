const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

test('generated building flames start the shared flame ambient loop', () => {
  const played = []
  const tickerCallbacks = []

  class MockContainer {
    constructor() {
      this.children = []
      this.label = ''
    }

    addChild(child) {
      this.children.push(child)
      return child
    }
  }

  class MockAnimatedSprite extends MockContainer {
    constructor(textures) {
      super()
      this.textures = textures
      this.position = { set: (x, y) => ((this.x = x), (this.y = y)) }
    }

    play() {
      this.playing = true
    }
  }

  const building = {
    type: 'Barracks',
    i: 4,
    j: 4,
    size: 2,
    isBuilt: true,
    isDead: false,
    isDestroyed: false,
    children: [],
    context: {
      app: {
        ticker: {
          add: callback => tickerCallbacks.push(callback),
          remove: () => {},
        },
      },
      controls: {
        heroUnit: { i: 4, j: 4 },
        instanceIsAudible: () => true,
      },
    },
    addChild(child) {
      this.children.push(child)
      return child
    },
    getChildByLabel(label) {
      return this.children.find(child => child.label === label) ?? null
    },
  }

  const { generateBuildingFire } = loadTsModule('app/classes/building/BuildingFire.ts', {
    mocks: {
      '@pixi/sound': {
        sound: {
          play: (cue, options) => {
            const loop = { stop: () => {}, volume: options.volume }
            played.push({ cue, options, loop })
            return loop
          },
        },
      },
      'pixi.js': {
        AnimatedSprite: MockAnimatedSprite,
        Assets: {
          cache: {
            get: () => ({ textures: { frame0: {} } }),
          },
        },
        Container: MockContainer,
      },
      '../../constants': {
        BUILDING_TYPES: { fireCamp: 'FireCamp' },
        LABEL_TYPES: { fire: 'fire' },
        SOUND_CUES: { building: { burning: 'burning', flame: 'flame' } },
      },
      '../../lib': {
        bindAnimatedSpriteToTicker: () => {},
        getAnimationFrames: textures => Object.values(textures),
        getBuildingFootprintRadius: () => 1,
        getHeroDistanceSoundVolume: () => 0.33,
        playAudibleSoundCue: () => null,
      },
    },
  })

  generateBuildingFire(building, 'light')

  assert.equal(played.length, 1)
  assert.equal(played[0].cue, 'flame')
  assert.equal(played[0].options.loop, true)
  assert.equal(building.flameSoundLoop.volume, 0.33)
  assert.equal(tickerCallbacks.length, 1)
})

test('stopping building flame ambient sound removes ticker and stops loop', () => {
  const calls = []
  const ticker = () => {}
  const loop = { stop: () => calls.push(['stop']), volume: 0.4 }
  const building = {
    context: {
      app: {
        ticker: {
          remove: callback => calls.push(['removeTicker', callback === ticker]),
        },
      },
    },
    flameSoundLoop: loop,
    flameSoundTicker: ticker,
    flameSoundStopped: false,
  }

  const { stopFlameAmbientSound } = loadTsModule('app/classes/building/BuildingFire.ts', {
    mocks: {
      '@pixi/sound': { sound: { play: () => loop } },
      'pixi.js': {
        AnimatedSprite: class {},
        Assets: { cache: { get: () => ({ textures: {} }) } },
        Container: class {},
      },
      '../../constants': {
        BUILDING_TYPES: { fireCamp: 'FireCamp' },
        LABEL_TYPES: { fire: 'fire' },
        SOUND_CUES: { building: { burning: 'burning', flame: 'flame' } },
      },
      '../../lib': {
        bindAnimatedSpriteToTicker: () => {},
        getAnimationFrames: () => [],
        getBuildingFootprintRadius: () => 0,
        getHeroDistanceSoundVolume: () => 0,
        playAudibleSoundCue: () => null,
      },
    },
  })

  stopFlameAmbientSound(building)

  assert.equal(building.flameSoundStopped, true)
  assert.equal(building.flameSoundTicker, null)
  assert.equal(building.flameSoundLoop, null)
  assert.deepEqual(calls, [['removeTicker', true], ['stop']])
})

for (const [type, y, scale, radius] of [
  ['FireCamp', -9, 1, 500],
  ['CampBrazier', -44, 0.65, 420],
  ['CampTorchStand', -33, 0.5, 220],
]) {
  test(`${type} has bowl-aligned animated flames and cleans up its ambient effect`, () => {
    const bound = []
    const loops = []
    const callbacks = new Set()
    class Sprite {
      constructor(textures) {
        this.textures = textures
        this.position = {
          set: (x, y) => {
            this.x = x
            this.y = y
          },
        }
        this.scale = {
          set: value => {
            this.scale.x = value
            this.scale.y = value
          },
        }
      }
      gotoAndPlay() {
        this.playing = true
      }
      destroy() {
        this.destroyed = true
      }
    }
    const { syncBuildingCampfireDecoration, CAMPFIRE_DECORATION_LABEL, CAMPFIRE_SMOKE_DECORATION_LABEL } = loadTsModule(
      'app/classes/building/BuildingFire.ts',
      {
        mocks: {
          'pixi.js': {
            AnimatedSprite: Sprite,
            Container: class {},
            Assets: {
              cache: {
                get: () => ({ textures: Object.fromEntries(Array.from({ length: 24 }, (_, i) => [i, { frame: i }])) }),
              },
            },
          },
          '@pixi/sound': {
            sound: {
              play: () => {
                const loop = {
                  volume: 0,
                  stop() {
                    this.stopped = true
                  },
                }
                loops.push(loop)
                return loop
              },
            },
          },
          '../../constants': {
            BUILDING_TYPES: { fireCamp: 'FireCamp', campBrazier: 'CampBrazier', campTorchStand: 'CampTorchStand' },
            LABEL_TYPES: { fire: 'fire' },
            SOUND_CUES: { building: { flame: 'flame' } },
          },
          '../../lib': {
            bindAnimatedSpriteToTicker: sprite => bound.push(sprite),
            getAnimationFrames: textures => Object.values(textures),
            getBuildingFootprintRadius: () => 0,
            getHeroDistanceSoundVolume: () => 0.2,
            playAudibleSoundCue: () => null,
          },
        },
      }
    )
    const building = {
      type,
      isBuilt: true,
      reliefLift: -16,
      children: [],
      context: {
        app: { ticker: { add: callback => callbacks.add(callback), remove: callback => callbacks.delete(callback) } },
        controls: { instanceIsAudible: () => true },
      },
      getChildByLabel(label) {
        return this.children.find(child => child.label === label && !child.destroyed)
      },
      addChild(child) {
        this.children.push(child)
      },
    }
    syncBuildingCampfireDecoration(building)
    const fire = building.getChildByLabel(CAMPFIRE_DECORATION_LABEL)
    const smoke = building.getChildByLabel(CAMPFIRE_SMOKE_DECORATION_LABEL)
    assert.equal(fire.y, y - 16)
    assert.equal(smoke.y, y - 16 + 25 * scale)
    assert.equal(fire.scale.x, scale)
    assert.equal(smoke.scale.x, scale)
    assert.equal(fire.lightSource.radius, radius)
    assert.equal(fire.playing, true)
    assert.equal(smoke.playing, true)
    assert.equal(fire.textures.length, 8)
    assert.equal(fire.eventMode, 'none')
    assert.deepEqual(bound, [smoke, fire])
    assert.equal(loops.length, 1)
    building.reliefLift = -32
    syncBuildingCampfireDecoration(building)
    assert.equal(building.children.length, 2)
    assert.equal(loops.length, 1)
    assert.equal(fire.y, y - 32)
    building.type = 'CampTable'
    syncBuildingCampfireDecoration(building)
    assert.equal(fire.destroyed, true)
    assert.equal(smoke.destroyed, true)
    assert.equal(loops[0].stopped, true)
    assert.equal(callbacks.size, 0)
  })
}
