const test = require('node:test')
const assert = require('node:assert/strict')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { SETTLEMENT_PROFILES, defaultSettlementType } = loadTsModule('app/config/settlementProfiles.ts')
const { applyVillageStartingState, villageStartProfiles } = loadTsModule('app/services/world/VillageStartingState.ts')
const { simulateOfflineWorld } = loadTsModule('app/services/world/offline/OfflineWorldSimulation.ts')
const buildings = require('../public/assets/data/gameplay/buildings.json')
const units = require('../public/assets/data/gameplay/units.json')
const rules = {
  buildingConfig: (_i, type) => buildings[type] ?? {},
  unitConfig: (_i, type) => units[type] ?? {},
  buildingCapacity: (_i, type) => buildings[type]?.shelterCapacity ?? 0,
  wheatMatureFrame: 3,
  cycleMs: () => 1000,
}
const terrain = Array.from({ length: 101 }, () => Array.from({ length: 101 }, () => ({ category: 'Land', z: 0 })))
function generate(type) {
  return applyVillageStartingState(
    {
      players: [
        {
          type: 'AI',
          civ: 'Hellas',
          label: 'ai',
          population: 5,
          units: [{ type: 'Villager', i: 48, j: 48 }],
          buildings: [
            {
              type: 'TownCenter',
              label: 'center',
              i: 50,
              j: 50,
              isBuilt: true,
              inventory: { resources: { wood: 9999 } },
            },
          ],
        },
      ],
      resources: [],
      animals: [],
    },
    { Hellas: SETTLEMENT_PROFILES[type] },
    terrain,
    rules
  )
}
for (const type of ['outpost', 'village', 'city']) {
  test(`${type} has exact buildings, residents and bounded stocks`, () => {
    const state = generate(type)
    const player = state.players[0]
    const profile = SETTLEMENT_PROFILES[type]
    assert.equal(player.developmentMode, 'static')
    assert.equal(player.settlementType, type)
    for (const [building, count] of Object.entries(profile.buildings))
      assert.equal(player.buildings.filter(b => b.type === building).length, count, building)
    for (const [unit, count] of Object.entries(profile.units))
      assert.equal(player.units.filter(u => u.type === unit).length, count, unit)
    assert.equal(
      player.buildings.some(b => b.type === 'TownCenter'),
      type === 'city'
    )
    if (type === 'outpost') {
      assert.equal(
        player.buildings.some(b => ['TownCenter', 'House'].includes(b.type)),
        false
      )
      assert.equal(
        player.units.some(u => u.type === 'Villager'),
        false
      )
    }
    for (const building of player.buildings) {
      const resources = building.inventory?.resources ?? {}
      assert.ok(Object.values(resources).reduce((sum, amount) => sum + amount, 0) <= 300)
      if (profile.depotStocks?.[building.type]) assert.deepEqual(resources, profile.depotStocks[building.type])
    }
    const wheat = state.resources.filter(resource => resource.type === 'Wheat')
    assert.equal(wheat.length, (profile.wheatFields ?? 0) * 9)
    const patches = Map.groupBy(wheat, resource => resource.label.split(':wheat:')[1].split(':')[0])
    const counts = new Set()
    const positions = new Set()
    for (const patch of patches.values()) {
      const young = patch.filter(resource => resource.currentFrame === 0)
      assert.ok(young.length >= 1 && young.length <= 4)
      assert.equal(patch.filter(resource => resource.currentFrame == null).length, 9 - young.length)
      counts.add(young.length)
      for (const crop of young) positions.add(patch.indexOf(crop))
    }
    if (patches.size) {
      assert.ok(counts.size > 1, 'young crop counts vary between fields')
      if (type === 'city') assert.ok(positions.has(4), 'young crops can appear in the center')
      assert.ok(positions.size > 2, 'young crops are scattered across different cells')
      assert.deepEqual(generate(type).resources, state.resources, 'generation stays deterministic')
    }
    const before = structuredClone(player)
    const report = simulateOfflineWorld(state, {
      ...rules,
      terrain,
      fromElapsedMs: 0,
      toElapsedMs: 24 * 60000 * 10,
      planBuildings: true,
      abstractVillages: true,
    })
    const economicState = player => JSON.parse(JSON.stringify(player, (key, value) =>
      ['constructionProgress', 'dailySchedule', 'marketStock', 'marketGold'].includes(key) ? undefined : value))
    assert.deepEqual(economicState(state.players[0]), economicState(before), 'ten days away must preserve losses, resource stocks and population')
    const afterFirstVisit = structuredClone(state.players[0])
    simulateOfflineWorld(state, { ...rules, terrain, fromElapsedMs: 10 * 1440000, toElapsedMs: 11 * 1440000 })
    assert.deepEqual(state.players[0], afterFirstVisit, 'normalized schedules and stock remain stable on later visits')
    assert.equal(report.arrivals, 0)
    assert.equal(report.foodConsumed, 0)
    assert.equal(report.trainingsCompleted, 0)
    assert.equal(report.buildingsCompleted, 0)
    assert.deepEqual(report.gathered, {})
  })
}
test('setup choices are stable and legacy levels only import into the three named profiles', () => {
  const profiles = villageStartProfiles({
    players: [
      { civ: 'Hellas', isHuman: false, settlementType: 'village' },
      { civ: 'Xia', isHuman: false, civilizationLevel: 3 },
      { civ: 'Human', isHuman: true },
    ],
  })
  assert.equal(profiles.Hellas.settlementType, 'village')
  assert.equal(profiles.Xia.settlementType, 'city')
  assert.equal(profiles.Human, undefined)
  assert.equal(defaultSettlementType('Hellas'), defaultSettlementType('Hellas'))
})

