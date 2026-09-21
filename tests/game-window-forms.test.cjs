const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { adjustWindowField, canAdjustWindowField } = loadTsModule('app/lib/ui/GameWindowForms.ts', {
  mocks: { '../lang': { t: key => key } },
})

test('range navigation respects limits and delivers the input and change events', () => {
  const previous = global.HTMLSelectElement
  global.HTMLSelectElement = class {}
  try {
    const range = {
      type: 'range',
      value: '0.6',
      min: '0',
      max: '1',
      step: '0.05',
      events: [],
      matches() {
        return true
      },
      dispatchEvent(event) {
        this.events.push(event.type)
      },
    }
    adjustWindowField(range, 1)
    assert.equal(range.value, '0.65')
    assert.deepEqual(range.events, ['input', 'change'])
    range.value = '1'
    adjustWindowField(range, 1)
    assert.equal(range.value, '1')
    assert.equal(range.events.length, 2)
    range.value = '0'
    adjustWindowField(range, -1)
    assert.equal(range.value, '0')
    range.disabled = true
    adjustWindowField(range, 1)
    assert.equal(range.value, '0')
  } finally {
    global.HTMLSelectElement = previous
  }
})

test('choice navigation skips unavailable options and calls the existing change handler once', () => {
  const previous = global.HTMLSelectElement
  class Select {
    selectedIndex = 0
    disabled = false
    options = [{}, { disabled: true }, { hidden: true }, {}]
    events = []
    matches() {
      return true
    }
    dispatchEvent(event) {
      this.events.push(event.type)
    }
  }
  global.HTMLSelectElement = Select
  try {
    const select = new Select()
    adjustWindowField(select, 1)
    assert.equal(select.selectedIndex, 3)
    assert.deepEqual(select.events, ['change'])
    assert.equal(canAdjustWindowField(select, 1), false)
    adjustWindowField(select, 1)
    assert.deepEqual(select.events, ['change'])
    select.disabled = true
    adjustWindowField(select, -1)
    assert.equal(select.selectedIndex, 3)
    select.disabled = false
    adjustWindowField(select, -1)
    assert.equal(select.selectedIndex, 0)
  } finally {
    global.HTMLSelectElement = previous
  }
})
