const test = require('node:test')
const assert = require('node:assert/strict')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const cache = new Map()
const { installDeferredVillages, deferredVillageState, clearDeferredVillages, canDeferVillage } = loadTsModule(
  'app/services/world/distantVillages/DeferredVillageStore.ts',
  { moduleCache: cache }
)
const { isDistantOwner } = loadTsModule('app/lib/units/village/villageActivity.ts', { moduleCache: cache })
function fixture(mode = 'static') {
  const owner = {
    label: 'village',
    type: 'AI',
    units: [],
    buildings: [],
    corpses: [],
    config: { buildings: { House: { size: 2 } } },
  }
  const hero = { i: 0, j: 0 }
  const cells = new Map()
  const grid = new Proxy(
    {},
    {
      get: (_, i) =>
        new Proxy(
          {},
          {
            get: (_, j) => {
              const key = `${i}:${j}`
              if (!cells.has(key))
                cells.set(key, {
                  i: Number(i),
                  j: Number(j),
                  x: Number(i) * 32,
                  y: Number(j) * 32,
                  solid: false,
                  has: null,
                })
              return cells.get(key)
            },
          }
        ),
    }
  )
  const context = {
    map: { grid },
    players: [owner],
    controls: {
      heroUnit: hero,
      getViewportMetrics: () => ({ visibleLeft: 0, visibleTop: 0, visibleWidth: 100, visibleHeight: 100 }),
    },
    scheduler: { elapsedMs: 0 },
  }
  const state = {
    label: owner.label,
    type: 'AI',
    developmentMode: mode,
    population: 1,
    units: [{ label: 'chief', type: 'Chief', i: 500, j: 500, hitPoints: 31 }],
    buildings: [{ label: 'house', type: 'House', i: 502, j: 500, inventory: { resources: { wood: 7 } } }],
  }
  const store = installDeferredVillages(context)
  const advances = []
  let creates = 0
  store.add(
    owner,
    state,
    saved => {
      creates++
      owner.units = structuredClone(saved.units)
      owner.buildings = structuredClone(saved.buildings)
    },
    (saved, from, to) => {
      advances.push([from, to])
      saved.buildings[0].inventory.resources.wood++
    }
  )
  return { context, owner, hero, state, store, advances, creates: () => creates }
}
test('unvisited villages have no runtime entities; save keeps residents, inventory and footprint', () => {
  const f = fixture()
  f.store.update()
  assert.equal(f.creates(), 0)
  assert.deepEqual(f.owner.units, [])
  assert.deepEqual(f.owner.buildings, [])
  assert.equal(isDistantOwner(f.owner), true)
  assert.equal(f.context.map.grid[502][500].solid, true)
  assert.deepEqual(deferredVillageState(f.owner), f.state)
  const saved = deferredVillageState(f.owner)
  saved.units[0].hitPoints = 0
  assert.equal(deferredVillageState(f.owner).units[0].hitPoints, 31)
})
test('hero proximity beyond camera materializes once and clears the dormant registration', () => {
  const f = fixture()
  Object.assign(f.hero, { i: 421, j: 500 })
  f.store.update()
  f.store.update()
  assert.equal(f.creates(), 1)
  assert.equal(f.owner.units[0].hitPoints, 31)
  assert.equal(f.store.size, 0)
  assert.equal(isDistantOwner(f.owner), false)
  assert.equal(f.context.map.grid[502][500].solid, false) // runtime constructor owns occupancy from here
  assert.equal(deferredVillageState(f.owner), undefined)
})
test('camera alone materializes a village; saved target labels can wake a remote village', () => {
  const f = fixture()
  f.context.controls.getViewportMetrics = () => ({
    visibleLeft: 500 * 32,
    visibleTop: 500 * 32,
    visibleWidth: 50,
    visibleHeight: 50,
  })
  f.store.update()
  assert.equal(f.creates(), 1)
  const g = fixture()
  assert.equal(g.store.wakeLabel('chief'), true)
  assert.equal(g.store.wakeLabel('chief'), false)
  assert.equal(g.creates(), 1)
})
test('dynamic economy advances data, flushes the remainder once, and preserves it on wake', () => {
  const f = fixture('dynamic')
  f.context.scheduler.elapsedMs = 2000
  f.store.update()
  assert.deepEqual(f.advances, [[0, 2000]])
  assert.equal(f.creates(), 0)
  f.context.scheduler.elapsedMs = 2500
  assert.equal(deferredVillageState(f.owner).buildings[0].inventory.resources.wood, 9)
  deferredVillageState(f.owner)
  f.store.wakeLabel('house')
  assert.deepEqual(f.advances, [
    [0, 2000],
    [2000, 2500],
  ])
  assert.equal(f.owner.buildings[0].inventory.resources.wood, 9)
})
test('clearing a map releases reservations and never creates the discarded villages', () => {
  const f = fixture()
  clearDeferredVillages(f.context.map)
  assert.equal(f.creates(), 0)
  assert.equal(f.context.map.grid[502][500].solid, false)
  assert.equal(isDistantOwner(f.owner), false)
  assert.equal(deferredVillageState(f.owner), undefined)
})
test('player, combat, followers and travelling cave residents retain live restoration', () => {
  const f = fixture()
  assert.equal(canDeferVillage(f.context, f.state), true)
  assert.equal(canDeferVillage(f.context, { ...f.state, isPlayed: true }), false)
  for (const extra of [
    { action: 'attack' },
    { action: 'flee' },
    { followingHero: true },
    { cavePosition: { caveId: 'cave', i: 1, j: 1 } },
  ])
    assert.equal(canDeferVillage(f.context, { ...f.state, units: [{ ...f.state.units[0], ...extra }] }), false)
})