test('legacy campaign migration freezes detached regions without replacing losses or stocks', () => {
  const { freezeLegacySettlements } = loadTsModule('app/services/world/SettlementMigration.ts')
  const state = generate('village')
  delete state.players[0].developmentMode
  state.players[0].units.pop()
  state.players[0].buildings.find(b => b.type === 'Granary').inventory.resources.wheat = 7
  const initialState = structuredClone(state)
  const before = structuredClone(state.players[0])
  freezeLegacySettlements({ worlds: { main: { state } }, economy: { regions: { remote: { initialState } } } }, state)
  assert.deepEqual(state.players[0], { ...before, developmentMode: 'static' })
  assert.deepEqual(initialState.players[0], state.players[0])
})

test('several settlements of one faction generate one chief and one extra escort pair', () => {
  const terrain = Array.from({ length: 201 }, () => Array.from({ length: 201 }, () => ({ category: 'Land', z: 0 })))
  const source = {
    players: ['village', 'city'].map((settlementType, index) => ({
      label: settlementType,
      factionId: 'shared',
      type: 'AI',
      civ: 'Hellas',
      settlementType,
      units: [],
      buildings: [
        { type: 'TownCenter', label: `center${index}`, i: 40 + index * 110, j: 40 + index * 110, isBuilt: true },
      ],
    })),
    resources: [],
    animals: [],
  }
  const state = applyVillageStartingState(source, {}, terrain, rules)
  assert.equal(state.players.flatMap(p => p.units).filter(u => u.type === 'Chief').length, 1)
  const city = state.players.find(p => p.settlementType === 'city')
  const village = state.players.find(p => p.settlementType === 'village')
  assert.equal(city.units.filter(u => u.type === 'Chief').length, 1)
  assert.equal(city.units.filter(u => u.type === 'Fantassin').length, 12)
  assert.equal(village.units.filter(u => u.type === 'Fantassin').length, 3)
})

test('cities start with completed upgrades, full upgraded health and upgraded housing', () => {
  const city = generate('city').players[0]
  const houses = city.buildings.filter(building => building.type === 'House')
  const { countResidentHouseholds } = loadTsModule('app/lib/housing/households.ts')
  assert.equal(houses.length, countResidentHouseholds(city))
  for (const house of houses) {
    assert.equal(house.buildingLevel, 2)
    assert.equal(house.hitPoints, 188)
    assert.equal(house.totalHitPoints, 188)
    assert.equal(house.isBuilt, true)
    assert.equal(house.buildingUpgrade, undefined)
    assert.equal(house.constructionMaterials, undefined)
  }
  const center = city.buildings.find(building => building.type === 'TownCenter')
  assert.equal(center.buildingLevel, 2)
  assert.equal(center.hitPoints, 1425)
  assert.equal(center.totalHitPoints, 1425)
  assert.equal(city.populationMax, houses.length * 2)
  assert.equal(city.buildings.find(building => building.type === 'Forge').buildingLevel, 2)
  const village = generate('village').players[0]
  assert.ok(village.buildings.filter(building => buildings[building.type].levelStats).every(b => b.buildingLevel === 1))
  assert.equal(village.populationMax, village.buildings.filter(b => b.type === 'House').length * 2)
})

test('city lights are scattered across districts with stable mixed appearances', () => {
  const state = generate('city')
  const lights = state.players[0].buildings.filter(b => b.type === 'CampBrazier')
  assert.equal(lights.length, 10)
  assert.deepEqual(new Set(lights.map(b => b.assetType)), new Set(['CampBrazier', 'CampTorchStand']))
  assert.ok(Math.max(...lights.map(b => b.i)) - Math.min(...lights.map(b => b.i)) >= 10)
  assert.ok(Math.max(...lights.map(b => b.j)) - Math.min(...lights.map(b => b.j)) >= 10)
  assert.deepEqual(generate('city').players[0].buildings, state.players[0].buildings)
})
