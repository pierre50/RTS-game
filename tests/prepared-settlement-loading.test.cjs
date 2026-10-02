const assert = require('node:assert/strict')
const test = require('node:test')
const { createHash } = require('node:crypto')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const hash = value => createHash('sha256').update(value).digest('hex')
const { preparedSettlementState } = loadTsModule('app/serialization/PreparedSettlementState.ts')
function prepared() {
  return {
    format: 'prepared-settlements',
    version: 1,
    mapId: 'fixture',
    size: 2,
    source: { sha256: '', rulesSha256: 'rules' },
    settlements: [],
    heroSpawns: [{ civ: 'Hellas', i: 0, j: 1 }],
    players: [
      {
        type: 'AI',
        civ: 'Hellas',
        developmentMode: 'static',
        settlementType: 'village',
        buildings: [{ type: 'Granary', i: 1, j: 1, inventory: { resources: { wheat: 200 } } }],
        units: [{ type: 'Villager', i: 1, j: 2 }],
      },
      { type: 'Bandits', units: [{ type: 'BanditChief', i: 2, j: 2 }], buildings: [] },
    ],
    banditCamps: [
      {
        i: 2,
        j: 1,
        unitTypes: ['BanditChief'],
        caveId: 'cave',
        caveContent: { caveId: 'cave', inventory: { resources: { gold: 4 } } },
      },
    ],
    resources: [{ type: 'Wheat', i: 1, j: 0, quantity: 100 }],
    animals: [],
  }
}
test('prepared state keeps exact resources, stocks and units and maps the hero and cave ownership', () => {
  const data = prepared()
  const initial = {
    players: [
      { label: 'human', type: 'Human', isPlayed: true, civ: 'Hellas' },
      { label: 'ai', factionId: 'civ-hellas', type: 'AI', civ: 'Hellas' },
    ],
    resources: [],
    animals: [],
    resourceDelta: {},
  }
  const original = structuredClone(data)
  const result = preparedSettlementState(
    initial,
    { preparedSettlements: data, caves: [{ id: 'cave', i: 2, j: 0 }] },
    { heroStartVillage: 'Hellas' },
    50
  )
  assert.deepEqual(data, original)
  assert.deepEqual(initial.resources, [])
  assert.equal(result.resourceDelta, undefined)
  assert.deepEqual(result.resources, data.resources)
  assert.deepEqual(result.players[1].buildings, data.players[0].buildings.map(building => ({ ...building, buildingLevel: 0 })))
  assert.deepEqual(result.players[1].units, data.players[0].units)
  assert.equal(result.players[1].label, 'ai')
  assert.equal(result.players[1].developmentMode, 'static')
  assert.equal(result.players[0].units[0].hitPoints, 50)
  assert.deepEqual([result.players[0].units[0].i, result.players[0].units[0].j], [0, 1])
  const bandits = result.players.find(p => p.type === 'Bandits')
  const cave = result.players.find(p => p.label === 'neutral').buildings[0].cave
  assert.equal(cave.banditContent.ownerLabel, bandits.label)
  assert.equal(cave.banditContent.inventory.resources.gold, 4)
  assert.equal(result.runtime.banditCamps[0].generation, 0)
  assert.throws(
    () =>
      preparedSettlementState(
        { ...initial, players: [{ type: 'AI', civ: 'missing' }] },
        { preparedSettlements: data },
        {},
        50
      ),
    /Missing prepared settlement/
  )
})
test('new map loads preparation while save loading retains the source baseline without fetching it', async () => {
  const previousFetch = global.fetch
  const payload = {
    format: 'map-blueprint',
    version: 1,
    id: 'fixture',
    size: 2,
    terrain: Buffer.alloc(9).toString('base64'),
    relief: Buffer.alloc(9).toString('base64'),
    resources: [],
  }
  const rawMap = JSON.stringify(payload)
  const data = prepared()
  data.source.sha256 = hash(rawMap)
  const rawPrepared = JSON.stringify(data)
  const reference = {
    path: 'fixture.settlements.json',
    sha256: hash(rawPrepared),
    sourceSha256: hash(rawMap),
    rulesSha256: 'rules',
  }
  let unavailable = false
  const calls = []
  global.fetch = async path => {
    calls.push(path)
    if (path.endsWith('manifest.json'))
      return {
        ok: true,
        json: async () => ({
          maps: [
            { id: 'fixture', region: { x: 0, y: 0 }, size: 2, path: 'fixture.map', preparedSettlements: reference },
          ],
        }),
      }
    if (path.endsWith('.map')) return { ok: true, text: async () => rawMap, json: async () => payload }
    return { ok: !unavailable, status: 404, text: async () => rawPrepared }
  }
  try {
    const { loadPregeneratedWorldMapBlueprint: load } = loadTsModule('app/serialization/blueprint/MapBlueprintLoader.ts')
    const options = { worldId: 'fixture', worldRegionId: 'fixture', size: 2 }
    const cache = new Map()
    const fresh = await load({ ...options, includePreparedSettlements: true }, cache)
    assert.deepEqual(fresh.preparedSettlements.resources, data.resources)
    assert.deepEqual(fresh.resources, [])
    calls.length = 0
    unavailable = true
    const saved = await load(options, cache)
    assert.equal(saved.preparedSettlements, undefined)
    assert.equal(
      calls.some(path => path.endsWith('.settlements.json')),
      false
    )
    await assert.rejects(load({ ...options, includePreparedSettlements: true }), /file unavailable/)
    unavailable = false
    reference.sourceSha256 = 'wrong'
    await assert.rejects(load({ ...options, includePreparedSettlements: true }), /source map changed/)
    reference.sourceSha256 = hash(rawMap)
    reference.sha256 = 'wrong'
    await assert.rejects(load({ ...options, includePreparedSettlements: true }), /checksum mismatch/)
  } finally {
    global.fetch = previousFetch
  }
})

