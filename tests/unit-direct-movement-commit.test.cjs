const test = require('node:test')
const assert = require('node:assert/strict')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function fixture() {
  const events = []
  const { commitDirectMove } = loadTsModule('app/classes/unit/movement/UnitDirectMovementCommit.ts', {
    mocks: {
      '../../../constants': { SHEET_TYPES: { walking: 'walking' } },
      '../../../lib': {
        degreeToDirection: value => value,
        getGroundReliefLevel: cell => cell?.z ?? 0,
        getInstanceDegree: (_unit, x, y) => Math.atan2(y, x),
        getInstanceZIndex: unit => unit.x + unit.y,
        playMovementSurfaceAudio: (_unit, distance, previous) => events.push(['sound', distance, previous]),
        updateInstanceRenderVisibility: () => events.push('render'),
        updateInstanceVisibility: () => events.push('visibility'),
      },
      './UnitMovementHelpers': {
        clearCellForUnit: (_unit, cell) => {
          cell.has = null
          events.push('clear')
        },
        placeUnitOnCell: (unit, cell) => {
          cell.has = unit
          events.push('place')
        },
      },
    },
  })
  const unit = {
    x: 0,
    y: 0,
    i: 0,
    j: 0,
    degree: 0,
    currentSheet: 'idle',
    currentCell: { i: 0, j: 0, z: 0 },
    sprite: {
      playing: false,
      play() {
        this.playing = true
        events.push('play')
      },
    },
    setTextures: sheet => events.push(['textures', sheet]),
    applyReliefLift: level => events.push(['relief', level]),
  }
  unit.currentCell.has = unit
  const attempt = {
    unit,
    contextMap: { updateInstanceBucket: (_unit, i, j) => events.push(['bucket', i, j]) },
    candidateX: 1,
    candidateY: 0,
    newI: 1,
    newJ: 0,
    crossingCell: true,
    targetCell: { i: 1, j: 0, z: 2 },
    heroControlled: true,
    effectiveDistance: 1,
  }
  return { commitDirectMove, events, unit, attempt }
}

test('crossing a cell transfers occupancy, visibility and sound before refreshing walking', () => {
  const { commitDirectMove, events, unit, attempt } = fixture()
  const oldCell = unit.currentCell
  assert.equal(commitDirectMove(attempt, 1, 0), true)
  assert.equal(oldCell.has, null)
  assert.equal(attempt.targetCell.has, unit)
  assert.equal(unit.currentCell, attempt.targetCell)
  assert.deepEqual([unit.i, unit.j, unit.z, unit.x, unit.y, unit.visible], [1, 0, 2, 1, 0, true])
  assert.deepEqual(events, [
    'clear',
    'place',
    'render',
    ['bucket', 0, 0],
    'visibility',
    ['relief', 2],
    ['sound', 1, { previousX: 0, previousY: 0 }],
    'play',
    ['textures', 'walking'],
  ])
})

test('movement preserves an action-locked animation', () => {
  const { commitDirectMove, events, unit, attempt } = fixture()
  unit.actionLocked = true
  attempt.crossingCell = false
  commitDirectMove(attempt, 1, 0)
  assert.equal(unit.x, 1)
  assert.equal(unit.i, 0)
  assert.equal(unit.sprite.playing, false)
  assert.ok(!events.some(event => event === 'play' || event[0] === 'textures'))
})

test('steady walking does not restart its animation, while a facing change refreshes it', () => {
  const { commitDirectMove, events, unit, attempt } = fixture()
  unit.currentSheet = 'walking'
  unit.sprite.playing = true
  attempt.crossingCell = false
  commitDirectMove(attempt, 1, 0)
  assert.ok(!events.some(event => event === 'play' || event[0] === 'textures'))
  commitDirectMove(attempt, 0, 1)
  assert.deepEqual(
    events.filter(event => event[0] === 'textures'),
    [['textures', 'walking']]
  )
})

test('non-hero movement supports an absent context map and optional visual hooks', () => {
  const { commitDirectMove, events, unit, attempt } = fixture()
  delete unit.degree
  delete unit.applyReliefLift
  delete unit.setTextures
  delete attempt.contextMap
  attempt.heroControlled = false
  assert.equal(commitDirectMove(attempt, 1, 0), true)
  assert.equal(unit.i, 1)
  assert.ok(!events.includes('render'))
})

test('a unit without a sprite cannot commit a movement', () => {
  const { commitDirectMove, events, unit, attempt } = fixture()
  delete unit.sprite
  assert.equal(commitDirectMove(attempt, 1, 0), false)
  assert.equal(unit.x, 0)
  assert.deepEqual(events, [])
})
