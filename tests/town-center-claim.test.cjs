const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

const { BuildingLifecycle } = loadTsModule('app/classes/building/BuildingLifecycle.ts', {
  mocks: {
    'pixi.js': { AnimatedSprite: class {} },
    '../../lib': { getPercentage: (hp, total) => (hp * 100) / total, updateInstanceVisibility() {} },
    '../../lib/lang': { t: key => key },
    './BuildingSowing': { finishSowingTile: () => false },
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

for (const sameOwner of [false, true]) {
  test(`town centers complete independently for ${sameOwner ? 'the same faction' : 'different factions'}`, () => {
    const { a, b, makeBuilding, messages } = fixture()
    const first = makeBuilding(a)
    const second = makeBuilding(sameOwner ? a : b)
    first.finish()
    assert.equal(second.isDead, undefined)
    assert.equal(second.hitPoints, 100)
    second.finish()
    assert.equal(first.isBuilt, true)
    assert.equal(second.isBuilt, true)
    assert.equal(second.isDead, undefined)
    assert.equal(a.populationMax, 0)
    assert.equal(b.populationMax, 0)
    assert.deepEqual(messages, [])
    first.onBuilt()
    second.onBuilt()
    assert.equal(a.populationMax, 0)
  })
}
