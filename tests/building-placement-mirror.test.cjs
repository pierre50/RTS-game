const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

test('saved placement mirror composes with asset orientation and survives texture refreshes', () => {
  let assetMirrored = false
  const { applyBuildingFinalTexture } = loadTsModule('app/classes/building/BuildingFinalTexture.ts', {
    mocks: {
      'pixi.js': { AnimatedSprite: class {}, Assets: { cache: { get: () => ({}) } }, Polygon: class {} },
      '../../constants': { LABEL_TYPES: { color: 'color' } },
      '../../lib': {
        getBuildingAsset: () => ({ images: { final: 'chest' }, mirrored: assetMirrored }),
        getBuildingAssetOwner: () => ({}),
        getTexture: () => ({ defaultAnchor: { x: 0.5, y: 0.6 } }),
        getTextureSheet: () => 'chest',
        textureRefToString: () => 'chest',
        changeSpriteColorDirectly() {},
      },
      '../../lib/buildings/walls': { isWall: () => false },
      './BuildingFire': { syncBuildingCampfireDecoration() {} },
      './BuildingVisuals': { clearBuildingConstructionReveal() {} },
    },
  })
  for (const placementMirrored of [true, false, undefined]) {
    const saved = JSON.parse(JSON.stringify({ placementMirrored }))
    const building = {
      ...saved,
      type: 'Chest',
      size: 1,
      owner: {},
      sprite: { scale: { x: 1 }, anchor: { set() {} } },
      getChildByLabel: () => null,
      updateShadow() {},
    }
    for (const mirrored of [false, true]) {
      assetMirrored = mirrored
      for (let refresh = 0; refresh < 2; refresh++) {
        applyBuildingFinalTexture(building)
        assert.equal(building.sprite.scale.x, mirrored !== Boolean(placementMirrored) ? -1 : 1)
      }
    }
  }
})
