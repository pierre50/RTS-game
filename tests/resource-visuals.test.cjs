const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')
const { requireFromTsFile } = require('./helpers/loadTsModule.cjs')

function loadResourceVisuals() {
  const filename = path.join(__dirname, '../app/classes/ResourceVisuals.ts')
  const source = fs.readFileSync(filename, 'utf8')
  const { code } = babel.transformSync(source, {
    filename,
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }], '@babel/preset-typescript'],
  })

  class Rectangle {
    constructor(x, y, width, height) {
      Object.assign(this, { x, y, width, height })
    }
  }

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
      this.skew = { x: 0 }
      this.destroyed = false
    }

    static from(texture) {
      return new Sprite(texture)
    }
  }

  class AnimatedSprite extends Sprite {
    constructor(textures = [new Texture()]) {
      super(textures[0])
      this.textures = textures
      this.currentFrame = 0
      this.animationSpeed = 0
      this.loop = false
      this.playing = false
    }

    gotoAndPlay(frame) {
      this.currentFrame = frame
      this.playing = true
    }

    gotoAndStop(frame) {
      this.currentFrame = frame
      this.playing = false
    }
  }

  const Assets = {
    cache: {
      has: () => false,
      get: () => null,
    },
  }

  const mocks = {
    'pixi.js': { AnimatedSprite, Assets, Rectangle, Sprite, Texture },
    '../lib': {
      bindAnimatedSpriteToTicker: () => {},
      getEntityMapPoint: resource => {
        const space = resource.context?.map?.spaces?.get?.(resource.spaceId ?? 'outside')
        const origin = space?.origin ?? { x: 0, y: 0 }
        return { x: origin.x + resource.x, y: origin.y + resource.y }
      },
      getTextureSheet: textureName => textureName.split('_').slice(1).join('_'),
      parseTextureRef: textureName => ({
        sheet: textureName.split('_').slice(1).join('_'),
        frame: Number(textureName.split('_')[0]),
      }),
      getTextureByFrame: (sheetId, frameIndex) => {
        const texture = Assets.cache.get(sheetId).textures[frameIndex]
        if (!texture) throw new Error(`missing frame ${frameIndex}`)
        return texture
      },
      isEntityInActiveMapSpace: resource =>
        (resource.context?.map?.activeSpaceId ?? 'outside') === (resource.spaceId ?? 'outside'),
    },
    '../constants': {
      LABEL_TYPES: { shadow: 'shadow' },
      RESOURCE_TYPES: { tree: 'Tree', berrybush: 'Berrybush', wheat: 'Wheat' },
    },
    '../lib/audio/settings': { getResourceWindAnimationEnabled: () => false, getShadowsEnabled: () => true },
  }

  const module = { exports: {} }
  const localRequire = request => (Object.hasOwn(mocks, request) ? mocks[request] : requireFromTsFile(request, filename, mocks))
  new Function('module', 'exports', 'require', code)(module, module.exports, localRequire)
  return { ...module.exports, AnimatedSprite, Assets, Sprite, Texture }
}

test('resource texture shadows use the matching spritesheet frame when metadata is available', () => {
  const { Assets, Texture, createShadow } = loadResourceVisuals()
  const expectedShadowTexture = new Texture({ defaultAnchor: { x: 0.5, y: 0.41 } })
  Assets.cache = {
    has: id => id === 'resources/minerals/shadow',
    get: id => (id === 'resources/minerals/shadow' ? { textures: { 5: expectedShadowTexture } } : null),
  }

  const resource = {
    context: { app: { ticker: { add: () => {}, remove: () => {} } } },
    i: 10,
    isDestroyed: false,
    j: 12,
    reliefLift: 0,
    shadow: null,
    sprite: {
      texture: new Texture(),
      anchor: { x: 0.5, y: 0.65 },
      scale: { x: 1, y: 1 },
    },
    textureName: '005_resources/minerals',
    type: 'Stone',
    usesTextureShadow: false,
    visible: true,
    windPhase: 0,
    windTick: null,
    windTime: 0,
    x: 100,
    y: 200,
  }

  const shadow = createShadow(resource)

  assert.equal(resource.usesTextureShadow, true)
  assert.equal(shadow.texture, expectedShadowTexture)
  assert.equal(shadow.anchor.x, 0.5)
  assert.equal(shadow.anchor.y, 0.41)
  assert.equal(shadow.position.x, 100)
  assert.equal(shadow.position.y, 200)
})

test('initial wheat growth frame does not render a generated resource shadow', () => {
  const { AnimatedSprite, Texture, createShadow, syncShadow } = loadResourceVisuals()
  const sprite = new AnimatedSprite([new Texture(), new Texture()])
  sprite.anchor = {
    x: 0.5,
    y: 0.8,
    set: (x, y) => {
      sprite.anchor.x = x
      sprite.anchor.y = y
    },
  }
  sprite.scale = {
    x: 1,
    y: 1,
    set: (x, y = x) => {
      sprite.scale.x = x
      sprite.scale.y = y
    },
  }
  sprite.currentFrame = 0

  const resource = {
    context: { app: { ticker: { add: () => {}, remove: () => {} } } },
    i: 10,
    isDestroyed: false,
    j: 12,
    reliefLift: 0,
    shadow: null,
    sprite,
    textureName: '000_resources/wheat',
    type: 'Wheat',
    usesTextureShadow: false,
    visible: true,
    windPhase: 0,
    windTick: null,
    windTime: 0,
    x: 100,
    y: 200,
  }

  const shadow = createShadow(resource)

  assert.equal(shadow.visible, false)

  sprite.currentFrame = 1
  resource.shadow = shadow
  syncShadow(resource)

  assert.equal(shadow.visible, true)
})
