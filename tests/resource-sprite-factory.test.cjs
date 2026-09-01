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
    static from(texture) {
      return { texture }
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
      '../constants': { RESOURCE_TYPES: { berrybush: 'Berrybush', wheat: 'Wheat' } },
      '../lib': {
        bindAnimatedSpriteToTicker: () => {},
        getAnimationFrames: sourceTextures => sourceTextures,
        getTexture: () => ({}),
        getTextureSheet: () => 'sheet',
        parseTextureRef: textureRef => textureRef,
        textureRefToString: () => 'texture',
      },
      './ResourceTexture': {
        getTerrainAssets: () => null,
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
