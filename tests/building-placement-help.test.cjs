const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

test('placement immediately displays controller buttons and switches back with the mouse', () => {
  const previousDocument = global.document
  const listeners = new Map()
  let refreshSettings
  let placeButton = 3
  let stopped = 0
  let footer
  const makeElement = () => ({
    children: [],
    dataset: {},
    setAttribute() {},
    contains() {
      return false
    },
    appendChild(child) {
      this.children.push(child)
    },
    replaceChildren(...children) {
      this.children = children
    },
    addEventListener() {},
    remove() {},
  })
  global.document = {
    querySelector: () => null,
    createElement: makeElement,
    createTextNode: text => ({ textContent: text }),
    body: {
      appendChild: element => {
        footer = element
      },
    },
    addEventListener: (event, callback) => listeners.set(event, callback),
    removeEventListener: event => listeners.delete(event),
  }
  try {
    const { BuildingPlacementHelp } = loadTsModule('app/ui/BuildingPlacementHelp.ts', {
      mocks: {
        '../lib/audio/settings': {
          onVisualSettingsChange: callback => {
            refreshSettings = callback
            return () => stopped++
          },
          getGamepadButtonIndex: action =>
            ({
              placementPlace: placeButton,
              placementMirror: 4,
              placementCancel: 8,
              destinationConfirm: 0,
              destinationCancel: 1,
            })[action],
        },
      },
    })
    const actions = { place() {}, mirror() {}, cancel() {}, canMirror: true }
    const keys = () => footer.children.slice(1).map(button => button.children[0].textContent)
    const help = new BuildingPlacementHelp(actions, true)
    assert.deepEqual(keys(), ['Y', 'LB', 'View'])
    assert.deepEqual(
      footer.children.slice(1).map(button => button.children[0].dataset.pad),
      ['3', '4', '8']
    )
    assert.ok(footer.children.slice(1).every(button => button.children[0].className === 'gamepad-key'))
    listeners.get('pointermove')()
    assert.deepEqual(keys(), ['↵', 'R', 'Esc'])
    help.setGamepad(true)
    assert.deepEqual(keys(), ['Y', 'LB', 'View'])
    placeButton = 0
    refreshSettings()
    assert.deepEqual(keys(), ['A', 'LB', 'View'])
    help.destroy()
    assert.equal(stopped, 1)
    assert.equal(listeners.size, 0)
    const keyboard = new BuildingPlacementHelp(actions)
    assert.deepEqual(keys(), ['↵', 'R', 'Esc'])
    keyboard.destroy()
    const calls = []
    const destination = new BuildingPlacementHelp(
      {
        ...actions,
        place: () => calls.push('confirm'),
        cancel: () => calls.push('cancel'),
        destination: true,
        canMirror: false,
      },
      true
    )
    assert.deepEqual(keys(), ['A', 'LB', 'B'])
    assert.equal(footer.children[2].hidden, true)
    const key = listeners.get('keydown')
    const event = { preventDefault() {}, stopImmediatePropagation() {} }
    key({ ...event, key: 'Enter' })
    key({ ...event, key: 'Enter', repeat: true })
    key({ ...event, key: 'Escape' })
    assert.deepEqual(calls, ['confirm', 'cancel'])
    destination.destroy()
  } finally {
    global.document = previousDocument
  }
})
