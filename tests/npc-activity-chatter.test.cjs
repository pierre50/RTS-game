const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { npcActivityChatter: line } = loadTsModule('app/lib/npc/npcActivityChatter.ts', {
  mocks: {
    '../units/supplies/groundToolRecovery': {
      groundToolPlan: unit => (unit.preparing ? { missing: unit.missing ?? [], bagFull: unit.bagFull } : undefined),
    },
    '../units/supplies/npcSupplyStatus': { npcNeedsSupplies: unit => unit.needsSupplies },
  },
})
test('tool preparation speaks about missing materials, gathering and crafting as distinct states', () => {
  const unit = { preparing: true, missing: ['wood', 'stone'] }
  assert.equal(line(unit, true, true), 'I need wood and stone to make my tools.')
  unit.lookingAtHero = true
  unit.previousDest = { type: 'GroundWood' }
  assert.equal(line(unit, true, true), 'I’m gathering materials to make my tools.')
  unit.missing = []
  assert.equal(line(unit, true, true), 'I’m making my new tools.')
  assert.equal(
    line({ preparing: true, missing: ['stone'] }, false, true),
    'Il me faut de la pierre pour fabriquer mes outils.'
  )
})
test('actual tasks override generic chatter and retain the target during conversation', () => {
  assert.equal(
    line({ action: 'build', lookingAtHero: true, previousDest: { isBuilt: true } }, true, true),
    'I’m repairing this building.'
  )
  assert.equal(line({ action: 'build', dest: { isBuilt: false } }, true, true), 'I’m working on the construction site.')
  assert.equal(line({ action: 'delivery' }, true, true), 'I’m bringing back what I gathered.')
  assert.equal(line({ action: 'minestone' }, true, true), 'I’m quarrying stone.')
  assert.equal(
    line({ action: 'forageberry', dest: { type: 'GroundStone' } }, true, true),
    'I’m collecting loose stones.'
  )
  assert.equal(line({ preparing: true, action: 'flee' }, true, true), 'I’m getting to safety!')
  assert.equal(line({}, true, true), null)
})

test('a worker blocked by a full bag explains the blockage', () => {
  assert.equal(
    line({ preparing: true, missing: ['stone'], bagFull: true }, true, true),
    'My bag is full. I need room to prepare my tools.'
  )
})
