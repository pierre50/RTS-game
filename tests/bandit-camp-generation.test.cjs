const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function loadBanditCampGeneration(furnishBanditCave = () => {}, uniqueCandidates = false, respawnStates = []) {
  return loadTsModule('app/classes/map/BanditCampGeneration.ts', {
    mocks: {
      '../../lib/camps/campRespawnState': { campRespawnStates: () => respawnStates },
      './BanditCaveGeneration': { furnishBanditCave },
      '../players': {
        AI: class AI {
          constructor(options) {
            Object.assign(this, options)
          }
        },
      },
      '../../lib': {
        canPlaceBuildingAt: () => true,
        getPlainCellsAroundPoint: (i, j, _grid, _distance, predicate) => {
          if (uniqueCandidates && _distance >= 2)
            return Array.from({ length: 10 }, (_, index) => ({
              i: i + index - 5,
              j: j + _distance,
              category: 'Land',
              solid: false,
              has: null,
            })).filter(predicate)
          const cell = { i, j, category: 'Land', solid: false, has: null }
          return predicate(cell) ? [cell] : []
        },
      },
      '../../lib/units/unitExperience': {
        getUnitOverallLevel: () => 0,
      },
      '../../constants': {
        BUILDING_TYPES: {
          campAnimalBones: 'CampAnimalBones',
          campBoneSmall: 'CampBoneSmall',
          campBucket: 'CampBucket',
          campCrate: 'CampCrate',
          campDryingRack: 'CampDryingRack',
          campFencePost: 'CampFencePost',
          campJarLarge: 'CampJarLarge',
          campJarSmall: 'CampJarSmall',
          campMeatRack: 'CampMeatRack',
          campRockPile: 'CampRockPile',
          campSkull: 'CampSkull',
          campTotemHorns: 'CampTotemHorns',
          campTotemPlain: 'CampTotemPlain',
          campTotemSkull: 'CampTotemSkull',
          chest: 'Chest',
          fireCamp: 'FireCamp',
        },
        PLAYER_TYPES: { bandits: 'Bandits' },
        UNIT_TYPES: {
          banditArcher: 'BanditArcher',
          banditChief: 'BanditChief',
          banditSword: 'BanditSword',
          hero: 'Hero',
        },
        WORK_TYPES: { attacker: 'attacker' },
      },
    },
  })
}

function createBanditOwner() {
  const owner = {
    buildings: [],
    config: { buildings: {} },
    label: 'bandits',
    name: 'Bandits',
    population: 0,
    type: 'Bandits',
    createBuilding(options) {
      this.buildings.push(options)
      return options
    },
    createUnit(options) {
      return options
    },
  }
  for (const type of [
    'CampAnimalBones',
    'CampBoneSmall',
    'CampBucket',
    'CampCrate',
    'CampDryingRack',
    'CampFencePost',
    'CampJarLarge',
    'CampJarSmall',
    'CampMeatRack',
    'CampRockPile',
    'CampSkull',
    'CampTotemHorns',
    'CampTotemPlain',
    'CampTotemSkull',
    'Chest',
    'FireCamp',
  ]) {
    owner.config.buildings[type] = { size: 1 }
  }
  return owner
}

test('quest camps reuse outdoor fires, furniture, chest and patrol units without a cave', () => {
  const { placeOutdoorBanditQuestCamp } = loadBanditCampGeneration(() => assert.fail('No cave for quest camps'))
  const owner = createBanditOwner()
  owner.units = [{ label: 'existing' }]
  owner.createUnit = options => {
    const unit = { ...options, label: 'guard-' + owner.units.length }
    owner.units.push(unit)
    return unit
  }
  const map = { context: { players: [owner] }, grid: [], randomItem: items => items[0], randomRange: min => min }
  const guards = placeOutdoorBanditQuestCamp(map, map.context, { i: 30, j: 30 })
  assert.equal(guards.length, 3)
  assert.ok(guards.every(unit => unit.banditCampAnchor && unit.campPatrolAnchor))
  assert.ok(guards.some(unit => unit.type === 'BanditChief'))
  assert.ok(owner.buildings.some(building => building.type === 'FireCamp'))
  assert.ok(owner.buildings.some(building => building.type === 'Chest' && building.inventory))
  assert.ok(owner.buildings.some(building => building.type.startsWith('Camp')))
  assert.ok(!guards.some(unit => unit.label === 'existing'))
})

