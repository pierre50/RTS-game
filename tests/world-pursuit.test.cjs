const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function collectionFixture() {
  const api = loadTsModule('app/screens/game/GameWorldPursuers.ts')
  const hero = { label: 'hero', i: 4, j: 4 }
  const follower = { label: 'follower', i: 4, j: 5, followingHero: true }
  const soldier = { label: 'soldier', type: 'Villager', i: 4, j: 3, sight: 5, dest: follower, hitPoints: 21, gender: 'female', assetCiv: 'Hellas', inventory: { equipment: ['sword'] } }
  const wolf = { label: 'wolf', type: 'Wolf', i: 3, j: 4, sight: 5, dest: hero, hitPoints: 12 }
  const far = { ...wolf, label: 'far', i: 40 }
  const dead = { ...soldier, label: 'dead', isDead: true }
  const idle = { ...soldier, label: 'idle', dest: null }
  const interior = { ...soldier, label: 'inside', spaceId: 'interior:house' }
  const players = [{ label: 'human', units: [hero, follower], isPlayed: true }, { label: 'enemy', color: 'red', units: [soldier, dead, idle, interior] }]
  const snapshot = structuredClone({ players, animals: [wolf, far], resources: [], map: [[{ has: 'soldier' }]] })
  const context = { players, map: { gaia: { animals: [wolf, far] } } }
  return { ...api, context, snapshot, party: { hero, followers: [follower] } }
}

test('only living pursuers targeting a visible travelling party member cross the border', () => {
  const { collectWorldPursuers, context, snapshot, party } = collectionFixture()
  const pursuers = collectWorldPursuers(context, snapshot, party)
  assert.deepEqual(pursuers.map(entry => [entry.entity.label, entry.targetLabel]), [['soldier', 'follower'], ['wolf', 'hero']])
  assert.equal(pursuers[0].owner.color, 'red')
  assert.equal(pursuers[0].entity.gender, 'female')
  assert.deepEqual(pursuers[0].entity.inventory, { equipment: ['sword'] })
})

test('departure save loses pursuers and occupied cell references, while the rollback snapshot stays intact', () => {
  const { collectWorldPursuers, removeWorldPursuers, context, snapshot, party } = collectionFixture()
  const departure = removeWorldPursuers(snapshot, collectWorldPursuers(context, snapshot, party))
  assert.equal(departure.players[1].units.some(unit => unit.label === 'soldier'), false)
  assert.deepEqual(departure.animals.map(animal => animal.label), ['far'])
  assert.equal(departure.map[0][0].has, undefined)
  assert.equal(snapshot.map[0][0].has, 'soldier')
  assert.equal(snapshot.players[1].units[0].label, 'soldier')
})

function runtimeFixture() {
  const { ActionScheduler } = loadTsModule('app/lib/actionScheduler.ts')
  const spawns = []
  const sent = []
  const removed = []
  const context = {
    paused: false,
    players: [{ label: 'human', units: [{ label: 'hero', i: 10, j: 10 }] }],
    map: { open: true },
    menu: { refreshMiniMap() {} },
  }
  function create(state) {
    spawns.push(structuredClone(state))
    return { ...state, sendTo: (target, action) => sent.push([target.label, action]) }
  }
  context.map.gaia = { createAnimal: create }
  context.scheduler = new ActionScheduler({ ticker: { add() {}, remove: callback => removed.push(callback) } }, () => context.paused)
  const { WorldPursuitSystem } = loadTsModule('app/services/world/WorldPursuitSystem.ts', {
    mocks: {
      '../../classes/players': {
        AI: class { constructor(options) { Object.assign(this, options) } createUnit(state) { return create(state) } },
        Player: class { constructor(options) { Object.assign(this, options) } createUnit(state) { return create(state) } },
      },
      '../../lib': { updateInstanceVisibility() {} },
      './WorldRegionTravelSystem': { findOpenWorldTravelCell: (map, anchor) => map.open ? { ...anchor, x: 32, y: 48, z: 0 } : null },
    },
  })
  const entry = {
    entity: { label: 'enemy-1', type: 'Villager', i: 50, j: 51, x: 1000, y: 1100, hitPoints: 21, gender: 'female', appearanceVariants: { hair: 'black' }, inventory: { equipment: ['sword'], equipped: { mainhand: 'sword' } }, mountedOnHorse: true, horseColor: 'black', action: 'attack', path: [{ i: 49, j: 51 }] },
    owner: { label: 'enemy', type: 'AI', civ: 'Hellas', color: 'red', factionId: 'enemy-faction', units: [], buildings: [], corpses: [] },
    targetLabel: 'hero', arrival: { i: 1, j: 7 }, remainingMs: 3000,
  }
  return { context, entry, spawns, sent, WorldPursuitSystem }
}

test('pursuers arrive after three game seconds, preserving appearance, equipment, ownership and target', () => {
  const { context, entry, spawns, sent, WorldPursuitSystem } = runtimeFixture()
  const system = new WorldPursuitSystem(context)
  system.enqueue([entry])
  context.paused = true
  context.scheduler._tick(5000)
  assert.equal(spawns.length, 0)
  context.paused = false
  context.scheduler._tick(2900)
  assert.equal(spawns.length, 0)
  context.scheduler._tick(100)
  assert.equal(spawns.length, 1)
  assert.deepEqual([spawns[0].i, spawns[0].j], [1, 7])
  for (const key of ['label', 'type', 'hitPoints', 'gender', 'appearanceVariants', 'inventory', 'mountedOnHorse', 'horseColor']) assert.deepEqual(spawns[0][key], entry.entity[key])
  assert.deepEqual(spawns[0].path, [])
  assert.equal(context.players[1].color, 'red')
  assert.deepEqual(sent, [['hero', 'attack']])
  context.scheduler._tick(5000)
  assert.equal(spawns.length, 1)
  assert.deepEqual(system.serializeState(), [])
  system.destroy()
})

test('pending animal arrival survives saving and unloading, and waits for a free border cell', () => {
  const { context, entry, spawns, WorldPursuitSystem } = runtimeFixture()
  delete entry.owner
  entry.entity.type = 'Wolf'
  const original = new WorldPursuitSystem(context)
  original.enqueue([entry])
  context.scheduler._tick(1200)
  const saved = JSON.parse(JSON.stringify(original.serializeState()))
  assert.equal(saved[0].remainingMs, 1800)
  original.destroy()
  context.scheduler._tick(4000)
  assert.equal(spawns.length, 0)
  const restored = new WorldPursuitSystem(context)
  restored.restore(saved)
  context.map.open = false
  context.scheduler._tick(2000)
  assert.equal(spawns.length, 0)
  context.map.open = true
  context.scheduler._tick(100)
  assert.equal(spawns.length, 1)
  assert.equal(spawns[0].type, 'Wolf')
  assert.equal(context.players.length, 1)
  restored.destroy()
})
