const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

const { serializeTrainingQueue } = loadTsModule('app/serialization/TrainingSave.ts')
const { validatePlayerTraining } = loadTsModule('app/serialization/TrainingSaveValidation.ts')
const config = { units: { Villager: {}, Fantassin: { cost: { food: 35 } } } }

function entry(label, end = 12) {
  return {
    type: 'Fantassin',
    trainee: {
      type: 'Villager',
      label,
      i: 1,
      j: 1,
      name: label,
      gender: 'female',
      hitPoints: 21,
      speed: 1.2,
      experience: { farming: 8 },
      appearanceVariants: { hair: 'brown' },
      inventory: { resources: { food: 2 } },
    },
    extra: { name: label, gender: 'female', appearanceVariants: { hair: 'brown' } },
    cost: { food: 35 },
    trainingStartedDay: 2,
    trainingCompleteDay: end,
    loading: 0,
  }
}

function runtime(entries, day = 5, type = 'Barracks') {
  const callbacks = new Set()
  const placed = []
  const refunds = []
  let blocked = false
  const building = {
    type,
    isBuilt: true,
    queue: entries.map(item => item.type),
    trainingQueue: entries,
    loading: 0,
    owner: { config, units: [], population: entries.length, populationMax: 0 },
    context: {
      menu: {},
      map: {},
      dayNight: {
        state: { day },
        onDayChange(callback) {
          callbacks.add(callback)
          return () => callbacks.delete(callback)
        },
      },
    },
  }
  const { BuildingProduction } = loadTsModule('app/classes/building/BuildingProduction.ts', {
    mocks: {
      '../../lib': {
        refundCost: (_owner, cost) => refunds.push(cost),
        canAfford: () => {
          throw new Error('restoration must not check or pay resources')
        },
        payCost: () => {
          throw new Error('restoration must not pay twice')
        },
      },
      '../../lib/lang': { t: key => key },
      '../../lib/horses/stableHorses': {
        returnStableHorse: (target, horse) => {
          ;(target.stableHorses ??= []).push(horse)
        },
      },
      './BuildingTechnologyProduction': { refreshOpenBuildingMenu() {} },
      './BuildingProductionPlacement': {
        placeProducedUnit(_building, unitType, extra, options) {
          if (blocked) return false
          placed.push({ type: unitType, extra, options })
          return true
        },
      },
    },
  })
  const production = new BuildingProduction(building)
  return {
    building,
    production,
    callbacks,
    placed,
    refunds,
    block(value) {
      blocked = value
    },
    advance(nextDay) {
      building.context.dayNight.state.day = nextDay
      for (const callback of [...callbacks]) callback()
    },
  }
}

test('training snapshots detach recruits and omit live references and callbacks', () => {
  const first = entry('Aline')
  first.trainee.owner = { units: [first.trainee] }
  first.trainingDayChangeUnsubscribe = () => {}
  first.extra.handleSetDest = () => {}
  const saved = serializeTrainingQueue([first, entry('Brune', 16)])
  assert.deepEqual(JSON.parse(JSON.stringify(saved)), saved)
  assert.equal(saved[0].trainingDayChangeUnsubscribe, undefined)
  assert.equal(saved[0].trainee.owner, undefined)
  assert.equal(saved[0].extra.handleSetDest, undefined)
  first.trainee.experience.farming = 999
  assert.equal(saved[0].trainee.experience.farming, 8)
  assert.deepEqual(saved[0].cost, { food: 35 })
})

test('same-type concurrent training survives repeated saves and finishes independently exactly once', () => {
  const original = runtime([entry('Aline'), entry('Brune', 16)])
  const saved = JSON.parse(JSON.stringify(serializeTrainingQueue(original.building.trainingQueue)))
  const restored = runtime(saved)
  restored.production.resumeSavedTraining()
  assert.equal(restored.placed.length, 0)
  assert.equal(restored.building.trainingUnit, saved[0].trainee)
  assert.equal(restored.callbacks.size, 2)
  restored.production.resumeSavedTraining()
  assert.equal(restored.callbacks.size, 2)
  restored.advance(12)
  assert.equal(restored.placed.length, 1)
  assert.equal(restored.placed[0].extra.name, 'Aline')
  assert.equal(restored.placed[0].options.consumePopulationSlot, false)
  assert.equal(restored.building.owner.population, 2)
  assert.equal(restored.building.trainingUnit.name, 'Brune')
  assert.equal(restored.callbacks.size, 1)
  assert.equal(restored.production.finishUnitTraining('Fantassin', saved[0].extra, saved[0].trainee), false)
  const again = runtime(serializeTrainingQueue(restored.building.trainingQueue), 16)
  again.production.resumeSavedTraining()
  assert.equal(again.placed.length, 1)
  assert.equal(again.placed[0].extra.name, 'Brune')
  assert.equal(again.callbacks.size, 0)
  assert.deepEqual(again.building.queue, [])
  again.advance(20)
  assert.equal(again.placed.length, 1)
})

