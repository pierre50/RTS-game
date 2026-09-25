const assert = require('node:assert/strict')
const test = require('node:test')
const { planContinentCaves } = require('../tools/caves/continent-placement.cjs')
const { planContinentCamps } = require('../tools/caves/continent-camps.cjs')
test('continent camps have reproducible distinct profiles, valid lairs and bounded density', () => {
  const input = {
    size: 599,
    terrain: Buffer.alloc(600 * 600),
    seed: 4242,
    id: 'test',
    settlements: [{ local: { i: 300, j: 300 } }],
  }
  input.caves = planContinentCaves(input).caves
  const camps = planContinentCamps(input)
  assert.deepEqual(planContinentCamps(input), camps)
  assert.equal(new Set(camps.map(camp => camp.id)).size, camps.length)
  assert.ok(camps.some(camp => camp.profile === 'small'))
  assert.ok(camps.some(camp => camp.profile === 'lair'))
  for (const camp of camps) {
    assert.ok(Math.hypot(camp.i - 300, camp.j - 300) >= 40)
    if (camp.profile === 'lair') {
      const cave = input.caves.find(cave => cave.id === camp.caveId)
      assert.ok(cave)
      assert.equal(camp.i, cave.i + 4)
      assert.equal(camp.j, cave.j + 4)
      assert.ok(camp.unitTypes.length >= 5 && camp.unitTypes.length <= 8)
      assert.equal(camp.unitTypes[0], 'BanditChief')
    } else {
      assert.equal(camp.caveId, undefined)
      assert.ok(camp.unitTypes.length >= 2 && camp.unitTypes.length <= 4)
      assert.ok(input.caves.every(cave => Math.hypot(cave.i - camp.i, cave.j - camp.j) >= 40))
    }
    for (const other of camps) if (other !== camp) assert.ok(Math.hypot(camp.i - other.i, camp.j - other.j) >= 80)
  }
  assert.ok(!planContinentCamps({ ...input, lairFraction: 0 }).some(camp => camp.caveId))
  assert.throws(() => planContinentCamps({ ...input, lairFraction: 2 }), /fraction/)
})
