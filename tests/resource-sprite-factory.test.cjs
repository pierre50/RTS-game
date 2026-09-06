const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function loadResourceSpriteFactory() {
  class AnimatedSprite {
    constructor(textures) {
      this.textures = textures
      this.texture = textures[0]
      this.currentFrame = 0
      this.updateAnchor = false
      this.anchor = {
        x: textures[0].defaultAnchor.x,
        y: textures[0].defaultAnchor.y,
        copyFrom: anchor => {
          this.anchor.x = anchor.x
          this.anchor.y = anchor.y
        },
      }
    }

    gotoAndStop(frame) {
      this.currentFrame = frame
      this.texture = this.textures[frame]
      if (this.updateAnchor && this.texture.defaultAnchor) this.anchor.copyFrom(this.texture.defaultAnchor)
    }
  }

  class Sprite {
    constructor(texture = {}) {
      this.texture = texture
      this.anchor = {
        x: texture.defaultAnchor?.x ?? 0,
        y: texture.defaultAnchor?.y ?? 0,
        copyFrom: anchor => {
          this.anchor.x = anchor.x
          this.anchor.y = anchor.y
        },
        set: (x, y) => {
          this.anchor.x = x
          this.anchor.y = y
        },
      }
    }

    static from(texture) {
      return new Sprite(texture)
    }
  }

  const textures = [
    { defaultAnchor: { x: 0.25, y: 0.8 } },
    { defaultAnchor: { x: 0.5, y: 0.8 } },
    { defaultAnchor: { x: 0.75, y: 0.8 } },
  ]
  const Assets = {
    cache: {
      get: () => ({
        data: { animationSpeed: 0, loop: false },
        textures,
      }),
    },
  }

  const module = loadTsModule('app/classes/ResourceSpriteFactory.ts', {
    mocks: {
      'pixi.js': { AnimatedSprite, Assets, Polygon: class {}, Sprite },
      '../constants': {
        RESOURCE_TYPES: {
          berrybush: 'Berrybush',
          fiberPlant: 'FiberPlant',
          medicinalHerb: 'MedicinalHerb',
          toxicHerb: 'ToxicHerb',
          wheat: 'Wheat',
        },
        WILDGRASS_RESOURCE_TYPES: new Set(['MedicinalHerb', 'ToxicHerb', 'FiberPlant']),
      },
      '../lib': {
        bindAnimatedSpriteToTicker: () => {},
        getAnimationFrames: sourceTextures => sourceTextures,
        getTexture: () => ({ defaultAnchor: { x: 0.5, y: 0.5 } }),
        getTextureSheet: () => 'sheet',
        parseTextureRef: textureRef => textureRef,
        textureRefToString: () => 'texture',
      },
      './ResourceTexture': {
        getTerrainAssets: assets => assets,
        normalizeResourceTextureRef: textureRef => textureRef,
      },
    },
  })

  return module
}

test('mature wheat applies the mature frame anchor during sprite creation', () => {
  const { createResourceSprite } = loadResourceSpriteFactory()
  const resource = {
    assets: 'resources/wheat',
    context: { app: {}, map: {} },
    isAnimated: true,
    isWindAnimatedWheat: () => false,
    startWindMotion: () => {},
    type: 'Wheat',
  }

  const sprite = createResourceSprite(resource, { i: 1, j: 1, startsMature: true, type: 'Wheat' }, { type: 'Grass' })

  assert.equal(sprite.currentFrame, 2)
  assert.equal(sprite.anchor.x, 0.75)
  assert.equal(sprite.anchor.y, 0.8)
})

test('wildgrass static sprites anchor at their base for shadows and wind', () => {
  const { createResourceSprite } = loadResourceSpriteFactory()
  const resource = {
    assets: { sheet: 'resources/wildgrass', frame: 0 },
    context: { app: {}, map: {} },
    isAnimated: false,
    type: 'MedicinalHerb',
  }

  const sprite = createResourceSprite(resource, { i: 1, j: 1, type: 'MedicinalHerb' }, { type: 'Grass' })

  assert.equal(sprite.anchor.x, 0.5)
  assert.equal(sprite.anchor.y, 0.82)
})