test('expired recruits remain saved when exits are blocked and retry without duplication', () => {
  const restored = runtime([entry('Aline'), entry('Brune')], 30)
  restored.block(true)
  restored.production.resumeSavedTraining()
  assert.equal(restored.building.trainingQueue.length, 2)
  assert.equal(restored.building.loading, 100)
  const again = runtime(serializeTrainingQueue(restored.building.trainingQueue), 30)
  again.production.resumeSavedTraining()
  assert.deepEqual(
    again.placed.map(unit => unit.extra.name),
    ['Aline', 'Brune']
  )
  assert.equal(again.callbacks.size, 0)
})

test('restored cancellation refunds each paid cost once and retains recruits when blocked', () => {
  const restored = runtime(serializeTrainingQueue([entry('Aline'), entry('Brune')]))
  restored.production.resumeSavedTraining()
  restored.block(true)
  assert.equal(restored.production.cancelAllUnitTraining(), false)
  assert.equal(restored.refunds.length, 0)
  assert.equal(restored.callbacks.size, 2)
  restored.block(false)
  assert.equal(restored.production.cancelAllUnitTraining(), true)
  assert.deepEqual(restored.refunds, [{ food: 35 }, { food: 35 }])
  assert.equal(restored.placed[0].type, 'Villager')
  assert.equal(restored.placed[0].extra.label, 'Aline')
  assert.equal(restored.placed[0].extra.hitPoints, 21)
  assert.deepEqual(restored.placed[0].extra.inventory, { resources: { food: 2 } })
  assert.equal(restored.callbacks.size, 0)
  assert.equal(restored.building.trainingUnit, null)
  assert.equal(restored.production.cancelAllUnitTraining(), false)
})

test('restored mount cancellation returns the reserved horse and original experience', () => {
  const recruit = entry('Aline')
  recruit.trainee.type = 'Fantassin'
  recruit.cost = {}
  recruit.extra.mountedOnHorse = true
  recruit.extra.horseColor = 'black'
  const restored = runtime(serializeTrainingQueue([recruit]), 5, 'Stable')
  restored.production.resumeSavedTraining()
  restored.production.cancelAllUnitTraining()
  assert.deepEqual(restored.refunds, [{}])
  assert.equal(restored.building.stableHorses.length, 1)
  assert.equal(restored.building.stableHorses[0].horseColor, 'black')
  assert.equal(restored.placed[0].extra.mountedOnHorse, undefined)
  assert.deepEqual(restored.placed[0].extra.experience, { farming: 8 })
})

test('training validation accepts legacy saves but rejects broken or duplicate recruit records', () => {
  assert.doesNotThrow(() => validatePlayerTraining([{ queue: ['Fantassin'] }], [], 8, config))
  const building = { queue: ['Fantassin'], trainingQueue: [entry('Aline')] }
  assert.doesNotThrow(() => validatePlayerTraining([building], [], 8, config))
  assert.throws(() => validatePlayerTraining([building], [{ label: 'Aline' }], 8, config), /training/)
  for (const mutate of [
    value => {
      value.trainingQueue[0].trainee = null
    },
    value => {
      value.trainingQueue[0].trainingCompleteDay = -1
    },
    value => {
      value.trainingQueue[0].cost.food = -10
    },
    value => {
      value.trainingQueue[0].type = 'Missing'
    },
    value => {
      value.queue = []
    },
  ]) {
    const invalid = structuredClone(building)
    mutate(invalid)
    assert.throws(() => validatePlayerTraining([invalid], [], 8, config), /Invalid save/)
  }
})
