const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function setup(t) {
  const previousDocument = global.document
  const previousWindow = global.window
  global.document = new EventTarget()
  global.window = new EventTarget()
  t.after(() => { global.document = previousDocument; global.window = previousWindow })
  const api = loadTsModule('app/classes/ControlsKeyboard.ts', {
    mocks: { '../lib/audio/settings': { getControlActionForKeyboardEvent: event => event.action } },
  })
  const pressed = []
  const target = {
    keyActionsByCode: {}, keysPressed: {}, keyPressedCount: 0,
    isInteractionBlocked: () => false,
    heroController: { handleKeyDown: action => pressed.push(action) },
  }
  const capture = keys => api.captureControlsMovement({ keyActionsByCode: keys, isEditableTarget: () => false })
  const send = (type, properties = {}) => document.dispatchEvent(Object.assign(new Event(type), properties))
  return { ...api, capture, send, target, pressed }
}

for (const action of ['heroUp', 'heroDown', 'heroLeft', 'heroRight', 'cameraUp', 'cameraDown', 'cameraLeft', 'cameraRight']) {
  test(`held ${action} survives replacement of the controls without another keydown`, t => {
    const { capture, restoreControlsMovement, target, pressed } = setup(t)
    const keys = { PhysicalKey: action, KeyE: 'heroInteract' }
    const release = capture(keys)
    delete keys.PhysicalKey
    restoreControlsMovement(target, release())
    assert.deepEqual(target.keyActionsByCode, { PhysicalKey: action })
    if (action.startsWith('hero')) assert.deepEqual(pressed, [action])
    else { assert.equal(target.keysPressed[action], true); assert.equal(target.keyPressedCount, 1) }
  })
}

test('diagonals resume, but a key released or changed during loading is respected', t => {
  const { capture, send, restoreControlsMovement, target, pressed } = setup(t)
  const release = capture({ KeyZ: 'heroUp', KeyD: 'heroRight' })
  send('keyup', { code: 'KeyZ' })
  send('keydown', { code: 'KeyS', action: 'heroDown' })
  send('keydown', { code: 'KeyE', action: 'heroInteract' })
  restoreControlsMovement(target, release())
  assert.deepEqual(pressed.sort(), ['heroDown', 'heroRight'])
  assert.deepEqual(target.keyActionsByCode, { KeyD: 'heroRight', KeyS: 'heroDown' })
})

test('losing focus clears held movement and repeated keydown does not revive it', t => {
  const { capture, send } = setup(t)
  const release = capture({ KeyZ: 'heroUp' })
  window.dispatchEvent(new Event('blur'))
  send('keydown', { code: 'KeyZ', action: 'heroUp', repeat: true })
  assert.deepEqual(release(), {})
})

test('capture listeners are removed after the transition', t => {
  const { capture, send } = setup(t)
  const release = capture({ KeyZ: 'heroUp' })
  const held = release()
  send('keyup', { code: 'KeyZ' })
  window.dispatchEvent(new Event('blur'))
  assert.deepEqual(held, { KeyZ: 'heroUp' })
})
