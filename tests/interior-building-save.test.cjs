const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

const { normalizeSavedInteriorBuildings } = loadTsModule(
  'app/serialization/InteriorBuildingSave.ts'
)
function groupInteriorBuildings(buildings, label) {
  const player = { buildings, label }
  normalizeSavedInteriorBuildings(player)
  return player.buildings
}
const { ensureInteriorDefaultBuildings } = loadTsModule('engine/services/BuildingInteriorSpaceDecorations.ts', {
  mocks: {
    '../../app/lib/buildings/interiorDecorations': {},
    '../../app/lib/grid/placement': {},
  },
})

const parent = () => ({
  type: 'TownCenter',
  label: 'center',
  i: 40,
  j: 40,
  isBuilt: true,
  inventory: { resources: {} },
})
const chest = () => ({
  type: 'Chest',
  label: 'interior:human:center:default:storage-chest',
  i: 11,
  j: 11,
  isBuilt: true,
  inventory: { resources: { wheat: 20, wood: 7 }, equipment: ['hammer'] },
})

test('old flat decorations migrate to their parent without changing inventory or the source records', () => {
  const buildings = [chest(), parent()]
  const before = structuredClone(buildings)
  const saved = groupInteriorBuildings(buildings, 'human')
  assert.equal(saved.length, 1)
  assert.equal(saved[0].label, 'center')
  assert.deepEqual(saved[0].interiorBuildings[0], chest())
  assert.deepEqual(groupInteriorBuildings(saved, 'human'), saved)
  assert.deepEqual(buildings, before)
})

test('explicit interior spaces support custom buildings while missing parents fail without dropping data', () => {
  const custom = { ...chest(), label: 'custom-chest', spaceId: 'interior:human:center' }
  const saved = groupInteriorBuildings([parent(), custom], 'human')
  assert.equal(saved[0].interiorBuildings[0].label, 'custom-chest')
  assert.equal(saved[0].interiorBuildings[0].spaceId, undefined)
  assert.throws(() => groupInteriorBuildings([custom], 'human'), /missing parent/)
  assert.throws(() => groupInteriorBuildings([parent(), chest(), chest()], 'human'), /Duplicate/)
})

test('restoring an explicitly emptied room does not regenerate default contents', () => {
  const space = {
    building: {
      interiorBuildings: [],
      owner: {
        createBuilding() {
          assert.fail('no defaults')
        },
      },
    },
  }
  ensureInteriorDefaultBuildings({}, space)
  assert.equal(space.defaultBuildingsPlaced, true)
  assert.equal(space.building.interiorBuildings, undefined)
})

test('only stock-backed stable displays are omitted, never released wild horses', () => {
  const { isDerivedInteriorHorse } = loadTsModule('app/serialization/InteriorBuildingSave.ts')
  const stable = { type: 'Stable', label: 'stable', i: 40, j: 40, stableHorses: [{ horseColor: 'black' }] }
  const players = [{ label: 'human', buildings: [stable] }]
  const horse = { type: 'Horse', label: 'interior:human:stable:stable-horse:0', tamingStatus: 'tamed' }
  assert.equal(isDerivedInteriorHorse(horse, players), true)
  assert.equal(isDerivedInteriorHorse({ ...horse, tamingStatus: 'wild' }, players), false)
  stable.isDead = true
  assert.equal(isDerivedInteriorHorse(horse, players), false)
  stable.isDead = false
  stable.stableHorses = []
  assert.equal(isDerivedInteriorHorse(horse, players), false)
})

test('region restore places the saved chest in its room even when exterior cell (11,11) is absent', () => {
  const spaces = new Map()
  const outside = []
  outside[40] = []
  outside[40][40] = {}
  const context = { map: { grid: outside, spaces } }
  const player = {
    label: 'human',
    buildings: [],
    units: [],
    createBuilding(options) {
      const grid = options.spaceId ? spaces.get(options.spaceId).grid : outside
      assert.ok(grid[options.i]?.[options.j], `missing cell for ${options.label}`)
      const building = { ...options, context, owner: player }
      player.buildings.push(building)
      return building
    },
    createUnit(options) {
      return { ...options }
    },
  }
  const { restorePlayerEntitiesFromSave } = loadTsModule('app/classes/map/MapSaveRestore.ts', {
    mocks: {
      '../../../engine/services/BuildingInteriorSpaceSystemRuntime': {
        ensureRuntimeBuildingInteriorSpace(_context, building) {
          const id = `interior:human:${building.label}`
          const grid = []
          grid[11] = []
          grid[11][11] = {}
          const space = { id, grid, building }
          spaces.set(id, space)
          ensureInteriorDefaultBuildings(context, space)
          return space
        },
      },
    },
  })
  const saved = { label: 'human', buildings: [parent(), chest()] }
  normalizeSavedInteriorBuildings(saved)
  restorePlayerEntitiesFromSave(player, saved)
  assert.equal(player.buildings.length, 2)
  const restored = player.buildings.find(building => building.type === 'Chest')
  assert.equal(restored.spaceId, 'interior:human:center')
  assert.deepEqual(restored.inventory, chest().inventory)
  assert.equal(player.food, 20)
  assert.equal(player.wood, 7)
  ensureInteriorDefaultBuildings(context, spaces.get(restored.spaceId))
  assert.equal(player.buildings.length, 2)
  const again = groupInteriorBuildings(
    player.buildings.map(building => ({
      type: building.type,
      label: building.label,
      i: building.i,
      j: building.j,
      isBuilt: true,
      inventory: building.inventory,
      spaceId: building.spaceId,
    })),
    'human'
  )
  assert.equal(again.length, 1)
  assert.deepEqual(again[0].interiorBuildings[0].inventory, chest().inventory)
})

