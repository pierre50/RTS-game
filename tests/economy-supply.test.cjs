const test = require('node:test')
const assert = require('node:assert/strict')
const { stockInventory, readSaveStocks, supplyCatalogue } = require('../tools/economy/supply.cjs')
const { simulateHarvest } = require('../tools/economy/simulation.cjs')
const { performanceCatalogue } = require('../tools/economy/performance.cjs')
const units = require('../public/assets/data/gameplay/units.json')
const buildings = require('../public/assets/data/gameplay/buildings.json')
const resources = require('../public/assets/data/gameplay/resources.json')
const equipment = require('../public/assets/data/gameplay/equipment.json')
test('stocks separate owners, exclude mirror totals, deduplicate nested containers and keep markets separate', () => {
  const chest = { label: 'chest', type: 'Chest', inventory: { resources: { wood: 5, food: 4, berry: 4 } } }
  const players = [
    {
      label: 'a',
      wood: 999,
      buildings: [
        { label: 'home', interiorBuildings: [chest] },
        structuredClone(chest),
        { label: 'market', type: 'Market', marketGold: 12, marketStock: ['axe_bronze', 'axe_bronze'] },
      ],
    },
    { label: 'b', buildings: [{ label: 'other', inventory: { resources: { tin: 3 } } }] },
  ]
  const result = stockInventory(players)
  assert.equal(
    result.rows.reduce((n, r) => n + r.quantity, 0),
    12
  )
  assert.equal(result.rows.find(r => r.resource === 'wood').location, 'home')
  assert.deepEqual(result.markets[0].stock, { axe_bronze: 2 })
  assert.equal(
    result.rows.some(r => r.resource === 'gold'),
    false
  )
  assert.throws(() => stockInventory([{ units: [{ inventory: { resources: { wood: -1 } } }] }]))
})
test('campaign import traverses actual recorded world states without manufacturing travelling party inventories', () => {
  const result = readSaveStocks({
    format: 'campaign-v1',
    heroParty: { playerLabel: 'hero', followerLabels: [] },
    worlds: {
      one: {
        state: { players: [{ label: 'hero', units: [{ type: 'Hero', inventory: { resources: { gold: 7 } } }] }] },
      },
    },
    economy: { regions: { unknown: { initialState: { players: [] } } } },
  })
  assert.equal(result.rows.length, 1)
  assert.equal(result.rows[0].world, 'one')
  assert.throws(() => readSaveStocks({ foo: 1 }))
})
test('cave potential counts assigned plans, not one copy of every catalogue variant; commerce is equipment only', () => {
  const data = supplyCatalogue(
    {
      caves: [
        { id: 'one', blueprintId: 'used' },
        { id: 'two', blueprintId: 'used' },
        { id: 'unknown', blueprintId: 'absent' },
      ],
    },
    null,
    {
      blueprints: [
        { id: 'used', resources: [{ type: 'Tin', quantity: 5 }] },
        { id: 'unused', resources: [{ type: 'Tin', quantity: 100 }] },
      ],
    }
  )
  assert.equal(
    data.caves.reduce((n, c) => n + (c.quantities.Tin ?? 0), 0),
    10
  )
  assert.equal(data.caves[2].known, false)
  assert.ok(data.market.resourceResale.tin > 0)
  assert.equal(
    data.market.offers.some(o => o.equipment === 'tin'),
    false
  )
  assert.deepEqual(
    data.market.levels.map(level => level.gold),
    [250, 600, 1200]
  )
  assert.equal(data.market.resources.find(offer => offer.level === 3 && offer.resource === 'ironIngot').goldValue, 51)
  assert.equal(
    data.market.offers.some(offer => offer.level === 1 && offer.equipment === 'axe_iron'),
    false
  )
  assert.equal(data.saved, null)
})
test('armor comparator covers complete hero armor above three and broken-free equipment sums', () => {
  const data = performanceCatalogue(equipment, units)
  assert.ok(data.maxArmor >= data.armorSets.at(-1).heroArmor)
  assert.ok(data.armorSets.at(-1).armor > data.armorSets[0].armor)
  const axe = data.weapons.find(w => w.id === 'axe_bronze')
  assert.equal(axe.scenarios[0].damages.find(d => d.armor === 10).damage, 1)
  assert.equal(axe.scenarios[4].damages.find(d => d.armor === 10).damage, 3)
})
test('offline benchmark reaches 100 wood with current stone durability and conserves finite resources', () => {
  const before = JSON.stringify({ units, buildings, resources })
  const near = simulateHarvest(units, buildings, resources, 0, 2)
  const far = simulateHarvest(units, buildings, resources, 0, 18)
  const bronze = simulateHarvest(units, buildings, resources, 1, 2)
  assert.equal(near.reached, true)
  assert.equal(far.reached, true)
  assert.ok(near.toolDurability > 0 && near.toolDurability < 100)
  assert.ok(far.toolDurability > 0 && far.toolDurability < 100)
  assert.ok(bronze.reached)
  assert.ok(far.elapsedMs >= near.elapsedMs)
  assert.ok(bronze.elapsedMs <= near.elapsedMs)
  for (const result of [near, far, bronze]) {
    assert.ok(result.gathered >= 100)
    assert.equal(result.gathered + result.remainingWood, resources.Tree.totalQuantity)
  }
  assert.equal(near.elapsedMs - near.lowerBoundMs, near.stepMs)
  assert.equal(JSON.stringify({ units, buildings, resources }), before)
})

test('night benchmark waits for work hours and consumes provisions instead of using a flat pause percentage', () => {
  const night = simulateHarvest(units, buildings, resources, 0, 2, 18)
  assert.equal(night.reached, true)
  assert.ok(night.toolDurability > 0 && night.toolDurability < 100)
  assert.ok(night.scheduledRestMs > 600000 && night.scheduledRestMs < night.elapsedMs)
  assert.ok(night.foodConsumed > 0)
  assert.equal(night.foodShortage, 0)
})
