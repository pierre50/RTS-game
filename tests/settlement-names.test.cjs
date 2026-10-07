const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { assignSettlementNames } = loadTsModule('app/lib/settlements/settlementNames.ts')
const { CIVILIZATION_SETTLEMENT_NAMES } = loadTsModule('app/config/settlementNames.ts')
const { CIVILIZATIONS } = loadTsModule('app/config/civilizations.ts')

test('every civilization names both human and AI towns without collisions', () => {
  const owners = CIVILIZATIONS.flatMap(({ value: civ }) =>
    [true, false].map(isPlayed => ({
      civ,
      isPlayed,
      buildings: [{ type: 'TownCenter' }, { type: 'TownCenter' }, { type: 'House' }],
    }))
  )
  assignSettlementNames(owners)
  const names = []
  for (const owner of owners) {
    for (const town of owner.buildings.slice(0, 2)) {
      assert.ok(CIVILIZATION_SETTLEMENT_NAMES[owner.civ].includes(town.settlementName))
      names.push(town.settlementName)
    }
    assert.equal(owner.buildings[2].settlementName, undefined)
  }
  assert.equal(new Set(names).size, names.length)
})

test('legacy villages reserve later saved names and preserve names through reload and conquest', () => {
  const owners = [
    {
      civ: 'Latium',
      buildings: [
        { type: 'TownCenter' },
        { type: 'TownCenter', settlementName: 'Roma' },
        { type: 'TownCenter', settlementName: 'Port des Brumes' },
      ],
    },
  ]
  assignSettlementNames(owners)
  assert.equal(owners[0].buildings[0].settlementName, 'Alba Longa')
  const reloaded = JSON.parse(JSON.stringify(owners))
  reloaded[0].civ = 'Nord'
  assignSettlementNames(reloaded)
  assert.deepEqual(reloaded[0].buildings, owners[0].buildings)
})

test('exhausted pools use numbered names without colliding with existing suffixes', () => {
  const count = CIVILIZATION_SETTLEMENT_NAMES.Sumeria.length
  const owner = {
    civ: 'Sumeria',
    buildings: [
      { type: 'TownCenter', settlementName: 'Uruk 2' },
      ...Array.from({ length: count * 2 + 1 }, () => ({ type: 'TownCenter' })),
    ],
  }
  assignSettlementNames([owner])
  const names = owner.buildings.map(building => building.settlementName)
  assert.equal(new Set(names).size, names.length)
  assert.ok(names.includes('Uruk 3'))
})

test('unknown civilizations receive stable fallback names', () => {
  const owner = { buildings: [{ type: 'TownCenter' }] }
  assignSettlementNames([owner])
  assert.equal(owner.buildings[0].settlementName, 'Athènes')
  assignSettlementNames([owner])
  assert.equal(owner.buildings[0].settlementName, 'Athènes')
})
