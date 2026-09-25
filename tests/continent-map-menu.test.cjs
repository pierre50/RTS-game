const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

test('map menu selects the matching continent blueprint and resets normal size', t => {
  const previous = global.document
  global.document = { createElement: () => ({ appendChild() {} }) }
  t.after(() => {
    if (previous === undefined) delete global.document
    else global.document = previous
  })
  const rows = []
  const { default: MapConfig } = loadTsModule('app/screens/MapConfig.ts', {
    mocks: {
      '../lib': { Modal: class {} },
      '../lib/audio/uiSound': { playClickSound() {} },
      '../lib/lang': { t: key => key },
      '../ui/utils/formUtils': {
        buildSelectRow(label, options, value, change) {
          rows.push({ label, options, value, change })
          return {}
        },
      },
      '../ui/PlayerSetupPanel': {
        PlayerSetupPanel: class {
          element = {}
          appendSimplifiedControl() {}
        },
      },
    },
  })
  const screen = Object.create(MapConfig.prototype)
  screen.config = {}
  screen._createButton = () => ({})
  screen._buildContent()
  const row = rows[0]
  assert.deepEqual(
    row.options.map(option => option.value),
    ['normal', 'world-test-1000', 'world-test-5000']
  )
  for (const [id, size] of [
    ['world-test-1000', 999],
    ['world-test-5000', 4999],
    ['normal', 144],
  ]) {
    row.change(id)
    assert.equal(screen.config.size, size)
    assert.equal(screen.config.worldId, id === 'normal' ? 'world-4242' : id)
  }
})