test('map restoration creates only nearby villages, and restores a remote village once on demand', () => {
  const f = fixture()
  clearDeferredVillages(f.context.map)
  f.state.buildings.push({ type: 'TownCenter', label: 'town', i: 505, j: 500 })
  const created = []
  const { restoreSavedEntities } = loadTsModule('app/classes/map/generation/MapSavedEntities.ts', {
    moduleCache: cache,
    mocks: {
      '../../players': { Gaia: class {} },
      '../../Resource': {},
      '../../../lib': { getGaiaAnimals: () => [] },
      '../../../services/visibility/UnitPerception': { rehydrateAIKnowledge() {} },
      '../../../services/world/distantVillages/DeferredVillageEconomy': { advanceDeferredVillage() {} },
      '../MapSaveRestore': {
        restorePlayerEntitiesFromSave(player, state) {
          created.push(player.label)
          player.units = structuredClone(state.units)
          player.buildings = structuredClone(state.buildings)
        },
        restorePlayerInteriors() {},
        restoreBuildingAssignments() {},
        restorePlayerViews() {},
        restoreAIState() {},
        restoreSelection() {},
        restoreCaveOccupants() {},
        processUnit() {},
      },
    },
  })
  f.context.map.context = f.context
  restoreSavedEntities(f.context.map, [f.state], [], f.context)
  assert.deepEqual(created, [])
  const townName = deferredVillageState(f.owner).buildings.find(b => b.type === 'TownCenter').settlementName
  assert.ok(townName)
  const { getDeferredVillages } = loadTsModule('app/services/world/distantVillages/DeferredVillageStore.ts', { moduleCache: cache })
  const store = getDeferredVillages(f.context.map)
  Object.assign(f.hero, { i: 450, j: 500 })
  store.update()
  store.update()
  assert.deepEqual(created, ['village'])
  assert.equal(f.owner.units[0].label, 'chief')
  assert.equal(f.owner.buildings.find(b => b.type === 'TownCenter').settlementName, townName)
})

