const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

const { animalVisualState } = loadTsModule('app/rendering/AnimalView.ts')

test('animal state keeps flat map coordinates and samples support height separately from flight', () => {
  const grid = Array.from({ length: 3 }, (_, i) =>
    Array.from({ length: 3 }, (_, j) => ({ i, j, z: i === 1 && j === 1 ? 2 : 0 }))
  )
  const animal = {
    label: 'bird-1', type: 'Bird', i: 1, j: 1, x: 0, y: 32, z: 2,
    currentCell: grid[1][1], altitude: 20, degree: 90, currentSheet: 'flying', visible: true,
  }
  const state = animalVisualState(animal, { grid })
  assert.deepEqual(state.cell, { i: 1, j: 1, z: 2 })
  assert.deepEqual(state.position, { x: 0, y: 32, z: 2 })
  assert.equal(state.altitude, 20)
  animal.x = 32
  animal.y = 48
  const moving = animalVisualState(animal, { grid })
  assert.ok(moving.position.z > 0 && moving.position.z < 2)
})
