const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

test('animated final texture replaces the sprite inside the Pixi view container', async () => {
  const pixi = await import('pixi.js')
  const source = new pixi.TextureSource({ width: 64, height: 64 })
  const texture = new pixi.Texture({ source, defaultAnchor: { x: 0.5, y: 0.8 } })
  const frames = [texture, texture]
  const container = new pixi.Container()
  const oldSprite = new pixi.Sprite(texture)
  oldSprite.label = 'sprite'
  const marker = new pixi.Container()
  container.addChild(marker, oldSprite)
  let interactionsBound = 0
  const building = {
    type: 'Watchtower',
    size: 1,
    owner: {},
    sprite: oldSprite,
    displayObject: container,
    getChildByLabel: () => { throw new Error('building must not act as a container') },
    getChildIndex: () => { throw new Error('building must not act as a container') },
    removeChild: () => { throw new Error('building must not act as a container') },
    addChildAt: () => { throw new Error('building must not act as a container') },
    bindSpriteInteractions: () => { interactionsBound++ },
    updateShadow() {},
    context: { app: {} },
  }
  const { applyBuildingFinalTexture } = loadTsModule('app/rendering/pixi/PixiBuildingFinalTexture.ts', {
    mocks: {
      'pixi.js': {
        ...pixi,
        AnimatedSprite: class extends pixi.AnimatedSprite {
          constructor(textures) { super(textures, false) }
        },
        Assets: { cache: { get: () => ({ textures: {} }) } },
      },
      '../../constants': { LABEL_TYPES: { color: 'color' } },
      '../../lib': {
        bindAnimatedSpriteToTicker() {},
        changeSpriteColorDirectly() {},
        getAnimationFrames: () => frames,
        getBuildingAsset: () => ({ animated: true, images: { final: 'watchtower' } }),
        getBuildingAssetOwner: () => ({}),
        getTexture: () => texture,
        getTextureSheet: () => 'watchtower',
        textureRefToString: () => 'watchtower',
      },
      '../../lib/buildings/walls': { isWall: () => false },
      '../../classes/building/BuildingFire': { syncBuildingCampfireDecoration() {} },
      './PixiBuildingVisuals': { clearBuildingConstructionReveal() {} },
    },
  })

  applyBuildingFinalTexture(building)
  assert.ok(building.sprite instanceof pixi.AnimatedSprite)
  assert.equal(container.getChildIndex(building.sprite), 1)
  assert.equal(oldSprite.destroyed, true)
  assert.equal(interactionsBound, 1)
  container.destroy({ children: true, texture: false })
})
