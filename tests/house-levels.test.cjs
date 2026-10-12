const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { furnishInterior } = require('./helpers/interiorFurnitureFixture.cjs')
const { reconcileHouseholds, getFreeHouseBedLabels } = loadTsModule('app/lib/housing/households.ts')
const { prepareHouseBedPlans } = loadTsModule('app/lib/housing/householdBeds.ts')
const { getPopulationCapacityFromBuildings } = loadTsModule('app/lib/buildings/buildingOccupancy.ts')
const { migrateLegacyProgression } = loadTsModule('app/serialization/LegacyProgressionMigration.ts')

test('each house level materializes exactly 1, 2, 4 beds in identical size-2 rooms, mirrored too', () => {
  for (const mirrored of [false, true]) {
    for (const [buildingLevel, count] of [1, 2, 4].entries()) {
      const f = furnishInterior('House', undefined, mirrored, {}, { buildingLevel })
      const floorCount = f.space.grid.flat().filter(cell => !cell.terrainHidden).length
      assert.equal(floorCount, 77, 'only the four corner tiles are removed')
      assert.equal(f.space.exitCell.terrainHidden, false)
      const beds = f.owner.buildings.filter(b => b.type === 'CampBedroll')
      assert.equal(beds.length, count, `level ${buildingLevel}, mirror ${mirrored}`)
      assert.equal(new Set(beds.map(b => b.label)).size, count)
    }
  }
})
test('unrelated residents share available beds; a trainee keeps a reserved bed', () => {
  const house = { type: 'House', label: 'house', buildingLevel: 2, i: 0, j: 0, isBuilt: true }
  const owner = {
    label: 'p',
    type: 'Human',
    buildings: [house],
    units: Array.from({ length: 5 }, (_, i) => ({ type: 'Villager', label: `v${i}`, i: 0, j: 0 })),
  }
  reconcileHouseholds(owner)
  assert.equal(owner.units.filter(u => u.homeHouseLabel).length, 4)
  assert.equal(new Set(owner.units.slice(0, 4).map(u => u.homeBedLabel)).size, 4)
  assert.equal(getFreeHouseBedLabels(owner, house).length, 0)
  const trainee = owner.units.shift()
  owner.buildings.push({ type: 'Barracks', trainingQueue: [{ trainee }] })
  reconcileHouseholds(owner)
  assert.ok(trainee.homeBedLabel)
  assert.equal(owner.units.filter(u => u.homeHouseLabel).length, 3)
})
test('upgrades add only new bed IDs, preserving saved furniture and removed beds', () => {
  const house = { type: 'House', label: 'h', buildingLevel: 0, isBuilt: true, i: 0, j: 0 }
  const owner = { label: 'p', type: 'Human', buildings: [house], units: [] }
  prepareHouseBedPlans(owner)
  assert.equal(house.plannedBedLabels.length, 1)
  house.interiorBuildings = [{ type: 'Chest', label: 'my-chest', inventory: { resources: { gold: 25 } } }]
  delete house.plannedBedLabels
  house.buildingLevel = 2
  prepareHouseBedPlans(owner)
  assert.equal(house.plannedBedLabels.length, 3)
  assert.ok(!house.plannedBedLabels.some(label => label.endsWith('bedroll-1')))
  assert.equal(house.interiorBuildings[0].inventory.resources.gold, 25)
  assert.equal(getPopulationCapacityFromBuildings(owner.buildings, owner), 3)
  const saved = JSON.parse(JSON.stringify(owner))
  prepareHouseBedPlans(saved)
  assert.deepEqual(saved, owner)
})
test('legacy houses keep the original medium interior and existing beds across migration and reload', () => {
  const owner = {
    buildings: [{ type: 'House', buildingLevel: 0, interiorBuildings: [{ type: 'CampBedroll', label: 'custom' }] }],
  }
  migrateLegacyProgression(owner)
  assert.equal(owner.buildings[0].houseInteriorLevel, 1)
  assert.equal(owner.buildings[0].interiorBuildings[0].label, 'custom')
  const current = { buildings: [{ type: 'House', buildingLevel: 0, houseInteriorLevel: 0 }] }
  migrateLegacyProgression(current)
  assert.equal(current.buildings[0].houseInteriorLevel, 0)
})

test('an upgraded saved room adds beds without moving existing furniture or losing inventory', () => {
  for (const mirrored of [false, true]) {
    const initial = furnishInterior('House', undefined, mirrored, {}, { buildingLevel: 0 })
    const saved = JSON.parse(JSON.stringify(initial.owner.buildings))
    saved[0].inventory = { resources: { gold: 31 } }
    const restored = furnishInterior(
      'House',
      saved,
      mirrored,
      {},
      {
        buildingLevel: 2,
        houseInteriorLevel: 2,
        plannedBedLabels: [2, 3, 4].map(n => `interior:House:default:bedroll-${n}`),
      }
    )
    assert.equal(restored.owner.buildings.filter(b => b.type === 'CampBedroll').length, 4)
    for (const original of saved) {
      const after = restored.owner.buildings.find(b => b.label === original.label)
      assert.deepEqual([after.i, after.j], [original.i, original.j])
      assert.deepEqual(after.inventory, original.inventory)
    }
    const reloaded = furnishInterior(
      'House',
      JSON.parse(JSON.stringify(restored.owner.buildings)),
      mirrored,
      {},
      { buildingLevel: 2, houseInteriorLevel: 2 }
    )
    assert.equal(reloaded.owner.buildings.filter(b => b.type === 'CampBedroll').length, 4)
  }
})
