const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
let candidates = []
const { resolveClickTarget, resolveHoverTarget } = loadTsModule('app/lib/npc/npcTargetResolution.ts', {
  mocks: {
    '../grid/visibility': {
      findInstancesInSight: (hero, matches, range) => {
        assert.equal(range, 15)
        return candidates.filter(matches)
      },
    },
  },
})
const owner = { isEnemy: other => other?.enemy === true }
const hero = { owner }
const point = { x: 0, y: 0 }
function target(family, x = 0, options = {}) {
  return { family, x, y: 0, ...options }
}

test('NPC clicks prioritize the cell occupant then the closest eligible target within tolerance', () => {
  const near = target('resource', 5)
  const far = target('building', 50)
  candidates = [far, near]
  assert.equal(resolveClickTarget(hero, point, {}), near)
  assert.equal(resolveClickTarget(hero, point, { has: far }), far)
  candidates = [target('resource', 60), target('building', 61)]
  assert.equal(resolveClickTarget(hero, point, {}), null)
})
test('NPC target resolution excludes destroyed entities while keeping animal corpses available', () => {
  const destroyed = target('unit', 0, { owner: { enemy: true }, isDestroyed: true })
  const corpse = target('animal', 10, { isDead: true })
  candidates = [destroyed, corpse, target('unit', 1, { owner: { enemy: true }, isDead: true })]
  assert.equal(resolveClickTarget(hero, point, { has: destroyed }), corpse)
  assert.equal(resolveHoverTarget(hero, point, { has: destroyed }), corpse)
  candidates = [destroyed]
  assert.equal(resolveHoverTarget(hero, point, null), null)
})
test('NPC hover identifies neutral units while click dispatch remains limited to enemies', () => {
  const neutral = target('unit', 1, { owner: {} })
  const enemy = target('unit', 10, { owner: { enemy: true } })
  candidates = [target('unit', 0, { owner }), neutral, enemy]
  assert.equal(resolveClickTarget(hero, point, {}), enemy)
  assert.equal(resolveHoverTarget(hero, point, null), neutral)
  candidates = [target('unit', 1)]
  assert.equal(resolveClickTarget({}, point, {}), null)
})