test('bandit camps place a bandit-owned chest with loot', () => {
  const { placeBanditCamps } = loadBanditCampGeneration()
  const owner = createBanditOwner()
  const map = {
    banditCampPositions: [{ i: 20, j: 20 }],
    context: {
      players: [owner],
    },
    grid: [],
    noAI: false,
    randomItem: items => items[0],
    randomRange: min => min,
  }

  placeBanditCamps(map, map.context)

  const chest = owner.buildings.find(building => building.type === 'Chest')
  assert.ok(chest)
  assert.equal(chest.isBuilt, true)
  assert.deepEqual(chest.inventory.resources, { berry: 2, meat: 2, wheat: 4, gold: 2, wood: 3 })
  assert.equal(chest.inventory.equipment.filter(item => item === 'arrow_ceramic').length, 6)
  assert.ok(chest.inventory.equipment.includes('trap'))
  assert.ok(chest.inventory.equipment.includes('sword_ceramic'))
  assert.equal(chest.i, 18)
  assert.equal(chest.j, 17)
})

test('linked camps keep one fire and guards outside and move all furniture into their cave', () => {
  const calls = []
  const { placeBanditCamps } = loadBanditCampGeneration((...args) => calls.push(args))
  const owner = createBanditOwner()
  const cave = { cave: { id: 'lair' } }
  const map = {
    banditCampPositions: [{ i: 24, j: 24, caveId: 'lair' }],
    context: { players: [owner, { buildings: [cave] }] },
    grid: [],
    noAI: false,
    randomItem: items => items[0],
    randomRange: min => min,
  }
  placeBanditCamps(map, map.context)
  assert.deepEqual(
    owner.buildings.map(item => item.type),
    ['FireCamp']
  )
  assert.equal(owner.population, 3)
  assert.equal(calls.length, 1)
  assert.equal(calls[0][1], cave)
  assert.ok(calls[0][4].equipment.length > 0)
})

test('authored lairs keep their roster and defer the saved cave payload until first access', () => {
  const { placeBanditCamps } = loadBanditCampGeneration(() => assert.fail('Interior should stay lazy'), true)
  const owner = createBanditOwner()
  const cave = { cave: { id: 'test-cave', seed: 4 } }
  owner.units = []
  owner.createUnit = options => {
    owner.units.push(options)
    return options
  }
  const map = {
    noAI: true,
    seed: 10,
    banditCampPositions: [
      {
        i: 30,
        j: 30,
        id: 'camp',
        caveId: 'test-cave',
        seed: 99,
        profile: 'lair',
        unitTypes: ['BanditChief', 'BanditSword', 'BanditArcher', 'BanditSword', 'BanditSword'],
      },
    ],
    context: { players: [owner, { buildings: [cave] }] },
    grid: [],
  }
  placeBanditCamps(map, map.context)
  assert.equal(cave.cave.banditContent.ownerLabel, 'bandits')
  assert.ok(cave.cave.banditContent.inventory)
  assert.equal(cave.cave.banditContent.generated, undefined)
  assert.deepEqual(
    owner.units.map(unit => unit.type),
    map.banditCampPositions[0].unitTypes
  )
  assert.ok(owner.units.every(unit => unit.campBehavior.caveId === 'test-cave'))
  assert.ok(owner.units.every(unit => unit.label.startsWith('camp:unit-')))
  assert.ok(!owner.buildings.some(building => building.type === 'Chest'))
})

test('respawn reuses initial sites and rosters without duplicating scenery or loot', () => {
  const states = []
  const { placeBanditCamps, respawnBanditCamp } = loadBanditCampGeneration(() => {}, true, states)
  const owner = createBanditOwner()
  owner.units = []
  owner.createUnit = options => {
    owner.units.push(options)
    return options
  }
  const grid = []
  grid[30] = []
  grid[30][30] = { i: 30, j: 30 }
  const map = {
    grid,
    seed: 1,
    randomItem: items => items[0],
    randomRange: min => min,
    banditCampPositions: [
      { id: 'original', i: 30, j: 30, profile: 'small', seed: 1, unitTypes: ['BanditSword', 'BanditArcher'] },
    ],
    context: { players: [owner] },
  }
  placeBanditCamps(map, map.context)
  assert.equal(states.length, 1)
  assert.deepEqual(
    states[0].unitTypes,
    owner.units.map(unit => unit.type)
  )
  const sceneryCount = owner.buildings.length
  const labels = new Set(owner.units.map(unit => unit.label))
  owner.units = []
  assert.equal(respawnBanditCamp(map, map.context, states[0]), true)
  assert.equal(owner.buildings.length, sceneryCount)
  assert.deepEqual(
    owner.units.map(unit => unit.type),
    states[0].unitTypes
  )
  assert.ok(owner.units.every(unit => !labels.has(unit.label)))
  assert.equal(states[0].generation, 1)
  owner.buildings.find(building => building.type === 'FireCamp').isDead = true
  owner.units = []
  assert.equal(respawnBanditCamp(map, map.context, states[0]), true)
  assert.equal(owner.buildings.length, sceneryCount + 1)
  assert.equal(owner.buildings.filter(building => building.type === 'FireCamp' && !building.isDead).length, 1)
})
