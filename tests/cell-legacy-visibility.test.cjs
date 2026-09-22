const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

test('runtime cells ignore legacy fog data without allocating per-cell visibility state', () => {
  const { RuntimeCell } = loadTsModule('app/classes/cell/RuntimeCell.ts', {
    mocks: { '../../lib': { updateInstanceRenderVisibility() {} } },
  })
  const occupant = { label: 'tree' }
  const cell = new RuntimeCell({
    i: 1,
    j: 2,
    x: 32,
    y: 48,
    z: 0,
    type: 'Grass',
    context: { map: {} },
    has: occupant,
    fogSprites: [{ textureSheet: 'old' }],
    _hasFog: true,
    viewed: true,
    viewBy: new Set(['old-unit']),
  })
  assert.equal(cell.has, occupant)
  for (const field of ['fogSprites', '_hasFog', 'viewed', 'viewBy', 'cellFog', '_fogChunks']) {
    assert.equal(field in cell, false, field)
  }
})
