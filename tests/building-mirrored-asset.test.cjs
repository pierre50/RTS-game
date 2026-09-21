const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

test('mirrored building assets flip once before shadow generation and reset for normal assets', () => {
  const { getBuildingAsset } = loadTsModule('app/lib/graphics/assets.ts')
  const texture = { defaultAnchor: { x: 0.5, y: 0.6 } }
  const shadowScales = []
  const { applyBuildingFinalTexture } = loadTsModule('app/classes/building/BuildingFinalTexture.ts', {
    mocks: {
      'pixi.js': { AnimatedSprite: class {}, Assets: { cache: { get: () => ({}) } }, Polygon: class {} },
      '../../constants': { LABEL_TYPES: { color: 'color' } },
      '../../lib': {
        getBuildingAsset,
        getBuildingAssetOwner: () => ({ age: 0 }),
        getTexture: () => texture,
        getTextureSheet: () => 'buildings/deco',
        textureRefToString: () => '016_buildings/deco',
        changeSpriteColorDirectly: () => {},
      },
      '../../lib/buildings/walls': { isWall: () => false },
      './BuildingFire': { syncBuildingCampfireDecoration: () => {} },
      './BuildingVisuals': { clearBuildingConstructionReveal: () => {} },
    },
  })
  const building = {
    type: 'Chest',
    assetType: 'InteriorMirroredChest',
    size: 1,
    owner: {},
    sprite: { scale: { x: 1, y: 1 }, anchor: { set: () => {} } },
    getChildByLabel: () => null,
    updateShadow() {
      shadowScales.push(this.sprite.scale.x)
    },
  }
  applyBuildingFinalTexture(building)
  applyBuildingFinalTexture(building)
  assert.equal(building.sprite.scale.x, -1)
  assert.equal(building.sprite.scale.y, 1)
  building.assetType = undefined
  applyBuildingFinalTexture(building)
  assert.equal(building.sprite.scale.x, 1)
  assert.deepEqual(shadowScales, [-1, -1, 1])
})
