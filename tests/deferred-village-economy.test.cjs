const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const gameplay = loadTsModule('app/config/gameplay.ts')
const { advanceDeferredVillage } = loadTsModule('app/services/world/distantVillages/DeferredVillageEconomy.ts', {
  mocks: {
    'pixi.js': { Assets: { cache: { get: () => undefined } } },
    '../../config/gameplay': { ...gameplay, DAY_NIGHT_CONFIG: { ...gameplay.DAY_NIGHT_CONFIG, startHour: 8 } },
  },
})
function fixture(mode) {
  const grid = Array.from({ length: 70 }, (_, i) =>
    Array.from({ length: 70 }, (_, j) => ({ i, j, category: 'Land', z: 0 }))
  )
  const resource = {
    type: 'Tree',
    family: 'resource',
    label: 'tree',
    i: 22,
    j: 20,
    quantity: 100,
    totalQuantity: 100,
    hitPoints: 0,
    die() {
      this.isDestroyed = true
    },
  }
  grid[22][20].has = resource
  const state = {
    type: 'AI',
    developmentMode: mode,
    settlementType: 'village',
    label: 'village',
    population: 1,
    populationMax: 1,
    units: [
      {
        label: 'worker',
        type: 'Villager',
        i: 20,
        j: 20,
        work: 'woodcutter',
        autonomousJob: 'wood',
        hitPoints: 18,
        totalHitPoints: 18,
      },
    ],
    buildings: [
      { type: 'StoragePit', label: 'pit', i: 16, j: 20, isBuilt: true, inventory: { resources: {} } },
      { type: 'Granary', label: 'grain', i: 16, j: 25, isBuilt: true, inventory: { resources: { wheat: 100 } } },
    ],
  }
  const owner = {
    config: {
      buildings: { StoragePit: { size: 2 }, Granary: { size: 2 } },
      units: { Villager: { speed: 1.5, totalHitPoints: 18, gatherAmount: { woodcutter: 1, farmer: 1 } } },
    },
  }
  const context = { map: { grid, difficulty: 'normal' }, dayNight: { state: { day: 2 } } }
  return { state, owner, context, resource }
}
test('a dormant static settlement replenishes its saved stores without any runtime units or buildings', () => {
  const f = fixture('static')
  advanceDeferredVillage(f.context, f.owner, f.state, 0, 60000, () => assert.fail('no world resource creation'))
  assert.equal(f.state.buildings[0].inventory.resources.wood, 20)
  assert.equal(f.state.buildings[1].inventory.resources.wheat, 130)
  assert.equal(f.state.rpgRestockDay, 2)
  advanceDeferredVillage(f.context, f.owner, f.state, 60000, 120000, () => {})
  assert.equal(f.state.buildings[0].inventory.resources.wood, 20)
  assert.equal(f.owner.units, undefined)
})
test('a dormant dynamic settlement harvests finite shared resources into saved inventory', () => {
  const f = fixture('dynamic')
  f.state.buildings.push({ type: 'TownCenter', label: 'center', i: 16, j: 16, isBuilt: true })
  advanceDeferredVillage(f.context, f.owner, f.state, 0, 600000, () => {})
  assert.ok(f.resource.quantity < 100, `expected harvesting: ${JSON.stringify(f.state)}`)
  const carried = f.state.units.reduce((sum, unit) => sum + (unit.inventory?.resources?.wood ?? 0), 0)
  const deposited = f.state.buildings.reduce((sum, building) => sum + (building.inventory?.resources?.wood ?? 0), 0)
  assert.ok(carried + deposited > 0)
  assert.equal(carried + deposited, 100 - f.resource.quantity)
  assert.equal(f.owner.units, undefined)
})

test('static saved residents recover only the sleep overlap in successive catch-up intervals', () => {
  const f = fixture('static')
  const unit = f.state.units[0]
  unit.hitPoints = 1
  unit.totalHitPoints = 80
  unit.dailySchedule = {
    wakeMinute: 360,
    workStartMinute: 420,
    lunchStartMinute: 720,
    lunchEndMinute: 780,
    workEndMinute: 1080,
    bedMinute: 1320,
  }
  const hour = gameplay.DAY_NIGHT_CONFIG.dayLengthMs / gameplay.DAY_NIGHT_CONFIG.hoursPerDay
  advanceDeferredVillage(f.context, f.owner, f.state, 13 * hour, 15 * hour, () => {})
  assert.equal(unit.hitPoints, 11)
  advanceDeferredVillage(f.context, f.owner, f.state, 15 * hour, 16 * hour, () => {})
  assert.equal(unit.hitPoints, 21)
  advanceDeferredVillage(f.context, f.owner, f.state, 16 * hour, 16 * hour, () => {})
  assert.equal(unit.hitPoints, 21)
})
