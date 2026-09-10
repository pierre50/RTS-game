const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function loadOwnerTransfer(calls = []) {
  return loadTsModule('app/lib/entities/entityOwnerTransfer.ts', {
    mocks: {
      '../../constants': {
        FAMILY_TYPES: { building: 'building', unit: 'unit' },
        SHEET_TYPES: { standing: 'standing' },
        UNIT_TYPES: { villager: 'Villager' },
      },
      '../combat/bandits': {
        isBanditOwner: owner => Boolean(owner?.devConsoleBanditOwner),
      },
      '../buildings/buildingOccupancy': {
        getBuildingShelterCapacity: building => building.shelterCapacity ?? 0,
      },
      '../grid/visibility': {
        updateInstanceVisibility: target => calls.push(['updateInstanceVisibility', target.label, target.owner.label]),
      },
      '../lang': {
        t: key => key,
      },
      './entityHealthDisplay': {
        syncEntityHealthDisplay: () => calls.push(['syncEntityHealthDisplay']),
      },
      '../playerState': {
        isPlayerEliminated: player =>
          !player.units?.some(unit => !unit.isDead && (unit.hitPoints ?? 0) > 0) &&
          !player.buildings?.some(building => !building.isDead && (building.hitPoints ?? 0) > 0 && building.isBuilt),
      },
    },
  })
}

function makePlayer(label, anchors = []) {
  return {
    buildings: anchors.filter(anchor => anchor.family === 'building'),
    color: label,
    hasBuilt: [],
    i: 0,
    isPlayed: false,
    j: 0,
    label,
    population: 0,
    populationMax: 0,
    units: anchors.filter(anchor => anchor.family === 'unit'),
  }
}

function makeBuilding(label, owner, i, j) {
  const building = {
    clearRallyPoint() {},
    family: 'building',
    finalTexture() {},
    hitPoints: 100,
    i,
    interface: {},
    isBuilt: true,
    j,
    label,
    loading: 10,
    owner,
    queue: ['Villager'],
    selected: false,
    technology: { type: 'ToolAge' },
    type: 'Chest',
  }
  owner.buildings.push(building)
  return building
}

test('defeated player buildings transfer to the only remaining player', () => {
  const calls = []
  const { transferDefeatedPlayerBuildings } = loadOwnerTransfer(calls)
  const winner = makePlayer('winner', [{ family: 'unit', hitPoints: 10, i: 1, isDead: false, j: 1 }])
  const defeated = makePlayer('defeated')
  const chest = makeBuilding('chest-1', defeated, 8, 8)
  defeated.context = {
    menu: {
      isMiniMapActive: () => false,
      showMessage: (message, type) => calls.push(['showMessage', message, type]),
      updateTopbar: () => calls.push(['updateTopbar']),
    },
    player: winner,
    players: [winner, defeated],
  }
  winner.isPlayed = true

  assert.equal(transferDefeatedPlayerBuildings(defeated), 1)
  assert.equal(chest.owner, winner)
  assert.equal(defeated.buildings.includes(chest), false)
  assert.equal(winner.buildings.includes(chest), true)
  assert.deepEqual(chest.queue, [])
  assert.equal(chest.loading, null)
  assert.deepEqual(
    calls.filter(([name]) => name === 'updateTopbar'),
    [['updateTopbar']]
  )
  assert.deepEqual(
    calls.filter(([name]) => name === 'showMessage'),
    [['showMessage', 'enemyBaseCaptured', 'success']]
  )
})

test('defeated player buildings transfer to the nearest remaining player', () => {
  const { transferDefeatedPlayerBuildings } = loadOwnerTransfer()
  const west = makePlayer('west', [{ family: 'unit', hitPoints: 10, i: 2, isDead: false, j: 2 }])
  const east = makePlayer('east', [{ family: 'building', hitPoints: 100, i: 20, isBuilt: true, j: 20 }])
  const defeated = makePlayer('defeated')
  const westChest = makeBuilding('west-chest', defeated, 3, 2)
  const eastChest = makeBuilding('east-chest', defeated, 18, 19)
  defeated.context = {
    menu: { isMiniMapActive: () => false },
    player: west,
    players: [west, east, defeated],
  }

  assert.equal(transferDefeatedPlayerBuildings(defeated), 2)
  assert.equal(westChest.owner, west)
  assert.equal(eastChest.owner, east)
  assert.equal(west.buildings.includes(westChest), true)
  assert.equal(east.buildings.includes(eastChest), true)
})

test('unit transfers move membership and population once and clear interrupted runtime actions', () => {
  const calls = []
  const { transferEntityOwner } = loadOwnerTransfer(calls)
  const oldOwner = makePlayer('old')
  const newOwner = makePlayer('new')
  oldOwner.population = 1
  oldOwner.civ = 'OldCiv'
  oldOwner.age = 2
  newOwner.updatePopulationObjectives = () => calls.push(['milestone'])
  const target = {
    family: 'unit',
    label: 'u',
    type: 'Villager',
    owner: oldOwner,
    action: 'attack',
    dest: {},
    path: [{}],
    pendingOrder: {},
    actionLocked: true,
    energyWaitTaskId: 0,
    context: { scheduler: { remove: id => calls.push(['remove', id]) } },
    sprite: { onLoop() {}, onComplete() {}, onFrameChange() {} },
    setTextures: sheet => calls.push(['texture', sheet]),
    stopInterval: () => calls.push(['stop']),
  }
  oldOwner.units.push(target)
  assert.equal(transferEntityOwner(target, newOwner), true)
  assert.equal(target.owner, newOwner)
  assert.deepEqual(oldOwner.units, [])
  assert.deepEqual(newOwner.units, [target])
  assert.equal(oldOwner.population, 0)
  assert.equal(newOwner.population, 1)
  assert.equal(target.assetCiv, 'OldCiv')
  assert.equal(target.assetAge, 2)
  assert.equal(target.action, null)
  assert.equal(target.dest, null)
  assert.equal(target.pendingOrder, null)
  assert.equal(target.actionLocked, false)
  assert.deepEqual(target.path, [])
  assert.equal(target.sprite.onLoop, undefined)
  assert.ok(calls.some(call => call[0] === 'remove' && call[1] === 0))
  assert.ok(calls.some(call => call[0] === 'milestone'))
  assert.equal(transferEntityOwner(target, newOwner), false)
  assert.equal(newOwner.population, 1)
})

test('unsupported entities and disallowed owners leave ownership and runtime state untouched', () => {
  const { transferEntityOwner } = loadOwnerTransfer()
  const oldOwner = makePlayer('old')
  const newOwner = makePlayer('new')
  const target = { family: 'resource', owner: oldOwner, action: 'work', path: [{}] }
  const path = target.path
  assert.equal(transferEntityOwner(target, newOwner), false)
  assert.equal(target.owner, oldOwner)
  assert.equal(target.action, 'work')
  assert.equal(target.path, path)
  target.family = 'unit'
  newOwner.devConsoleBanditOwner = true
  assert.equal(transferEntityOwner(target, newOwner), false)
  assert.equal(target.owner, oldOwner)
})
