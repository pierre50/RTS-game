const assert = require('node:assert/strict')
const test = require('node:test')
const { groundResourceCatalogue } = require('../tools/economy/ground-resources.cjs')
const { npcEquipmentCatalogue } = require('../tools/economy/npc-equipment.cjs')
const { mapInventory } = require('../tools/economy/model.cjs')
const definitions = require('../public/assets/data/gameplay/resources.json')

test('economy catalogue reads ground rules and executes construction and stock-priority scenarios', () => {
  const data = groundResourceCatalogue({ resources: [{ type: 'GroundWood', nodes: 3, quantity: 3 }] }, definitions, {})
  const wood = data.resources.find(r => r.type === 'GroundWood')
  assert.equal(wood.initialNodes, 3)
  assert.equal(wood.initialQuantity, 3)
  assert.equal(wood.quantityPerNode, 1)
  assert.equal(wood.respawnDelayDays, 2)
  assert.equal(data.resources.find(r => r.type === 'GroundStone').respawnDelayDays, 4)
  assert.equal(data.resources.find(r => r.type === 'GroundStone').initialNodes, 0)
  assert.equal(data.stoneToolRecipes.length, 4)
  assert.ok(data.stoneToolRecipes.every(r => r.station === 'inventory'))
  assert.ok(
    data.checks.every(c => c.passed),
    JSON.stringify(data.checks)
  )
  assert.equal(data.construction.hammerCanCollect, true)
  assert.equal(data.construction.hammerCanChop, false)
  assert.equal(data.visualMirroring.implemented, true)
})

test('NPC audit validates paid stone fallback and restoration of metal after the next break', () => {
  const data = npcEquipmentCatalogue()
  assert.equal(data.passed, true, JSON.stringify(data.checks.filter(c => !c.passed)))
  assert.ok(data.checks.some(c => c.label.includes('aucun outil gratuit') && c.passed))
  assert.ok(data.checks.some(c => c.label.includes('Prochaine casse') && c.passed))
})

test('surface inventory counts ground wood and stone once alongside regular deposits', () => {
  const map = {
    format: 'map-blueprint',
    version: 2,
    size: 1,
    terrain: [
      [0, 0],
      [0, 0],
    ],
  }
  const resources = [
    { type: 'GroundWood', i: 0, j: 0, quantity: 1 },
    { type: 'GroundStone', i: 1, j: 0, quantity: 1 },
  ]
  const inventory = mapInventory(map, resources, definitions, 2)
  assert.equal(
    inventory.resources.filter(r => r.resource === 'wood').reduce((n, r) => n + r.quantity, 0),
    1
  )
  assert.equal(
    inventory.resources.filter(r => r.resource === 'stone').reduce((n, r) => n + r.quantity, 0),
    1
  )
})
