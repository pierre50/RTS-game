const test = require('node:test')
const assert = require('node:assert/strict')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { getConfiguredActionFrameSequence: sequence, getActionAnimationReleaseFrame: impact } = loadTsModule(
  'app/lib/animations/actionFrameSequences.ts',
  { mocks: { '../units/combat/npcWeapons': { hasNpcWeaponInventory: () => false } } }
)

for (const [tool, frames] of [
  ['axe_iron', [5, 5, 4, 4, 3, 1, 0, 0, 0, 0]],
  ['pickaxe_bronze', [5, 5, 4, 4, 3, 1, 0, 0, 0, 0]],
  ['hammer_ceramic', [5, 5, 4, 4, 1, 0, 0, 0, 0]],
  ['scythe_iron', [0, 1, 2, 3, 4, 5]],
]) {
  test(`${tool} selects combat or work timing independently of the target`, () => {
    for (const action of [null, 'attack', 'chopwood', 'minestone', 'build']) {
      for (const family of ['resource', 'unit', 'building', undefined]) {
        const context = {
          action,
          work: 'woodcutter',
          dest: family ? { family } : null,
          equipment: ['sword_iron'],
          inventory: { activeWeapons: { tool } },
        }
        const combat = action === 'attack' && !tool.startsWith('scythe_')
        assert.deepEqual(sequence(context), combat ? [5, 5, 4, 3, 1, 0] : frames)
        assert.equal(impact(context, action, 5), combat ? 4 : frames.length - 1)
      }
    }
  })
}

test('switching to a sword, bare hands or stowed tools cannot reuse a stale tool gesture', () => {
  const context = {
    work: 'heroSword',
    action: null,
    actionFrameSequence: [5, 5, 4, 4, 1, 0, 0, 0, 0],
    inventory: { activeWeapons: { melee: 'sword_iron', tool: 'hammer_ceramic' } },
  }
  assert.equal(sequence(context), null)
  context.work = 'builder'
  assert.equal(sequence(context).length, 9)
  context.inventory.toolsStowed = true
  assert.equal(sequence(context), null)
  context.inventory.toolsStowed = false
  delete context.inventory.activeWeapons.tool
  assert.equal(sequence(context), null)
})

test('every tool uses original guard poses through the reverse release', () => {
  for (const family of ['axe', 'pickaxe', 'hammer', 'scythe']) {
    const context = { action: 'attack', inventory: { activeWeapons: { tool: `${family}_ceramic` } } }
    for (const state of [
      { heroDefenseActive: true },
      { heroDefenseReverseTaskId: 1 },
      { heroDefenseReleaseFallbackTaskId: 2 },
    ]) {
      assert.deepEqual(sequence({ ...context, ...state }), [0, 1, 2, 3, 4, 5])
    }
    assert.deepEqual(sequence(context), family === 'scythe' ? [0, 1, 2, 3, 4, 5] : [5, 5, 4, 3, 1, 0])
  }
})
