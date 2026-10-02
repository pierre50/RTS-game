const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { getPopulationCapacityFromBuildings: capacity, refreshPopulationCapacity, getBuildingBedCount } =
  loadTsModule('app/lib/buildings/buildingOccupancy.ts')
const bed = (extra = {}) => ({ type: 'CampBedroll', isBuilt: true, ...extra })
const house = (extra = {}) => ({ type: 'House', label: 'home', isBuilt: true, ...extra })

test('only completed living beds create places, independent of occupation and house level', () => {
  assert.equal(capacity([
    house({ shelterCapacity: 100, buildingLevel: 3 }), { type: 'FireCamp', isBuilt: true },
    bed(), bed({ isBuilt: false }), bed({ isDead: true }), bed({ isDestroyed: true }),
    bed({ buildingUpgrade: {} }),
  ]), 1)
})

test('saved and loaded interiors have identical capacity without double counting during restore', () => {
  const owner = { label: 'village' }
  const savedBed = bed({ label: 'bed' })
  const home = house({ interiorBuildings: [savedBed] })
  assert.equal(capacity([home], owner), 1)
  const liveBed = bed({ label: 'bed', spaceId: 'interior:village:home' })
  assert.equal(capacity([home, liveBed], owner), 1)
  delete home.interiorBuildings
  assert.equal(capacity([home, liveBed], owner), 1)
  assert.equal(getBuildingBedCount(home, { ...owner, buildings: [home, liveBed] }), 1)
  home.buildingUpgrade = { targetLevel: 1 }
  assert.equal(capacity([home, liveBed], owner), 0)
  assert.equal(getBuildingBedCount(home, { ...owner, buildings: [home, liveBed] }), 1)
  delete home.buildingUpgrade
  assert.equal(capacity([home, liveBed], owner), 1)
  home.isDead = true
  assert.equal(capacity([home, liveBed], owner), 0)
})

test('unavailable enclosures and foreign-owned saved beds never inflate population', () => {
  for (const state of [{ isBuilt: false }, { isDead: true }, { isDestroyed: true }, { buildingUpgrade: {} }]) {
    assert.equal(capacity([house({ ...state, interiorBuildings: [bed()] })]), 0)
  }
  assert.equal(capacity([bed({ spaceId: 'interior:missing' })]), 0)
  assert.equal(capacity([house({ interiorBuildings: [bed({ interiorOwner: 'enemy' }), bed()] })], { label: 'village' }), 1)
})

test('construction and destruction recount capacity without removing existing inhabitants', () => {
  const owner = { population: 4, populationMax: 999, buildings: [] }
  const mattress = bed()
  assert.equal(refreshPopulationCapacity(owner, mattress), 1)
  owner.buildings.push(mattress)
  assert.equal(refreshPopulationCapacity(owner, mattress), 1)
  mattress.isDead = true
  assert.equal(refreshPopulationCapacity(owner), 0)
  assert.equal(owner.population, 4)
})
