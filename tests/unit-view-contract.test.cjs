const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

const { unitVisualState } = loadTsModule('app/rendering/UnitView.ts')

test('unit position keeps flat x/y and samples z from the cells under its feet', () => {
  const grid = Array.from({ length: 3 }, (_, i) =>
    Array.from({ length: 3 }, (_, j) => ({ i, j, z: i === 1 && j === 1 ? 2 : 0 }))
  )
  const unit = {
    label: 'villager-1',
    type: 'Villager',
    i: 1,
    j: 1,
    x: 0,
    y: 32,
    z: 0,
    currentCell: grid[1][1],
    degree: 90,
    currentSheet: 'walking',
    visible: true,
    selected: false,
  }
  const onCell = unitVisualState(unit, { grid })
  assert.deepEqual(onCell.cell, { i: 1, j: 1, z: 2 })
  assert.deepEqual(onCell.position, { x: 0, y: 32, z: 2 })
  unit.x = 32
  unit.y = 48
  const moving = unitVisualState(unit, { grid })
  assert.equal(moving.position.x, 32)
  assert.equal(moving.position.y, 48)
  assert.ok(moving.position.z > 0 && moving.position.z < 2)
  assert.equal(moving.cell.z, 2)
})
