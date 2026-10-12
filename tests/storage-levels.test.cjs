const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { getStorageCapacity } = loadTsModule('app/lib/resources/storagePolicy.ts')
const { depotRemainingCapacity } = loadTsModule('app/services/world/work/OfflineWorkResources.ts')
const { completeBuildingUpgrade } = loadTsModule('app/lib/buildings/buildingUpgrade.ts')

test('storage capacities follow saved levels and keep other buildings unchanged', () => {
  for (const type of ['StoragePit', 'Granary']) {
    assert.equal(getStorageCapacity(type), 300)
    for (const buildingLevel of [0, 1, 2]) {
      const building = JSON.parse(JSON.stringify({ type, buildingLevel, inventory: { resources: { wood: 250 } } }))
      assert.equal(
        getStorageCapacity(building),
        type === 'StoragePit' ? [300, 900, 900][buildingLevel] : 300 * (buildingLevel + 1)
      )
      assert.equal(
        depotRemainingCapacity(building),
        (type === 'StoragePit' ? [300, 900, 900][buildingLevel] : 300 * (buildingLevel + 1)) - 250
      )
    }
    assert.equal(getStorageCapacity({ type, assetLevel: 2 }), 900)
    assert.equal(getStorageCapacity({ type, buildingLevel: 0, assetLevel: 2 }), 300)
    assert.equal(getStorageCapacity({ type, buildingLevel: -1 }), 300)
    assert.equal(getStorageCapacity({ type, buildingLevel: 99 }), 900)
  }
  assert.equal(getStorageCapacity({ type: 'TownCenter', buildingLevel: 2 }), 300)
  assert.equal(getStorageCapacity({ type: 'Chest', buildingLevel: 2 }), 100)
})

test('extra storage becomes available only when the upgrade finishes', () => {
  const definitions = require('../public/assets/data/gameplay/buildings.json')
  for (const type of ['StoragePit', 'Granary']) {
    const building = { type, buildingLevel: 0, inventory: { resources: { wood: 280 } } }
    for (const targetLevel of type === 'StoragePit' ? [1] : [1, 2]) {
      building.buildingUpgrade = { targetLevel, constructionProgress: 0.99 }
      assert.equal(completeBuildingUpgrade(building, definitions[type]), false)
      assert.equal(getStorageCapacity(building), 300 * targetLevel)
      building.buildingUpgrade.constructionProgress = 1
      assert.equal(completeBuildingUpgrade(building, definitions[type]), true)
      assert.equal(getStorageCapacity(building), type === 'StoragePit' ? 900 : 300 * (targetLevel + 1))
      assert.equal(building.inventory.resources.wood, 280)
    }
  }
})
