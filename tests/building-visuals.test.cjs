const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function loadBuildingVisuals() {
  const calls = []
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
        copyFrom: other => {
          this.scale.x = other.x
          this.scale.y = other.y
        },
        set: (x, y = x) => {
          this.scale.x = x
          this.scale.y = y
        },
      }
      this.position = {
        x: 0,
        y: 0,
        copyFrom: other => {
          this.position.x = other.x
          this.position.y = other.y
        },
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
  class Graphics {
    clear() {
      return this
    }

    rect(x, y, width, height) {
      this.lastRect = { x, y, width, height }
      return this
    }

    fill(options) {
      this.lastFill = options
      return this
    }

    destroy() {
      this.destroyed = true
    }
  }
  class Rectangle {}
  class ColorOverlayFilter {
    constructor(options) {
      Object.assign(this, options)
    }
  }
  class OutlineFilter {
    constructor(options) {
      this.options = options
    }
  }

  return {
    ...loadTsModule('app/classes/building/BuildingVisuals.ts', {
      mocks: {
        'pixi.js': {
          AnimatedSprite,
          Assets: { cache: { has: () => false, get: () => null } },
          Graphics,
          Rectangle,
          Sprite,
          Texture,
        },
        'pixi-filters': { ColorOverlayFilter, OutlineFilter },
        '../../constants': { LABEL_TYPES: { shadow: 'shadow' } },
        '../../lib': {
          bindAnimatedSpriteToTicker: () => {},
          changeSpriteColorDirectly: (sprite, color) => calls.push(['changeSpriteColorDirectly', sprite, color]),
          getEntityMapPoint: building => {
            const space = building.context?.map?.spaces?.get?.(building.spaceId ?? 'outside')
            const origin = space?.origin ?? { x: 0, y: 0 }
            return { x: origin.x + building.x, y: origin.y + building.y }
          },
          getHexColor: color => (color === 'red' ? '#e30b00' : '#ffffff'),
          getRallyPointFrames: () => [],
          getTextureByFrame: () => null,
          getTextureSheet: textureName => textureName,
          isEntityInActiveMapSpace: building =>
            (building.context?.map?.activeSpaceId ?? 'outside') === (building.spaceId ?? 'outside'),
          parseTextureRef: () => ({ frame: 0 }),
          RALLY_POINT_SHEET_ID: 'rally-point',
        },
        '../../lib/audio/settings': { getShadowsEnabled: () => true },
      },
    }),
    calls,
    Texture,
  }
}

test('construction reveal sprite is recolored to the building owner color', () => {
  const { calls, syncBuildingConstructionReveal, Texture } = loadBuildingVisuals()
  const texture = new Texture({
    defaultAnchor: { x: 0.5, y: 0.8 },
    frame: { x: 0, y: 0, width: 64, height: 96 },
  })
  const children = []
  const building = {
    addChild: child => children.push(child),
    constructionGhostBorder: null,
    constructionRevealMask: null,
    constructionRevealSprite: null,
    owner: { color: 'red' },
    sprite: {
      alpha: 1,
      tint: 0xffffff,
      texture,
      anchor: { x: 0.5, y: 0.8 },
      position: {
        x: 4,
        y: -6,
        copyFrom(other) {
          this.x = other.x
          this.y = other.y
        },
      },
      scale: {
        x: 1,
        y: 1,
        copyFrom(other) {
          this.x = other.x
          this.y = other.y
        },
      },
      roundPixels: true,
    },
  }

  syncBuildingConstructionReveal(building, 50)

  assert.ok(building.constructionRevealSprite)
  assert.deepEqual(
    calls.filter(call => call[0] === 'changeSpriteColorDirectly' && call[1] === building.constructionRevealSprite),
    [['changeSpriteColorDirectly', building.constructionRevealSprite, 'red']]
  )
  assert.equal(building.constructionRevealSprite.texture, texture)
  assert.equal(building.constructionRevealSprite.mask, building.constructionRevealMask)
  assert.equal(children.includes(building.constructionRevealSprite), true)
  assert.equal(children.includes(building.constructionRevealMask), true)
})

