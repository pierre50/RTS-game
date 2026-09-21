const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

const { BuildingLifecycle } = loadTsModule('app/classes/building/BuildingLifecycle.ts', {
  mocks: {
    'pixi.js': { AnimatedSprite: class {} },
    '../../lib': { getPercentage: (hp, total) => (hp * 100) / total, updateInstanceVisibility() {} },
    '../../lib/lang': { t: key => key },
    '../../lib/buildings/buildingOccupancy': { getBuildingShelterCapacity: () => 5 },
    './BuildingDestruction': {},
    './BuildingFinalTexture': {},
    './BuildingFire': {},
    './BuildingVisuals': { clearBuildingConstructionReveal() {}, syncBuildingConstructionReveal() {} },
  },
})

function fixture() {
  const messages = []
  const context = { players: [], menu: { showMessage: (...args) => messages.push(args) } }
  const makeOwner = factionId => {
    const owner = {
      factionId,
      isPlayed: factionId === 'b',
      buildings: [],
      units: [{}],
      populationMax: 0,
      hasBuilt: [],
      wood: 50,
    }
    context.players.push(owner)
    return owner
  }
  const makeBuilding = (owner, type = 'TownCenter', isBuilt = false) => {
    const building = {
      owner,
      context,
      type,
      isBuilt,
      hitPoints: 100,
      totalHitPoints: 100,
      finalTexture() {},
      updateShadow() {},
      scanForInitialTarget() {},
      die() {
        this.isDead = true
        owner.buildings = owner.buildings.filter(candidate => candidate !== this)
      },
    }
    const lifecycle = new BuildingLifecycle(building)
    building.onBuilt = () => lifecycle.onBuilt()
    building.finish = () => lifecycle.updateTexture()
    owner.buildings.push(building)
    return building
  }
  const a = makeOwner('a')
  const b = makeOwner('b')
  return { a, b, makeBuilding, messages }
}

test('first completion destroys rival sites without a refund or transferring other assets', () => {
  const { a, b, makeBuilding, messages } = fixture()
  const winner = makeBuilding(a)
  const loser = makeBuilding(b)
  const house = makeBuilding(b, 'House', true)
  const houseSite = makeBuilding(b, 'House')
  winner.finish()
  // A queued callback for the other worker in the same update cannot revive its site.
  loser.finish()
  assert.equal(winner.isBuilt, true)
  assert.equal(loser.isDead, true)
  assert.equal(loser.isBuilt, false)
  assert.equal(loser.hitPoints, 0)
  assert.deepEqual(b.buildings, [house, houseSite])
  assert.equal(house.owner, b)
  assert.equal(b.units.length, 1)
  assert.equal(b.wood, 50)
  assert.equal(a.populationMax, 5)
  assert.equal(b.populationMax, 0)
  assert.deepEqual(messages, [['townCenterConstructionLost', 'warning']])
  winner.onBuilt()
  assert.equal(a.populationMax, 5)
  assert.equal(messages.length, 1)
})

test('completion ordering deterministically decides the winner, not player order', () => {
  const { a, b, makeBuilding } = fixture()
  const first = makeBuilding(a)
  const second = makeBuilding(b)
  second.finish()
  first.finish()
  assert.equal(first.isDead, true)
  assert.equal(first.isBuilt, false)
  assert.equal(second.isBuilt, true)
  assert.equal(second.isDead, undefined)
})
