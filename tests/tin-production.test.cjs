const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

test('tin can be mined with starting tools and routed to the tin command', () => {
  const { canMineIronResource } = loadTsModule('app/lib/resources/ironMining.ts')
  const { getMiningActions, sendUnitToMiningAction } = loadTsModule('app/lib/units/miningActions.ts')
  const { getActionContactTool } = loadTsModule('app/lib/actions/contactActions.ts')
  const target = { type: 'Tin' }
  const calls = []
  const hero = { type: 'Hero', owner: { forgeUpgrades: {} }, sendToTin: (...args) => calls.push(args) }
  assert.equal(canMineIronResource(hero, target), true)
  assert.ok(getMiningActions().includes('minetin'))
  assert.equal(getActionContactTool(hero, 'minetin'), 'pickaxe_ceramic')
  sendUnitToMiningAction(hero, target, 'minetin', true)
  assert.deepEqual(calls, [[target, true]])
})

test('tin work yields tin during offline simulation', () => {
  const { offlineResourceWork } = loadTsModule('app/services/world/offline/OfflineWorldWork.ts')
  const resource = { type: 'Tin', quantity: 32, hitPoints: 20 }
  const worker = { type: 'Villager', autonomousJob: 'tin', inventory: { equipment: [] } }
  const result = offlineResourceWork({}, worker, resource, 3)
  assert.ok(result)
  assert.equal(result, 'goldminer')
  const { storedResource } = loadTsModule('app/services/world/work/OfflineWorkResources.ts')
  assert.equal(storedResource(worker, resource), 'tin')
})

test('tin and ingots survive unit serialization and count in bag capacity and stock totals', () => {
  const { unitData } = loadTsModule('app/serialization/entity/EntitySaveData.ts', {
    mocks: {
      '../../lib': {
        filterObject: (object, keys) =>
          Object.fromEntries(keys.filter(key => object[key] !== undefined).map(key => [key, object[key]])),
        getEntityMapSpace: () => null,
      },
    },
  })
  const { getPlayerResourceTotals } = loadTsModule('app/lib/resources/playerResourceTotals.ts')
  const { getUnitResourceCarryRemaining } = loadTsModule('app/lib/resources/resourceDelivery.ts')
  const resources = { tin: 4, copperIngot: 2, bronzeIngot: 3, ironIngot: 1 }
  const hero = {
    type: 'Hero',
    controlMode: 'hero',
    i: 1,
    j: 1,
    inventory: { equipment: [], resources },
    action: 'minetin',
  }
  const restored = JSON.parse(JSON.stringify(unitData(hero)))
  assert.deepEqual(restored.inventory.resources, resources)
  assert.equal(restored.action, 'minetin')
  assert.equal(getUnitResourceCarryRemaining(hero), 40)
  const totals = getPlayerResourceTotals({}, { hero })
  for (const [key, value] of Object.entries(resources)) assert.equal(totals[key], value)
})
