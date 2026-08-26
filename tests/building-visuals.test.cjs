const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function loadBuildingVisuals() {
  class Texture {
    constructor(options = {}) {
      Object.assign(this, options)
      this.frame = options.frame || { x: 0, y: 0, width: 16, height: 16 }
      this.source = options.source || { width: 16, height: 16 }
    }
  }

  class Sprite {
    constructor(texture = new Texture()) {
      this.texture = texture
      this.anchor = {
        x: texture.defaultAnchor?.x ?? 0,
        y: texture.defaultAnchor?.y ?? 0,
        set: (x, y) => {
          this.anchor.x = x
          this.anchor.y = y
        },
      }
      this.scale = {
        x: 1,
        y: 1,
        set: (x, y = x) => {
          this.scale.x = x
          this.scale.y = y
        },
      }
      this.position = {
        x: 0,
        y: 0,
        set: (x, y) => {
          this.position.x = x
          this.position.y = y
        },
      }
      this.destroyed = false
    }

    destroy() {
      this.destroyed = true
    }
  }

  class AnimatedSprite extends Sprite {}
  class Rectangle {}

  return {
    ...loadTsModule('app/classes/building/BuildingVisuals.ts', {
      mocks: {
        'pixi.js': {
          AnimatedSprite,
          Assets: { cache: { has: () => false, get: () => null } },
          Rectangle,
          Sprite,
          Texture,
        },
        '../../constants': { LABEL_TYPES: { shadow: 'shadow' } },
        '../../lib': {
          bindAnimatedSpriteToTicker: () => {},
          getRallyPointFrames: () => [],
          getTextureByFrame: () => null,
          getTextureSheet: textureName => textureName,
          parseTextureRef: () => ({ frame: 0 }),
          RALLY_POINT_SHEET_ID: 'rally-point',
        },
        '../../lib/audio/settings': { getShadowsEnabled: () => true },
      },
    }),
    Texture,
  }
}

test('building sprite shadows can fall back to a flattened source sprite mask', () => {
  const { createBuildingShadow, Texture } = loadBuildingVisuals()
  const texture = new Texture()
  const building = {
    context: { map: { shadowLayer: { addChild: () => {} } } },
    isDead: false,
    isDestroyed: false,
    reliefLift: 0,
    shadow: null,
    sprite: {
      texture,
      anchor: { x: 0.5, y: 0.75 },
      scale: { x: 2, y: 3 },
    },
    textureName: 'buildings/deco',
    useSpriteShadow: true,
    visible: true,
    x: 100,
    y: 200,
  }

  const shadow = createBuildingShadow(building)

  assert.ok(shadow)
  assert.equal(shadow.texture, texture)
  assert.equal(shadow.tint, 0x000000)
  assert.equal(shadow.anchor.x, 0.5)
  assert.equal(shadow.anchor.y, 0.75)
  assert.equal(shadow.scale.x, 2.04)
  assert.equal(shadow.scale.y, -1.5)
  assert.equal(shadow.position.x, 100)
  assert.equal(shadow.position.y, 200)
})

test('buildings without a shadow atlas keep no shadow unless sprite fallback is enabled', () => {
  const { createBuildingShadow, Texture } = loadBuildingVisuals()
  const building = {
    context: { map: { shadowLayer: { addChild: () => {} } } },
    sprite: {
      texture: new Texture(),
      anchor: { x: 0.5, y: 0.75 },
      scale: { x: 1, y: 1 },
    },
    textureName: 'buildings/deco',
    visible: true,
    x: 0,
    y: 0,
  }

  assert.equal(createBuildingShadow(building), null)
})
