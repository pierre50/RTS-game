const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const api = loadTsModule('app/lib/units/unitExperience.ts', {
  mocks: { '../combat/combatFeedback': { showLevelUpFeedback() {} }, '../lang': { t: key => key } },
})
test('equipment level follows combat role, priest healing or civilian work', () => {
  for (const [unit, category] of [
    [{ type: 'Priest' }, 'healing'],
    [{ type: 'Other', category: 'Priest' }, 'healing'],
    [{ type: 'Villager', work: 'woodcutter' }, 'woodcutting'],
    [{ type: 'Archer' }, 'ranged'],
    [{ type: 'Unknown' }, 'melee'],
  ]) {
    assert.equal(api.setUnitDebugLevel(unit, 3), 3)
    assert.equal(api.getUnitEquipmentLevel(unit), 3)
    assert.ok(unit.experience[category] > 0)
  }
  assert.equal(api.getUnitEquipmentLevel({ type: 'Villager', work: 'unknown', experience: { mining: 50 } }), 2)
})
test('experience summaries tolerate absent and zero values without inventing progress', () => {
  assert.deepEqual(api.getUnitExperienceEntries({}), [])
  const zero = api.getUnitExperienceEntries({}, { includeZero: true })
  assert.equal(zero.length, 9)
  assert.ok(zero.every(entry => entry.level === 1 && entry.current === 0))
  assert.equal(api.getUnitOverallLevel({ experience: { mining: undefined, building: -3 } }), 1)
  assert.deepEqual(api.getUnitExperienceEntries({ experience: { mining: undefined, building: 0 } }), [])
  const villager = { type: 'Villager', family: 'unit' }
  api.grantUnitXp(villager, 'mining', 100)
  assert.equal(villager.experience, undefined)
})
