const test = require('node:test')
const assert = require('node:assert/strict')
const {
  toolLifetimeCatalogue,
  toolLifetimeSection,
  harvestForImpacts,
  impactsForAmount,
} = require('../tools/economy/tool-lifetime.cjs')
const { performanceCatalogue } = require('../tools/economy/performance.cjs')
const { craftCatalogue } = require('../tools/economy/catalogue.cjs')
const units = require('../public/assets/data/gameplay/units.json')
const resources = require('../public/assets/data/gameplay/resources.json')
const buildings = require('../public/assets/data/gameplay/buildings.json')
const equipment = require('../public/assets/data/gameplay/equipment.json')
const data = toolLifetimeCatalogue(
  units,
  resources,
  buildings,
  craftCatalogue(),
  performanceCatalogue(equipment, units)
)

test('lifetime audit counts each tree felling and node tails instead of unlimited perfect lots', () => {
  assert.deepEqual(
    data.scenarios.map(s => s.uses),
    [300, 600, 900]
  )
  assert.deepEqual(
    data.scenarios.map(s => s.harvests.find(h => h.resource === 'wood').quantity),
    [137, 720, 1400]
  )
  assert.deepEqual(
    data.scenarios.map(s => s.harvests.find(h => h.resource === 'wheat').gain),
    [2, 3, 4]
  )
  assert.equal(data.scenarios[0].harvests.find(h => h.resource === 'iron').quantity, null)
  assert.equal(harvestForImpacts(25, 1, 2, 180, 25), 0)
  assert.equal(harvestForImpacts(27, 1, 2, 180, 25), 1)
  assert.equal(harvestForImpacts(8, 3, 2, 10), 10, 'last wheat lot is one, not three')
  assert.equal(impactsForAmount(181, 1, 2, 180, 25), 412, 'a second tree costs another 25 contacts')
})

test('building comparison includes construction and reports tool fabrication separately', () => {
  const stone = data.scenarios[0]
  const house = stone.comparisons.find(b => b.type === 'House')
  assert.deepEqual(house.cost, { wood: 40, stone: 10 })
  assert.deepEqual(house.impacts, { axe: 105, pickaxe: 30, hammer: 147 })
  assert.deepEqual(house.counts, { axe: 1, pickaxe: 1, hammer: 1 })
  assert.deepEqual(house.toolCost, { wood: 12, stone: 15 })
  assert.equal(stone.comparisons.find(b => b.type === 'TownCenter').counts.axe, 2)
  assert.ok(stone.harvests.find(h => h.resource === 'wood').activeSeconds > 180)
  const html = toolLifetimeSection(
    { toolLifetime: data },
    {
      escape: String,
      format: String,
      name: String,
      cost: JSON.stringify,
      table: (headers, rows) => headers.join(' ') + rows.join(''),
      row: cells => cells.join(' '),
    }
  )
  assert.match(html, /Durée de vie des outils et bâtiments/)
  assert.match(html, /sans trajets, repas, repos/)
  assert.match(html, /300 \/ 600 \/ 900/)
})