test('construction ghost keeps the player-colored texture transparent', () => {
  const { calls, applyBuildingConstructionGhost, Texture } = loadBuildingVisuals()
  const sourceTexture = new Texture()
  const children = []
  const building = {
    addChild: child => children.push(child),
    constructionGhostBorder: null,
    owner: { color: 'red' },
    sprite: {
      anchor: { x: 0.5, y: 0.8 },
      alpha: 1,
      position: { x: 4, y: -6 },
      scale: { x: 1, y: 1 },
      tint: 0x9f9888,
      texture: sourceTexture,
    },
  }

  applyBuildingConstructionGhost(building)
  const ghostTexture = building.sprite.texture
  applyBuildingConstructionGhost(building)

  assert.equal(building.sprite.alpha, 0.42)
  assert.equal(building.sprite.tint, 0xffffff)
  assert.equal(building.sprite.texture, ghostTexture)
  assert.equal(building.sprite.filters.length, 1)
  assert.equal(building.sprite.filters[0].color, 0xe30b00)
  assert.equal(building.sprite.filters[0].alpha, 0.58)
  assert.ok(building.constructionGhostBorder)
  assert.equal(children.includes(building.constructionGhostBorder), true)
  assert.equal(building.constructionGhostBorder.texture, sourceTexture)
  assert.equal(building.constructionGhostBorder.anchor.x, 0.5)
  assert.equal(building.constructionGhostBorder.anchor.y, 0.8)
  assert.deepEqual(building.constructionGhostBorder.filters[0].options, {
    color: 0xffd25a,
    alpha: 0.82,
    knockout: true,
    quality: 0.18,
    thickness: 3,
  })
  const recolorCalls = calls.filter(call => call[0] === 'changeSpriteColorDirectly')
  assert.equal(recolorCalls.length, 1)
  assert.equal(recolorCalls[0][1].texture, sourceTexture)
  assert.equal(recolorCalls[0][2], 'red')
})

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

test('building shadows only render in the active map space', () => {
  const { createBuildingShadow, updateBuildingShadow, Texture } = loadBuildingVisuals()
  const texture = new Texture()
  const building = {
    context: { map: { activeSpaceId: null, shadowLayer: { addChild: () => {} } } },
    isBuilt: true,
    isDead: false,
    isDestroyed: false,
    reliefLift: 0,
    shadow: null,
    spaceId: 'interior:test',
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
  assert.equal(shadow.visible, false)
  building.context.map.activeSpaceId = 'interior:test'
  updateBuildingShadow(building, shadow)
  assert.equal(shadow.visible, true)
})

test('building shadows use runtime map-space coordinates', () => {
  const { createBuildingShadow, Texture } = loadBuildingVisuals()
  const texture = new Texture()
  const building = {
    context: {
      map: {
        activeSpaceId: 'interior:test',
        shadowLayer: { addChild: () => {} },
        spaces: new Map([['interior:test', { id: 'interior:test', origin: { x: 300, y: 120 } }]]),
      },
    },
    isDead: false,
    isDestroyed: false,
    reliefLift: -4,
    shadow: null,
    spaceId: 'interior:test',
    sprite: {
      texture,
      anchor: { x: 0.5, y: 0.75 },
      scale: { x: 1, y: 1 },
    },
    textureName: 'buildings/deco',
    useSpriteShadow: true,
    visible: true,
    x: 20,
    y: 40,
  }

  const shadow = createBuildingShadow(building)

  assert.equal(shadow.position.x, 320)
  assert.equal(shadow.position.y, 156)
})

test('building sprite shadow fallback can use a dedicated ground anchor', () => {
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
      anchor: { x: 0.5, y: 0.3 },
      scale: { x: 1, y: 1 },
    },
    spriteShadowAnchor: { y: 0.78 },
    textureName: 'buildings/deco',
    useSpriteShadow: true,
    visible: true,
    x: 100,
    y: 200,
  }

  const shadow = createBuildingShadow(building)

  assert.ok(shadow)
  assert.equal(shadow.anchor.x, 0.5)
  assert.equal(shadow.anchor.y, 0.78)
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
