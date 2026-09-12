const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

const { getUnitGender, resolveUnitIdentity } = loadTsModule('app/lib/units/unitIdentity.ts')

test('legacy visual identity drives both dialogue gender and appearance', () => {
  const unit = {
    type: 'Villager',
    label: 'saved-worker',
    gender: 'male',
    appearanceVariants: { gender: 'female' },
    assetCiv: 'Kemet',
    owner: { civ: 'Hellas', gender: 'male' },
  }
  assert.equal(getUnitGender(unit), 'female')
  assert.deepEqual(resolveUnitIdentity(unit), { civ: 'Kemet', gender: 'female' })
  const saved = JSON.parse(JSON.stringify(unit))
  saved.owner = { civ: 'Nord', gender: 'male' }
  assert.deepEqual(resolveUnitIdentity(saved), resolveUnitIdentity(unit))
})

test('uninitialized civilian gender is stable across movement and owner changes', () => {
  const unit = { type: 'Villager', label: 'worker-17', owner: { civ: 'Hellas', gender: 'male' }, i: 1, j: 2 }
  const identity = resolveUnitIdentity(unit)
  unit.i = 99
  unit.owner = { civ: 'Kemet', gender: 'female' }
  assert.equal(resolveUnitIdentity(unit).gender, identity.gender)
  assert.equal(resolveUnitIdentity({ type: 'Hero', owner: { gender: 'female' } }).gender, 'female')
})

test('fixed-gender sprites reject incompatible legacy variants', () => {
  const unit = { type: 'BanditChief', gender: 'female', appearanceVariants: { gender: 'female' } }
  assert.equal(getUnitGender(unit), 'male')
  assert.equal(resolveUnitIdentity(unit).gender, 'male')
})
