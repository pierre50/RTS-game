const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function loadMapPlayerGeneration() {
  const calls = { ensureBanditCampOwner: [] }
  class Human {
    constructor(props) {
      Object.assign(this, props, { type: 'Human' })
    }
  }
  class AI {
    constructor(props) {
      Object.assign(this, props, { type: 'AI' })
    }
  }

  const module = loadTsModule('app/classes/map/MapPlayerGeneration.ts', {
    mocks: {
      '../../lib': { playerColors: ['blue', 'red', 'green'] },
      '../../constants': {
        BUILDING_TYPES: { townCenter: 'TownCenter' },
        RESOURCE_NAMES: ['wood', 'food', 'stone', 'gold', 'copper', 'iron'],
        PLAYER_TYPES: { ai: 'AI', bandits: 'Bandits' },
        POPULATION_MAX: 200,
        UNIT_TYPES: { chief: 'Chief', hero: 'Hero', villager: 'Villager' },
      },
      '../../lib/resources/playerResourceTotals': {
        syncPlayerResourceFieldsFromChests: player => {
          player.syncedResources = true
        },
      },
      '../players': { AI, Human },
      './BanditCampGeneration': {
        ensureBanditCampOwner: (_map, _context, anchor, civ, players, options = {}) => {
          calls.ensureBanditCampOwner.push({ anchor, civ, options })
          players.push({ type: 'Bandits', isPlayed: false, civ: options.civ ?? civ, ...options })
        },
      },
      './CivilizationStartingKit': { applyCivilizationLevelStartingKit: () => {} },
    },
  })

  return { ...module, calls }
}

function createMap(portalEncounter) {
  return {
    allTechnologies: false,
    banditCampPositions: [],
    context: {
      app: {},
      gamebox: {},
      map: {},
      scheduler: {},
    },
    difficulty: 'hard',
    noAI: false,
    playersPos: [
      { i: 4, j: 5 },
      { i: 40, j: 50 },
    ],
    portalEncounter,
    randomItem: items => items[0],
    startingAge: 0,
    startingResources: { wood: 200, food: 200, stone: 150, gold: 0, copper: 0, iron: 0 },
    startingUnits: 3,
  }
}

test('village portal encounters spawn a real AI village player', () => {
  const { generatePlayers, calls } = loadMapPlayerGeneration()
  const players = generatePlayers(createMap('village'), [
    { civ: 'Hellas', isHuman: true },
    { civ: 'Kemet', isHuman: false, name: 'Delta' },
  ])

  assert.deepEqual(
    players.map(player => player.type),
    ['Human', 'AI']
  )
  assert.equal(players[1].civ, 'Kemet')
  assert.equal(players[1].difficulty, 'hard')
  assert.equal(calls.ensureBanditCampOwner.length, 0)
})

test('bandit portal encounters turn the non-human spawn into a bandit camp', () => {
  const { generatePlayers, calls } = loadMapPlayerGeneration()
  const map = createMap('bandit')
  const players = generatePlayers(map, [
    { civ: 'Hellas', isHuman: true },
    { civ: 'Kemet', color: 'grey', factionId: 'bandits', isHuman: false, name: 'Bandits' },
  ])

  assert.deepEqual(
    players.map(player => player.type),
    ['Human', 'Bandits']
  )
  assert.deepEqual(map.banditCampPositions, [{ i: 40, j: 50 }])
  assert.deepEqual(calls.ensureBanditCampOwner, [
    {
      anchor: { i: 40, j: 50 },
      civ: 'Hellas',
      options: { civ: 'Kemet', color: 'grey', factionId: 'bandits', name: 'Bandits' },
    },
  ])
  assert.equal(players[1].factionId, 'bandits')
})

test('starting town center receives the map starting resources in its inventory', () => {
  const { placePlayers } = loadMapPlayerGeneration()
  const townCenter = {
    inventory: null,
    placeUnit: () => true,
    type: 'TownCenter',
  }
  const player = {
    i: 4,
    isPlayed: true,
    j: 5,
    spawnBuilding: () => townCenter,
    type: 'Human',
  }
  const map = createMap('village')
  map.context.players = [player]

  placePlayers(map)

  assert.deepEqual(townCenter.inventory.resources, map.startingResources)
  assert.equal(player.syncedResources, true)
})
