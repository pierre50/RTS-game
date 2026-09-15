const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

const { isFriendlyTarget } = loadTsModule('app/lib/combat/combatRelations.ts')

const player = (patch = {}) => ({ label: 'player-1', type: 'Human', isEnemy: () => true, ...patch })
const gaia = (patch = {}) => ({ label: 'gaia', type: 'Gaia', ...patch })

test('a target with no owner, or a source with no owner, is never friendly', () => {
  assert.equal(isFriendlyTarget({ owner: player() }, { owner: undefined }), false)
  assert.equal(isFriendlyTarget({ owner: undefined }, { owner: player() }), false)
})

test('same-owner entities are always friendly', () => {
  const owner = player()
  assert.equal(isFriendlyTarget({ owner }, { owner, family: 'unit' }), true)
})

test('a wild (Gaia-owned) animal is never friendly, letting hunting damage land', () => {
  const source = { owner: player({ isEnemy: () => false }) }
  const target = { owner: gaia(), family: 'animal' }

  assert.equal(isFriendlyTarget(source, target), false)
})

test('a tamed/companion animal is excluded from the wildlife carve-out and falls back to isEnemy', () => {
  const source = { owner: player({ isEnemy: () => false }) }
  const target = { owner: gaia(), family: 'animal', companionOwner: { label: 'tamer' } }

  // isEnemy() returns false here, so the normal (non-wildlife) friendliness check reports friendly.
  assert.equal(isFriendlyTarget(source, target), true)
})

test('a non-animal Gaia-owned entity is not covered by the wildlife carve-out', () => {
  const source = { owner: player({ isEnemy: () => false }) }
  const target = { owner: gaia(), family: 'resource' }

  assert.equal(isFriendlyTarget(source, target), true)
})

test('an animal owned by a real player (not Gaia) is not covered by the wildlife carve-out', () => {
  const source = { owner: player({ isEnemy: () => false }) }
  const target = { owner: player({ label: 'player-2' }), family: 'animal' }

  assert.equal(isFriendlyTarget(source, target), true)
})

test('falls back to isEnemy() for non-wildlife targets: hostile is not friendly', () => {
  const source = { owner: player({ isEnemy: () => true }) }
  const target = { owner: player({ label: 'player-2' }), family: 'unit' }

  assert.equal(isFriendlyTarget(source, target), false)
})

test('falls back to isEnemy() for non-wildlife targets: an undefined isEnemy is treated as not friendly', () => {
  const source = { owner: player({ isEnemy: undefined }) }
  const target = { owner: player({ label: 'player-2' }), family: 'unit' }

  assert.equal(isFriendlyTarget(source, target), false)
})
