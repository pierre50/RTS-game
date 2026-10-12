const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function fixture() {
  const relief = []
  const { teleportRuntimeUnitToCell } = loadTsModule('app/lib/units/unitPlacement.ts', {
    mocks: { '../terrain/reliefSurface': { syncEntityRelief: (...args) => relief.push(args) } },
  })
  const unit = { i: 0, j: 0, x: 0, y: 0, path: [{ i: 1, j: 1 }], action: 'move' }
  const old = { i: 0, j: 0, has: unit, solid: true }
  const target = {
    i: 2,
    j: 3,
    z: 4,
    place(actor) {
      this.has = actor
    },
  }
  const events = []
  const map = {
    grid: [[old]],
    removeFromInstanceBucket: actor => events.push(['remove', actor.i, actor.j]),
    addToInstanceBucket: actor => events.push(['add', actor.i, actor.j]),
  }
  return { teleportRuntimeUnitToCell, unit, old, target, map, events, relief }
}

for (const explicitCell of [false, true]) {
  test(`teleport releases the owned cell and updates spatial indexing (${explicitCell ? 'explicit cell' : 'grid lookup'})`, () => {
    const f = fixture()
    if (explicitCell) f.unit.currentCell = f.old
    f.teleportRuntimeUnitToCell(f.map, f.unit, f.target)
    assert.equal(f.old.has, null)
    assert.equal(f.old.solid, false)
    assert.equal(f.target.has, f.unit)
    assert.equal(f.target.solid, true)
    assert.equal(f.unit.currentCell, f.target)
    assert.deepEqual([f.unit.i, f.unit.j, f.unit.z], [2, 3, 4])
    const { cartesianToIsometric } = loadTsModule('app/lib/maths.ts')
    assert.deepEqual([f.unit.x, f.unit.y], cartesianToIsometric(2, 3))
    assert.ok(Number.isFinite(f.unit.zIndex))
    assert.deepEqual(f.unit.path, [])
    assert.equal(f.unit.action, null)
    assert.deepEqual(f.events, [
      ['remove', 0, 0],
      ['add', 2, 3],
    ])
    assert.deepEqual(f.relief, [[f.map, f.unit, f.target]])
  })
}

test('teleport preserves another occupant and supports missing cells and optional spatial hooks', () => {
  for (const source of ['other occupant', 'missing cell', 'missing row']) {
    const f = fixture()
    const other = { label: 'resident' }
    f.old.has = other
    f.map.grid = source === 'other occupant' ? [[f.old]] : source === 'missing cell' ? [[]] : []
    delete f.map.removeFromInstanceBucket
    delete f.map.addToInstanceBucket
    f.teleportRuntimeUnitToCell(f.map, f.unit, f.target)
    assert.equal(f.old.has, other)
    assert.equal(f.old.solid, true)
    assert.equal(f.target.has, f.unit)
    assert.deepEqual(f.unit.path, [])
    assert.deepEqual(f.relief, [[f.map, f.unit, f.target]])
  }
})
