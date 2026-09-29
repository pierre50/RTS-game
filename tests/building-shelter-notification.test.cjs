const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

const { BuildingLifecycle } = loadTsModule('app/classes/building/BuildingLifecycle.ts', {
  mocks: {
    'pixi.js': { AnimatedSprite: class {} },
    '../../lib': { getPercentage: (hp, total) => (hp * 100) / total, updateInstanceVisibility() {} },
    '../../lib/lang': { t: key => key },
    '../../lib/buildings/townCenterClaim': { competingTownCenterSites: () => [] },
    './BuildingSowing': { finishSowingTile: () => false },
    './BuildingDestruction': {},
    './BuildingFinalTexture': {},
    './BuildingFire': {},
    './BuildingVisuals': { clearBuildingConstructionReveal() {}, syncBuildingConstructionReveal() {} },
  },
})

test('only actual construction completion notifies the rest system, once', () => {
  const notifications = []
  const building = {
    type: 'House',
    isBuilt: false,
    hitPoints: 50,
    totalHitPoints: 100,
    owner: { populationMax: 0 },
    context: { menu: {}, unitRest: { notifyShelterAvailable: value => notifications.push(value) } },
    finalTexture() {},
    updateShadow() {},
    scanForInitialTarget() {},
  }
  const lifecycle = new BuildingLifecycle(building)
  building.onBuilt = () => lifecycle.onBuilt()
  lifecycle.updateTexture()
  assert.equal(notifications.length, 0)
  building.hitPoints = 100
  lifecycle.updateTexture()
  lifecycle.updateTexture()
  building.onBuilt() // Activation of an already built/loaded building is not a new construction.
  assert.deepEqual(notifications, [building])
  assert.equal(building.owner.populationMax, 5)
})

test('town center construction supplies no housing', () => {
  const building = {
    type: 'TownCenter', isBuilt: true,
    owner: { population: 2, populationMax: 5 }, context: { menu: {} },
  }
  const lifecycle = new BuildingLifecycle(building)
  lifecycle.onBuilt()
  lifecycle.onBuilt()
  assert.equal(building.owner.population, 2)
  assert.equal(building.owner.populationMax, 5)
})
