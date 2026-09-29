const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const moduleCache = new Map()
const { notifyVillageStateChanged } = loadTsModule('app/lib/units/villageStateEvents.ts', { moduleCache })
const { VillageScheduleGate } = loadTsModule('app/lib/units/VillageScheduleGate.ts', { moduleCache })
const { flushTrainingRequests } = loadTsModule('app/lib/training/trainingRequests.ts', { moduleCache })
const { VillagerUpkeepSystem } = loadTsModule('app/services/world/VillagerUpkeepSystem.ts', { moduleCache })
function fixture() {
  const unit = {
    type: 'Villager',
    label: 'worker',
    i: 1,
    j: 1,
    inventory: { resources: { meat: 12 } },
    dailySchedule: {
      wakeMinute: 360,
      workStartMinute: 420,
      lunchStartMinute: 720,
      lunchEndMinute: 780,
      workEndMinute: 1080,
      bedMinute: 1320,
    },
  }
  const owner = {
    units: [unit],
    buildings: [],
    label: 'player',
    config: { units: { Fantassin: { category: 'Infantry' } } },
  }
  const context = {
    players: [owner],
    dayNight: { state: { day: 1, hour: 10, minute: 0 } },
    scheduler: { add: () => 1, remove() {} },
  }
  unit.owner = owner
  unit.context = context
  return { unit, owner, context }
}

test('schedule gate ignores ordinary ticks, wakes at lunch, on spawn and after a backward time jump', () => {
  const { owner, context } = fixture()
  const gate = new VillageScheduleGate()
  assert.equal(gate.due(context), true)
  gate.settle(context)
  context.dayNight.state.hour = 11
  assert.equal(gate.due(context), false)
  context.dayNight.state.hour = 12
  assert.equal(gate.due(context), true)
  gate.settle(context)
  notifyVillageStateChanged(owner)
  assert.equal(gate.due(context), true)
  gate.settle(context)
  context.dayNight.state.hour = 9
  assert.equal(gate.due(context), true)
})

test('100 ordinary meal checks do not traverse units; lunch consumes once even after repeated callbacks', () => {
  const { owner, context, unit } = fixture()
  const service = new VillagerUpkeepSystem(context)
  const units = owner.units
  let reads = 0
  Object.defineProperty(owner, 'units', {
    get() {
      reads++
      return units
    },
  })
  for (let i = 0; i < 100; i++) service.update(false)
  assert.equal(reads, 0)
  context.dayNight.state.hour = 12
  service.update(false)
  assert.equal(unit.inventory.resources.meat, 10)
  reads = 0
  for (let i = 0; i < 100; i++) service.update(false)
  assert.equal(reads, 0)
  assert.equal(unit.inventory.resources.meat, 10)
  service.destroy()
})

test('waiting recruitment does not rescan unchanged units and resumes when a recruit arrives', () => {
  const { owner, context, unit } = fixture()
  owner.units = []
  const building = {
    owner,
    type: 'Barracks',
    label: 'b',
    i: 0,
    j: 0,
    isBuilt: true,
    units: ['Fantassin'],
    trainingRequests: [{ type: 'Fantassin' }],
  }
  owner.buildings.push(building)
  flushTrainingRequests(owner, context)
  const units = owner.units
  let reads = 0
  Object.defineProperty(owner, 'units', {
    get() {
      reads++
      return units
    },
  })
  for (let tick = 0; tick < 100; tick++) flushTrainingRequests(owner, context)
  assert.equal(reads, 0)
  unit.sendToEvt = (dest, action) => {
    unit.dest = dest
    unit.action = action
  }
  units.push(unit)
  notifyVillageStateChanged(owner)
  flushTrainingRequests(owner, context)
  assert.equal(unit.dest, building)
  assert.equal(unit.action, 'train')
})
