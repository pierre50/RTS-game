const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

test('completed buildings and construction ghosts initialize directly from their final texture', async () => {
  const pixi = await import('pixi.js')
  const texture = new pixi.Texture({
    source: new pixi.TextureSource({ width: 120, height: 100 }),
    defaultAnchor: { x: 0.45, y: 0.7 },
  })
  const ref = { sheet: 'buildings', frame: 10 }
  const ghosts = []
  const { createInitialBuildingSprite } = loadTsModule('app/classes/building/BuildingSetup.ts', {
    mocks: {
      'pixi.js': pixi,
      '../../lib/buildings/campConstruction': { assignCampBrazierAppearance: () => {} },
      './BuildingTrainingPreview': { BuildingTrainingPreview: class {} },
      './BuildingVisuals': { applyBuildingConstructionGhost: building => ghosts.push(building) },
      '../../lib': {
        getBuildingAsset: (type, owner) => {
          assert.equal(type, 'House')
          assert.equal(owner.level, 1)
          return { images: { final: ref }, mirrored: true }
        },
        getBuildingAssetOwner: building => ({ level: building.buildingLevel }),
        getTexture: value => {
          assert.equal(value, ref)
          return texture
        },
        textureRefToString: value => `${value.frame}_${value.sheet}`,
      },
    },
  })
  for (const isBuilt of [true, false]) {
    const building = { type: 'House', buildingLevel: 1, size: 2, isBuilt, reliefLift: -4, createShadow: () => null }
    createInitialBuildingSprite(building)
    assert.equal(building.sprite.texture, texture)
    assert.equal(building.textureName, '10_buildings')
    assert.equal(building.sprite.anchor.x, 0.45)
    assert.equal(building.sprite.anchor.y, 0.7)
    assert.equal(building.sprite.position.y, -4)
    assert.equal(ghosts.includes(building), !isBuilt)
    if (!isBuilt) assert.equal(building.sprite.scale.x, -1)
    building.sprite.destroy()
  }
})
