const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

test('variant rows support pointer and window directional input without leaving the row at either end', t => {
  const previous = global.document
  t.after(() => {
    global.document = previous
  })
  global.document = {
    createElement: () => ({
      setAttribute() {},
      addEventListener(name, callback) {
        this[name] = callback
      },
    }),
  }
  const options = { moduleCache: new Map(), mocks: { '../lang': { t: key => key }, '@pixi/sound': { sound: {} } } }
  const { attachVariantRow } = loadTsModule('app/lib/ui/VariantRow.ts', options)
  const { GameWindow } = loadTsModule('app/lib/ui/GameWindow.ts', options)
  const row = {
    title: 'House',
    focus() {},
    classList: { add() {} },
    appendChild(button) {
      this.buttons.push(button)
    },
  }
  let index = 0
  function render() {
    row.buttons = []
    attachVariantRow(row, {
      index,
      count: 3,
      onChange: next => {
        index = next
        render()
      },
    })
  }
  render()
  const window = Object.create(GameWindow.prototype)
  window.selected = row
  window.scheduleRefresh = () => {}
  window.items = () => assert.fail('horizontal movement must not leave a variant row')
  assert.equal(row.buttons[0].disabled, true)
  row.buttons[1].click({ preventDefault() {} })
  assert.equal(index, 1)
  window.move(1, 0)
  assert.equal(index, 2)
  assert.equal(row.buttons[1].disabled, true)
  window.move(1, 0)
  assert.equal(index, 2)
  window.move(-1, 0)
  window.move(-1, 0)
  window.move(-1, 0)
  assert.equal(index, 0)
  assert.equal(window.selected, row)
})
