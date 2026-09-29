const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

test('interaction prompt refreshes bindings and devices without changing the nearby action', () => {
  const previous = {
    document: global.document,
    requestAnimationFrame: global.requestAnimationFrame,
    cancelAnimationFrame: global.cancelAnimationFrame,
  }
  const frames = new Map()
  const listeners = new Map()
  const classes = new Set()
  let nextFrame = 0
  let pad = null
  let enabled = true
  let binding = 'e'
  let interactButton = 'Button2'
  let removed = false
  const element = {
    textContent: '',
    children: [],
    replaceChildren(...children) {
      this.children = children
      this.textContent = children.map(child => child.textContent).join('')
    },
    setAttribute() {},
    classList: {
      add: value => classes.add(value),
      remove: value => classes.delete(value),
      toggle: (value, active) => (active ? classes.add(value) : classes.delete(value)),
    },
    remove: () => {
      removed = true
    },
  }
  global.document = {
    createElement: tag => (tag === 'div' ? element : { dataset: {}, textContent: '' }),
    createTextNode: text => ({ textContent: text }),
    addEventListener: (event, callback) => listeners.set(event, callback),
    removeEventListener: event => listeners.delete(event),
  }
  global.requestAnimationFrame = callback => {
    frames.set(++nextFrame, callback)
    return nextFrame
  }
  global.cancelAnimationFrame = id => frames.delete(id)
  const tick = () => {
    const [id, callback] = frames.entries().next().value
    frames.delete(id)
    callback()
  }
  try {
    const { HeroInteractionPrompt } = loadTsModule('app/ui/HeroInteractionPrompt.ts', {
      mocks: {
        '../lib/audio/settings': {
          getGamepadEnabled: () => enabled,
          getGamepadBindings: () => ({ heroInteract: interactButton }),
          getKeyBindings: () => ({ heroInteract: binding }),
          getControlKeyLabel: key => key.toUpperCase(),
          getGamepadButtonLabel: button => {
            return button === 'Button2' ? 'X' : 'Y'
          },
        },
        '../lib/input/gamepad': {
          GAMEPAD_BUTTON: { interact: 2 },
          GAMEPAD_AXIS: { moveX: 0, moveY: 1, aimX: 2, aimY: 3 },
          getActiveGamepad: () => pad,
          readStick: (gamepad, x, y) => ({ x: gamepad.axes[x], y: gamepad.axes[y] }),
        },
      },
    })
    const prompt = new HeroInteractionPrompt({ appendChild() {} })
    prompt.setAction('heroInteractionOpen')
    assert.equal(element.textContent, 'E — Ouvrir')
    binding = 'f'
    tick()
    assert.equal(element.textContent, 'F — Ouvrir')
    pad = { buttons: [{ pressed: false }], axes: [0, 0, 0, 0] }
    tick()
    assert.equal(element.textContent, 'X Ouvrir')
    assert.equal(element.children[0].className, 'gamepad-key')
    assert.equal(element.children[0].dataset.pad, '2')
    interactButton = 'Button3'
    tick()
    assert.equal(element.textContent, 'Y Ouvrir')
    assert.equal(element.children[0].dataset.pad, '3')
    interactButton = 'Button2'
    listeners.get('keydown')()
    assert.equal(element.textContent, 'F — Ouvrir')
    pad.axes[0] = 1
    tick()
    assert.equal(element.textContent, 'X Ouvrir')
    enabled = false
    tick()
    assert.equal(element.textContent, 'F — Ouvrir')
    enabled = true
    tick()
    assert.equal(element.textContent, 'X Ouvrir')
    pad = null
    tick()
    assert.equal(element.textContent, 'F — Ouvrir')
    prompt.setAction('heroInteractionSteal')
    assert.ok(classes.has('is-danger'))
    assert.equal(frames.size, 1)
    prompt.setAction(null)
    assert.equal(element.textContent, '')
    assert.equal(frames.size, 0)
    assert.ok(!classes.has('is-danger'))
    prompt.setAction('heroInteractionOpen')
    prompt.destroy()
    assert.equal(frames.size, 0)
    assert.equal(listeners.size, 0)
    assert.ok(removed)
  } finally {
    Object.assign(global, previous)
  }
})