test('an accepted quest keeps its village live on restore', () => {
  const f = fixture()
  f.context.getQuestJournal = () => ({
    quests: [{ status: 'active', owner: { playerLabel: 'village', entityLabel: 'chief' } }],
  })
  assert.equal(canDeferVillage(f.context, f.state), false)
  f.context.getQuestJournal = () => ({
    quests: [{ status: 'available', owner: { playerLabel: 'village', entityLabel: 'chief' } }],
  })
  assert.equal(canDeferVillage(f.context, f.state), true)
})

test('saved calendar time is used before the day/night service is installed', () => {
  const f = fixture('dynamic')
  clearDeferredVillages(f.context.map)
  f.context.scheduler.elapsedMs = 900000
  const store = installDeferredVillages(f.context, 12345)
  const calls = []
  store.add(
    f.owner,
    f.state,
    () => {},
    (_state, from, to) => calls.push([from, to])
  )
  deferredVillageState(f.owner)
  assert.deepEqual(calls, [])
  f.context.dayNight = { getElapsedMs: () => 13000 }
  deferredVillageState(f.owner)
  assert.deepEqual(calls, [[12345, 13000]])
})

test('revealed minimap sees deferred AI bases without waking or advancing the village', () => {
  const { MinimapBuildingKnowledge } = loadTsModule('app/ui/minimap/MinimapBuildingKnowledge.ts', {
    moduleCache: cache,
  })
  const f = fixture()
  f.store.clear()
  f.state.buildings[0].type = 'TownCenter'
  f.owner.colorHex = '#ff0000'
  f.store.add(
    f.owner,
    f.state,
    () => assert.fail('minimap must not wake village'),
    () => assert.fail('minimap must not advance economy')
  )
  f.context.scheduler.elapsedMs = 10000
  const player = { views: { isVisible: () => false } }
  const space = { id: 'outside', grid: f.context.map.grid }
  const knowledge = new MinimapBuildingKnowledge()
  assert.deepEqual(knowledge.update(player, [f.owner], space), [])
  const markers = knowledge.update(player, [f.owner], space, true)
  assert.equal(markers.length, 1)
  assert.equal(markers[0].town, true)
  assert.equal(markers[0].color, '#ff0000')
  assert.equal(markers[0].visible, true)
  assert.equal(f.store.has(f.owner), true)
  assert.deepEqual(f.owner.buildings, [])
  assert.equal(knowledge.update(player, [f.owner], space)[0].visible, false)
  assert.deepEqual(knowledge.update(player, [f.owner], { ...space, id: 'interior:test' }, true), [])
})

test('debug landmarks use deferred village profiles and survive materialization without duplicate markers', () => {
  const { minimapDebugLandmarks } = loadTsModule('app/ui/minimap/MinimapDebugLandmarks.ts', { moduleCache: cache })
  const f = fixture()
  const player = { type: 'Human' }
  f.context.scheduler.elapsedMs = 10000
  f.owner.settlementType = 'city'
  let markers = minimapDebugLandmarks([f.owner], player, 'outside')
  assert.equal(markers.length, 1)
  assert.equal(markers[0].kind, 'city')
  assert.equal(f.creates(), 0)
  assert.equal(f.advances.length, 0)
  f.owner.settlementType = 'village'
  assert.equal(minimapDebugLandmarks([f.owner], player, 'outside')[0].kind, 'village')
  f.owner.settlementType = 'outpost'
  markers = minimapDebugLandmarks([f.owner], player, 'outside')
  assert.equal(markers[0].kind, 'outpost')
  assert.deepEqual(minimapDebugLandmarks([f.owner], player, 'interior:test'), [])
  f.store.wake(f.owner)
  assert.deepEqual(minimapDebugLandmarks([f.owner], player, 'outside'), markers)
  const bandits = {
    type: 'Bandits',
    buildings: [
      { type: 'FireCamp', i: 1, j: 1 },
      { type: 'FireCamp', i: 5, j: 5 },
      { type: 'Cave', i: 2, j: 2 },
    ],
    units: [],
  }
  assert.deepEqual(
    minimapDebugLandmarks([bandits], player, 'outside').map(marker => marker.kind),
    ['camp', 'camp', 'cave']
  )
})
