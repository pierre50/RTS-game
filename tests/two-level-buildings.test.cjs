const assert = require('node:assert/strict')
const fs = require('node:fs')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { TWO_LEVEL_BUILDINGS } = loadTsModule('app/config/buildingLevels.ts')
const { getBuildingLevel, getBuildingLevels } = loadTsModule('app/lib/buildings/buildingLevel.ts')
const { nextBuildingUpgrade, completeBuildingUpgrade } = loadTsModule('app/lib/buildings/buildingUpgrade.ts')
const { migrateLegacyProgression } = loadTsModule('app/serialization/LegacyProgressionMigration.ts')
const definitions = require('../public/assets/data/gameplay/buildings.json')
test('each two-level building has exactly two different sprites and two reachable gameplay tiers in every civilization', () => {
  for (const type of TWO_LEVEL_BUILDINGS) {
    assert.deepEqual(getBuildingLevels(definitions[type]), [0, 1])
    assert.equal(nextBuildingUpgrade(definitions[type], 0), 1)
    assert.equal(nextBuildingUpgrade(definitions[type], 1), undefined)
    const invalid = { type, buildingLevel: 1, buildingUpgrade: { targetLevel: 2, constructionProgress: 1 } }
    assert.equal(completeBuildingUpgrade(invalid, definitions[type]), false)
    assert.equal(invalid.buildingLevel, 1)
    assert.equal(getBuildingLevel({ type, buildingLevel: 2 }), 1)
    for (const file of fs.readdirSync('public/assets/data/civilizations')) {
      const assets = require('../public/assets/data/civilizations/' + file).buildings
      assert.ok(assets[0][type] && assets[1][type])
      assert.notDeepEqual(assets[0][type].images.final, assets[1][type].images.final)
      assert.equal(assets[2][type], undefined)
    }
  }
  assert.equal(getBuildingLevel({ type: 'Barracks', buildingLevel: 2 }), 2)
})
test('old final levels and obsolete renovations migrate without losing damage, goods or training', () => {
  for (const type of TWO_LEVEL_BUILDINGS) {
    const max = definitions[type].levelStats[1].totalHitPoints
    const building = {
      type,
      isBuilt: true,
      buildingLevel: 2,
      assetLevel: 2,
      hitPoints: max - 20,
      totalHitPoints: max,
      marketGold: 1400,
      inventory: { resources: { wood: 3 } },
      trainingQueue: [{ type: 'Bowman' }],
      buildingUpgrade: { targetLevel: 2 },
      constructionMaterials: { cost: { wood: 20 }, delivered: { wood: 5 }, consumed: { wood: 15 } },
    }
    const player = { buildings: [building] }
    migrateLegacyProgression(player)
    assert.equal(building.buildingLevel, 1)
    assert.equal(building.assetLevel, 1)
    assert.equal(building.hitPoints, max - 20)
    assert.equal(building.inventory.resources.wood, 8)
    assert.equal(building.marketGold, 1400)
    assert.equal(building.trainingQueue.length, 1)
    assert.equal(building.buildingUpgrade, undefined)
    const snapshot = JSON.stringify(player)
    migrateLegacyProgression(player)
    assert.equal(JSON.stringify(player), snapshot)
  }
})

test('intermediate saves keep damage while acquiring the merged final stats, and pending base upgrades stay pending', () => {
  const market = { type: 'Market', buildingLevel: 1, hitPoints: 460, totalHitPoints: 500 }
  const forge = {
    type: 'Forge',
    buildingLevel: 0,
    buildingUpgrade: { targetLevel: 2, constructionProgress: 0.5 },
    constructionMaterials: { cost: { wood: 75 }, delivered: { wood: 5 }, consumed: { wood: 30 } },
  }
  migrateLegacyProgression({ buildings: [market, forge] })
  assert.equal(market.totalHitPoints, 750)
  assert.equal(market.hitPoints, 710)
  assert.equal(forge.buildingUpgrade.targetLevel, 1)
  assert.equal(forge.buildingUpgrade.constructionProgress, 0.5)
  assert.equal(forge.constructionMaterials.delivered.wood, 5)
})
