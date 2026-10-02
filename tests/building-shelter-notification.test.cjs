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
    type: 'CampBedroll',
    isBuilt: false,
    hitPoints: 50,
    totalHitPoints: 100,
    owner: { populationMax: 0 },
    context: { menu: {}, unitRest: { notifyBedAvailable: value => notifications.push(value) } },
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
  assert.equal(building.owner.populationMax, 1)
})

test('town center construction supplies no housing', () => {
  const building = {
    type: 'TownCenter',
    isBuilt: true,
    owner: { population: 2, populationMax: 1, buildings: [{ type: 'CampBedroll', isBuilt: true }] },
    context: { menu: {} },
  }
  const lifecycle = new BuildingLifecycle(building)
  lifecycle.onBuilt()
  lifecycle.onBuilt()
  assert.equal(building.owner.population, 2)
  assert.equal(building.owner.populationMax, 1)
})

test('renovation completion refreshes exterior and restores existing beds without adding housing', () => {
  const definition = require('../public/assets/data/gameplay/buildings.json').House
  let textures = 0
  let notifications = 0
  const chest = { inventory: { resources: { wood: 40 } } }
  const building = {
    type: 'House',
    isBuilt: true,
    buildingLevel: 0,
    hitPoints: 60,
    totalHitPoints: 75,
    shelterCapacity: 5,
    buildingUpgrade: { targetLevel: 1, hitPoints: 125, totalHitPoints: 125, constructionTime: 48 },
    owner: { populationMax: 5, config: { buildings: { House: definition } } },
    context: { menu: {}, unitRest: { notifyBedAvailable: () => notifications++ } },
    interiorBuildings: [chest, { type: 'CampBedroll', isBuilt: true }],
    finalTexture: () => textures++,
  }
  building.owner.buildings = [building]
  const lifecycle = new BuildingLifecycle(building)
  lifecycle.updateHitPoints('build')
  assert.equal(building.buildingUpgrade, undefined)
  assert.equal(building.buildingLevel, 1)
  assert.equal(building.hitPoints, 110)
  assert.equal(building.totalHitPoints, 125)
  assert.equal(building.owner.populationMax, 1)
  assert.equal(building.interiorBuildings[0], chest)
  assert.equal(textures, 1)
  assert.equal(notifications, 1)
})
