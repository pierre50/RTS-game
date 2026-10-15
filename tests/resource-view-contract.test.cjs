const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

const { resourceVisualState } = loadTsModule('app/rendering/ResourceView.ts')
const { ResourceEvents } = loadTsModule('app/classes/resources/ResourceEvents.ts')

test('resource visual state is a renderer-independent snapshot', () => {
  const source = {
    label: 'stone-1',
    type: 'Stone',
    i: 4,
    j: 7,
    x: -96,
    y: 176,
    z: 2,
    textureName: 'stone/3',
    visible: true,
    alpha: 0.5,
    zIndex: 11,
  }
  const state = resourceVisualState(source)
  assert.deepEqual(state, {
    id: 'stone-1',
    type: 'Stone',
    spaceId: 'outside',
    cell: { i: 4, j: 7 },
    position: { x: -96, y: 176, elevation: 2 },
    textureName: 'stone/3',
    visible: true,
    alpha: 0.5,
    sortOrder: 11,
  })
  source.x = 10
  assert.equal(state.position.x, -96)
})

test('logical resource events survive view disposal', () => {
  const events = new ResourceEvents()
  let calls = 0
  events.once('destroyed', () => calls++)
  assert.equal(events.emit('destroyed'), true)
  assert.equal(events.emit('destroyed'), false)
  assert.equal(calls, 1)
})
