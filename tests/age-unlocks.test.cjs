const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

test('archers can be trained at age zero', () => {
  const { canUnitTrainInto } = loadTsModule('app/lib/buildings/buildingTraining.ts')
  const owner = { age: 0, config: { units: { Bowman: { category: 'Archer' } } } }
  assert.equal(
    canUnitTrainInto({ type: 'ArcheryRange', units: ['Bowman'], owner }, { type: 'Villager', owner }, 'Bowman'),
    true
  )
})

test('a reachable tamed horse can be mounted at age zero', () => {
  const { findNearestMountableHorse } = loadTsModule('app/lib/hero/heroMountTargets.ts', {
    mocks: { './heroActionRange': { isHeroInteractionTargetReachable: () => true } },
  })
  const hero = { owner: { age: 0 }, x: 0, y: 0 }
  const horse = { type: 'Horse', family: 'animal', tamingStatus: 'tamed', x: 0, y: 0 }
  assert.equal(findNearestMountableHorse(hero, horse, horse), horse)
})

test('AI troop and building capacities no longer grow with age', () => {
  const config = loadTsModule('app/ai/config.ts')
  for (const key of [
    'MAX_VILLAGER_PER_AGE',
    'MAX_BUILDING_BY_AGE',
    'MAX_INFANTRY_BY_AGE',
    'MAX_ARCHER_BY_AGE',
    'MAX_CAVALRY_BY_AGE',
  ]) {
    assert.deepEqual(config[key][0], config[key][2], key)
  }
})
