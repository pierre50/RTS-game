const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { preparedSettlementState } = loadTsModule('app/serialization/PreparedSettlementState.ts')
const { buildWorldRegionPlayerConfigs } = loadTsModule('app/screens/game/WorldRegionPlayers.ts')
const { getHouseBedLabels, countResidentHouseholds } = loadTsModule('app/lib/housing/households.ts')
const { CIVILIZATIONS } = loadTsModule('app/config/civilizations.ts')
class Human {
  constructor(options) {
    Object.assign(this, options, { type: 'Human', label: 'hero-owner' })
  }
}
class AI {
  constructor(options) {
    Object.assign(this, options, { type: 'AI' })
  }
}
const { generatePlayers } = loadTsModule('app/classes/map/MapPlayerGeneration.ts', {
  mocks: {
    '../../lib': { playerColors: ['blue', 'red'] },
    '../../lib/resources/playerResourceTotals': {},
    '../players': { Human, AI },
    './BanditCampGeneration': {},
  },
})

test('shipped continent restores 42 distinct AI settlements and an empty hero start for every civilization', () => {
  const directory = path.join(__dirname, '../public/maps/worlds/world-test-1000/maps')
  const source = JSON.parse(fs.readFileSync(path.join(directory, 'world-test-1000-r0-0.map'), 'utf8'))
  const prepared = JSON.parse(fs.readFileSync(path.join(directory, 'world-test-1000-r0-0.settlements.json'), 'utf8'))
  assert.equal(prepared.settlements.length, 48)
  assert.equal(prepared.heroSpawns.length, 8)
  for (const { value: civ } of CIVILIZATIONS) {
    const config = { heroOnlyStart: true, players: [{ civ, isHuman: true }] }
    const roster = buildWorldRegionPlayerConfigs(config, source)
    const grid = []
    for (const site of source.settlements.filter(s => s.civ)) {
      grid[site.local.i] ??= []
      grid[site.local.i][site.local.j] = { category: 'Land' }
    }
    const map = {
      size: source.size,
      grid,
      settlements: source.settlements,
      heroOnlyStart: true,
      noAI: false,
      context: { app: {}, gamebox: {}, map: {}, scheduler: {} },
    }
    const players = generatePlayers(map, roster)
    assert.equal(players.length, 43)
    assert.equal(new Set(players.map(p => p.label)).size, 43)
    const savedPlayers = players.map(({ config: _config, ...player }) => ({ ...player, units: [], buildings: [] }))
    const state = preparedSettlementState(
      { players: savedPlayers, resources: [], animals: [] },
      { ...source, preparedSettlements: prepared },
      config,
      50
    )
    const hero = state.players.find(player => player.isPlayed)
    assert.equal(hero.buildings.length, 0)
    assert.equal(hero.units.length, 1)
    assert.equal(hero.units[0].type, 'Hero')
    const ais = state.players.filter(player => player.type === 'AI')
    assert.equal(ais.length, 42)
    assert.equal(
      ais.some(player => player.civ === civ),
      false
    )
    for (const { value: other } of CIVILIZATIONS.filter(c => c.value !== civ)) {
      const own = ais.filter(player => player.civ === other)
      assert.deepEqual(own.map(p => p.settlementType).sort(), [
        'city',
        'outpost',
        'outpost',
        'outpost',
        'village',
        'village',
      ])
      assert.equal(new Set(own.map(p => p.factionId)).size, 1)
      assert.equal(new Set(own.map(p => p.color)).size, 1)
      for (const player of own) {
        assert.equal(player.developmentMode, 'static')
        const site = prepared.settlements.find(site => site.id === player.label)
        const authored = prepared.players.find(p => p.label === site.ownerLabel)
        const migrated = structuredClone(authored)
        loadTsModule('app/serialization/LegacyProgressionMigration.ts').migrateLegacyProgression(migrated)
        assert.deepEqual(player.buildings, migrated.buildings)
        assert.deepEqual(player.units, authored.units)
        if (player.settlementType !== 'outpost') {
          assert.equal(player.buildings.filter(b => b.type === 'House').length, countResidentHouseholds(player))
          const assignedBeds = new Set()
          for (const unit of player.units) {
            const house = player.buildings.find(b => b.label === unit.homeHouseLabel)
            assert.ok(house, `${unit.label}: missing house`)
            assert.ok(getHouseBedLabels(player, house).includes(unit.homeBedLabel))
            assert.ok(unit.homeBedLabel.startsWith(`interior:${house.interiorPortalId}:default:`))
            assert.ok(!assignedBeds.has(unit.homeBedLabel))
            assignedBeds.add(unit.homeBedLabel)
          }
        }
      }
    }
    const excluded = new Set(prepared.settlements.filter(site => site.civ === civ).flatMap(site => site.resourceLabels))
    assert.ok(excluded.size > 0)
    assert.equal(
      state.resources.some(resource => excluded.has(resource.label)),
      false
    )
    assert.equal(
      new Set(state.players.flatMap(p => [...(p.buildings ?? []), ...(p.units ?? [])]).map(e => e.label)).size,
      state.players.reduce((sum, p) => sum + (p.buildings?.length ?? 0) + (p.units?.length ?? 0), 0)
    )
  }
})
