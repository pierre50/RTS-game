const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { consumeVillagerMeals } = loadTsModule('app/lib/economy/villagerMeals.ts')
function worker(food = 12) {
  return {
    type: 'Villager',
    i: 1,
    j: 1,
    label: 'worker',
    inventory: { resources: { wheat: food } },
    dailySchedule: {
      wakeMinute: 360,
      workStartMinute: 420,
      lunchStartMinute: 720,
      lunchEndMinute: 780,
      workEndMinute: 1080,
      bedMinute: 1320,
    },
  }
}
test('the three pauses consume 1, 2 and 1 without changing the daily ration', () => {
  const unit = worker()
  assert.equal(consumeVillagerMeals(unit, 300, 359).consumed, 0)
  assert.equal(consumeVillagerMeals(unit, 359, 360).consumed, 1)
  assert.equal(consumeVillagerMeals(unit, 360, 719).consumed, 0)
  assert.equal(consumeVillagerMeals(unit, 719, 720).consumed, 2)
  assert.equal(consumeVillagerMeals(unit, 720, 1080).consumed, 1)
  assert.equal(unit.inventory.resources.wheat, 8)
})
test('split simulation, whole days and save reload consume exactly the same meals', () => {
  const whole = worker(40)
  let split = structuredClone(whole)
  const result = consumeVillagerMeals(whole, 0, 3 * 1440)
  for (let minute = 0; minute < 3 * 1440; minute += 15) {
    consumeVillagerMeals(split, minute, minute + 15)
    split = JSON.parse(JSON.stringify(split))
  }
  assert.equal(result.consumed, 12)
  assert.deepEqual(split, whole)
  assert.equal(consumeVillagerMeals(split, 0, 3 * 1440).consumed, 0)
})
test('loading during a pause eats at most once and empty bags never borrow remote food', () => {
  const unit = worker(0)
  assert.deepEqual(consumeVillagerMeals(unit, 735, 735, true), { needed: 2, consumed: 0 })
  unit.inventory.resources.wheat = 12
  assert.deepEqual(consumeVillagerMeals(unit, 735, 736, true), { needed: 0, consumed: 0 })
  assert.equal(consumeVillagerMeals(unit, 736, 1080).consumed, 1)
  assert.equal(unit.inventory.resources.wheat, 11)
})
test('live meal ticks consume rations once without a daily report handler', () => {
  const { VillagerUpkeepSystem } = loadTsModule('app/services/world/VillagerUpkeepSystem.ts')
  const unit = worker()
  const context = {
    players: [{ units: [unit] }],
    scheduler: { add: () => 1, remove() {} },
    dayNight: { state: { day: 1, hour: 6, minute: 0 } },
  }
  const system = new VillagerUpkeepSystem(context)
  assert.equal(unit.inventory.resources.wheat, 11)
  system.update()
  assert.equal(unit.inventory.resources.wheat, 11)
  context.dayNight.state.hour = 12
  system.update()
  assert.equal(unit.inventory.resources.wheat, 9)
  context.dayNight.state.hour = 18
  system.update()
  system.update()
  assert.equal(system.handleDailyWorldEvent, undefined)
  assert.equal(unit.inventory.resources.wheat, 8)
  system.destroy()
})

test('only scheduled meal updates consume provisions and leave depot stocks untouched', () => {
  const { VillagerUpkeepSystem } = loadTsModule('app/services/world/VillagerUpkeepSystem.ts')
  const unit = worker()
  const stock = { wood: 100, wheat: 100 }
  const context = {
    players: [{ units: [unit], buildings: [{ type: 'Granary', inventory: { resources: stock } }] }],
    scheduler: { add: () => 1, remove() {} },
    dayNight: { state: { day: 1, hour: 10, minute: 0 } },
  }
  const system = new VillagerUpkeepSystem(context)
  context.dayNight.state.hour = 12
  assert.equal(unit.inventory.resources.wheat, 12)
  assert.deepEqual(stock, { wood: 100, wheat: 100 })
  system.update()
  assert.equal(unit.inventory.resources.wheat, 10)
  assert.deepEqual(stock, { wood: 100, wheat: 100 })
  system.destroy()
})

test('a live meal triggering catch-up does not consume that meal twice or rewind its checkpoint', () => {
  const unit = worker(40)
  const result = consumeVillagerMeals(unit, 0, 3 * 1440, false, () => {
    consumeVillagerMeals(unit, 0, 3 * 1440)
  })
  assert.equal(result.consumed, 0)
  assert.equal(unit.inventory.resources.wheat, 28)
  assert.equal(unit.lastMealAt, 2 * 1440 + 1080)
})