test('prepared new-game boot bypasses all live settlement generation and stays ready', async () => {
  const data = prepared()
  const config = { worldId: 'world-test-1000', heroOnlyStart: true }
  const initial = {
    players: [{ label: 'human', type: 'Human', isPlayed: true, civ: 'Hellas' }],
    resources: [],
    animals: [],
  }
  let terrainPrepared = false
  let restored
  const forbidden = () => {
    throw new Error('Live generation must not run')
  }
  const map = {
    heroOnlyStart: true,
    worldRegionId: 'fixture',
    ready: false,
    stylishMap: forbidden,
    prepareTerrainForSavedState: async () => {
      terrainPrepared = true
    },
    mapGeneration: {
      applySavedStateToGeneratedMap: state => {
        restored = state
        map.ready = true
      },
    },
  }
  const { bootGameFromConfig } = loadTsModule('app/screens/game/GameWorldBoot.ts', {
    mocks: {
      './GameBootMap': {
        prepareBootMap: async () => ({
          config,
          map,
          blueprint: { preparedSettlements: data },
          human: { civ: 'Hellas' },
          worldId: config.worldId,
        }),
      },
      '../../lib/lpc': { preloadBakedLpcUnitsForPlayers: async () => {} },
      '../../services/world/VillageStartingState': {
        villageStartProfiles: () => ({ Hellas: {} }),
        applyVillageStartingState: forbidden,
        placeStartingHeroInVillage: forbidden,
      },
      '../../services/world/InitialVillagePlacement': { placeInitialVillageUnits: forbidden },
      '../../services/world/VillageBaseState': { populateVillageBase: forbidden },
      '../../services/world/WorldEconomyRuntime': { initializeCampaignEconomy: async () => {} },
      '../../serialization/SaveSerializer': {
        serializeGame: () => initial,
        serializeCampaignBootstrap: () => initial,
        serializeGameForPersistence: () => restored,
      },
      '../../serialization/CampaignSave': {
        createInitialCampaignSave: () => ({ currentWorldId: 'root', worlds: { root: {} } }),
      },
      './GameStateHelpers': { ensureCampaignPlayerRoster: value => value, savedRuntimeState: value => value },
    },
  })
  const context = { players: [{ type: 'AI' }], player: {} }
  const game = {
    context,
    _gameContext: () => context,
    _updateLoading: async () => {},
    _mountRuntime() {
      assert.equal(map.ready, true)
    },
    _autosaveCampaign: async () => true,
  }
  await bootGameFromConfig(game, config)
  assert.equal(terrainPrepared, true)
  assert.deepEqual(restored.resources, data.resources)
  assert.equal(game._campaignSave.worlds.root.state, restored)
})
