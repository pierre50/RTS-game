const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { editVirtualKeyboardText: edit } = loadTsModule('app/lib/ui/VirtualKeyboardText.ts')

test('virtual typing replaces a selection and inserts at the caret', () => {
  assert.deepEqual(edit('bonjour', 3, 7, 's', 20), { value: 'bons', caret: 4 })
  assert.deepEqual(edit('abcd', 2, 2, 'X', 20), { value: 'abXcd', caret: 3 })
})
test('backspace removes selections or complete Unicode characters without deleting ahead', () => {
  assert.deepEqual(edit('a😀b', 3, 3, '{bksp}', -1), { value: 'ab', caret: 1 })
  assert.deepEqual(edit('abcd', 1, 3, '{bksp}', -1), { value: 'ad', caret: 1 })
  assert.deepEqual(edit('abc', 0, 0, '{bksp}', -1), { value: 'abc', caret: 0 })
})
test('maxLength still permits replacement and deletion', () => {
  assert.deepEqual(edit('abc', 3, 3, 'd', 3), { value: 'abc', caret: 3 })
  assert.deepEqual(edit('abc', 1, 2, 'd', 3), { value: 'adc', caret: 2 })
  assert.deepEqual(edit('abc', 3, 3, '{bksp}', 3), { value: 'ab', caret: 2 })
})
test('fields without selection APIs append, and textarea supports newline', () => {
  assert.deepEqual(edit('12', null, null, '3', -1), { value: '123', caret: 3 })
  assert.deepEqual(edit('a', 1, 1, '{newline}', -1), { value: 'a\n', caret: 2 })
})

test('moving onto a text field consumes the frame before underlying window commands', context => {
  const previous = global.document
  let open = false
  global.document = { querySelector: () => (open ? {} : null) }
  context.after(() => {
    global.document = previous
  })
  const { GameWindow } = loadTsModule('app/lib/ui/GameWindow.ts', {
    mocks: { '../lang': { t: key => key }, '../audio/settings': {} },
  })
  const instance = Object.create(GameWindow.prototype)
  Object.assign(instance, {
    padState: { read: () => ({ pressed: [0], direction: [0, 1] }) },
    commands: [{ pad: 0, run: () => assert.fail('underlying action must not execute') }],
    setMode() {},
    refresh() {},
    move() {
      open = true
    },
  })
  instance.readGamepad({ index: 0, buttons: [], axes: [] }, 1)
  assert.equal(open, true)
})

test('layout follows language until a saved choice overrides it, independently of label language', context => {
  const previous = global.localStorage
  const saved = new Map()
  global.localStorage = {
    getItem: key => saved.get(key) ?? null,
    setItem: (key, value) => saved.set(key, value),
    removeItem: key => saved.delete(key),
  }
  context.after(() => {
    global.localStorage = previous
  })
  let lang = 'fr'
  const options = { mocks: { '../lang': { getLang: () => lang } } }
  const path = 'app/lib/input/virtualKeyboardSettings.ts'
  const settings = loadTsModule(path, options)
  assert.equal(settings.getVirtualKeyboardLayout(), 'auto')
  assert.equal(settings.usesAzertyVirtualKeyboard(), true)
  lang = 'en'
  assert.equal(settings.usesAzertyVirtualKeyboard(), false)
  settings.setVirtualKeyboardLayout('azerty')
  assert.equal(loadTsModule(path, options).usesAzertyVirtualKeyboard(), true)
  settings.setVirtualKeyboardLayout('qwerty')
  lang = 'fr'
  assert.equal(settings.usesAzertyVirtualKeyboard(), false)
  settings.setVirtualKeyboardLayout('auto')
  assert.equal(settings.usesAzertyVirtualKeyboard(), true)
})
