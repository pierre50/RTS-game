const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

const { buildingVisualState } = loadTsModule('app/rendering/BuildingView.ts')
const { cartesianToIsometric, getInstanceZIndex } = loadTsModule('app/lib/maths.ts')

test('building state keeps flat x/y and takes z from its anchor cell', () => {
  const source = { i: 4, j: 3, z: 99, type: 'House' }
  const cell = { i: 4, j: 3, z: 2 }
  const state = buildingVisualState(source, cell, true)
  const [x, y] = cartesianToIsometric(4, 3)

  assert.deepEqual(state.cell, { i: 4, j: 3, z: 2 })
  assert.deepEqual(state.position, { x, y, z: 2 })
  assert.equal(state.sortOrder, getInstanceZIndex({ x, y, z: 2, type: 'House' }))
  assert.equal(state.visible, true)
  assert.ok(state.reliefLift < 0)
})

test('building relief uses the cell surface, including an inclined cell', () => {
  const flat = buildingVisualState({ i: 1, j: 1 }, { i: 1, j: 1, z: 1 }, false)
  const inclined = buildingVisualState({ i: 1, j: 1 }, { i: 1, j: 1, z: 1, inclined: true }, false)
  assert.deepEqual(flat.position, inclined.position)
  assert.ok(inclined.reliefLift < flat.reliefLift)
})