test('offline upkeep consumes interior chest food once without moving that chest outside', () => {
  const { simulateOfflineWorld } = loadTsModule('app/services/world/OfflineWorldSimulation.ts')
  const player = {
    label: 'human',
    type: 'Human',
    population: 1,
    populationMax: 1,
    buildings: [parent(), chest()],
    units: [{ type: 'Villager', label: 'worker', i: 35, j: 35 }],
  }
  normalizeSavedInteriorBuildings(player)
  const state = { players: [player], resources: [], animals: [], world: { mapType: 'world-region' } }
  const options = {
    fromElapsedMs: 0,
    toElapsedMs: 24 * 60000,
    terrain: Array.from({ length: 50 }, () => Array.from({ length: 50 }, () => ({ category: 'Grass' }))),
    unitConfig: () => ({}),
    buildingConfig: () => ({ size: 1 }),
    buildingCapacity: () => 0,
    cycleMs: () => 1000,
    wheatMatureFrame: 1,
  }
  const report = simulateOfflineWorld(state, options)
  assert.equal(report.foodConsumed, 4)
  assert.equal(player.food, 16)
  assert.equal(player.buildings.length, 1)
  const stored = player.buildings[0].interiorBuildings[0]
  assert.equal(stored.i, 11)
  assert.equal(stored.inventory.resources.wheat, 16)
  assert.deepEqual(stored.inventory.equipment, ['hammer'])
})

test('caves have no automatic decorations, including those stored in older saves', () => {
  const calls = []
  const space = {
    id: 'interior:gaia:cave',
    building: { type: 'Cave', owner: { createBuilding: value => calls.push(value) } },
  }
  ensureInteriorDefaultBuildings({}, space)
  assert.equal(space.defaultBuildingsPlaced, true)
  assert.deepEqual(calls, [])
  space.defaultBuildingsPlaced = false
  space.building.interiorBuildings = [{ label: `${space.id}:default:firecamp-center`, type: 'FireCamp', i: 1, j: 1 }]
  ensureInteriorDefaultBuildings({}, space)
  assert.deepEqual(calls, [])
  assert.equal(space.building.interiorBuildings, undefined)
})

test('foreign-owned interior contents retain ownership and loot across save grouping and restore', () => {
  const { groupPlayersInteriorBuildings, savedBuildingsOwnedBy } = loadTsModule(
    'app/serialization/InteriorBuildingSave.ts'
  )
  const cave = { ...parent(), type: 'Cave', label: 'cave' }
  const loot = { ...chest(), label: 'lair-chest', spaceId: 'interior:neutral:cave' }
  const source = [
    { label: 'neutral', buildings: [cave] },
    { label: 'bandits', type: 'Bandits', buildings: [loot] },
  ]
  const result = groupPlayersInteriorBuildings(source)
  assert.equal(result[1].buildings.length, 0)
  const saved = result[0].buildings[0].interiorBuildings[0]
  assert.equal(saved.interiorOwner, 'bandits')
  assert.deepEqual(saved.inventory, loot.inventory)
  assert.equal(savedBuildingsOwnedBy(result[0], result).length, 1)
  assert.deepEqual(savedBuildingsOwnedBy(result[1], result), [saved])
  assert.deepEqual(groupPlayersInteriorBuildings(result), result)
  assert.equal(source[1].buildings.length, 1)
  const restored = []
  const neutral = { createBuilding: () => assert.fail('Wrong owner') }
  const bandits = { label: 'bandits', createBuilding: options => restored.push(options) }
  const space = {
    id: 'interior:neutral:cave',
    building: { ...cave, owner: neutral, interiorBuildings: [saved] },
    grid: [],
  }
  space.grid[saved.i] = []
  space.grid[saved.i][saved.j] = {}
  ensureInteriorDefaultBuildings({ players: [neutral, bandits] }, space)
  assert.equal(restored.length, 1)
  assert.equal(restored[0].spaceId, space.id)
  assert.deepEqual(restored[0].inventory, loot.inventory)
  assert.throws(
    () => groupPlayersInteriorBuildings([{ label: 'neutral', buildings: [{ ...cave, interiorBuildings: [saved] }] }]),
    /Missing interior owner/
  )
})

test('legacy bandit furniture migrates to the bandits without refilling the chest', () => {
  const { groupPlayersInteriorBuildings } = loadTsModule('app/serialization/InteriorBuildingSave.ts')
  const empty = { ...chest(), label: 'interior:neutral:cave:bandit:0:0', inventory: { resources: {}, equipment: [] } }
  const result = groupPlayersInteriorBuildings([
    { label: 'neutral', buildings: [{ ...parent(), type: 'Cave', interiorBuildings: [empty] }] },
    { label: 'bandits', type: 'Bandits', buildings: [] },
  ])
  const saved = result[0].buildings[0].interiorBuildings[0]
  assert.equal(saved.interiorOwner, 'bandits')
  assert.deepEqual(saved.inventory, empty.inventory)
})
