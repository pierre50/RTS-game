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

  generateBuildingFire(building, 'effects/fire/light')

  assert.equal(played.length, 1)
  assert.equal(played[0].cue, 'flame')
  assert.equal(played[0].options.loop, true)
  assert.equal(building.flameSoundLoop.volume, 0.33)
  assert.equal(tickerCallbacks.length, 1)
})
