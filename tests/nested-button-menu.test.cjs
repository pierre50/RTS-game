const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')

function loadModule(relativePath) {
  const filename = path.join(__dirname, '..', relativePath)
  const source = fs.readFileSync(filename, 'utf8')
  const { code } = babel.transformSync(source, {
    filename,
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }], '@babel/preset-typescript'],
  })
  const module = { exports: {} }
  new Function('module', 'exports', code)(module, module.exports)
  return module.exports
}

function makeFakeElement() {
  return {
    children: [],
    textContent: '',
    disabled: false,
    hidden: false,
    _listeners: {},
    appendChild(child) {
      this.children.push(child)
      return child
    },
    addEventListener(type, handler) {
      this._listeners[type] = this._listeners[type] || []
      this._listeners[type].push(handler)
    },
    click() {
      ;(this._listeners.click || []).forEach(handler => handler())
    },
  }
}

function withFakeDocument(fn) {
  global.document = { createElement: () => makeFakeElement() }
  try {
    fn()
  } finally {
    delete global.document
  }
}

test('NestedButtonMenu navigates into child buttons and back to the root', () => {
  withFakeDocument(() => {
    const calls = []
    const container = makeFakeElement()
    const { NestedButtonMenu } = loadModule('app/ui/menu/NestedButtonMenu.ts')
    const menu = new NestedButtonMenu({
      container,
      backLabel: 'Back',
      items: [
        { id: 'move', label: 'Move', onClick: () => calls.push('move') },
        {
          id: 'resources',
          label: 'Resources',
          children: [
            { id: 'wood', label: 'Wood', onClick: () => calls.push('wood') },
            { id: 'gold', label: 'Gold', onClick: () => calls.push('gold') },
          ],
        },
      ],
      onNavigate: () => calls.push('navigate'),
      onBack: () => calls.push('back'),
    })

    assert.equal(menu.buttons.get('move').hidden, false)
    assert.equal(menu.buttons.get('resources').hidden, false)
    assert.equal(menu.buttons.get('wood').hidden, true)
    assert.equal(menu.buttons.get('back').hidden, true)

    menu.buttons.get('resources').click()

    assert.equal(menu.buttons.get('move').hidden, true)
    assert.equal(menu.buttons.get('resources').hidden, true)
    assert.equal(menu.buttons.get('wood').hidden, false)
    assert.equal(menu.buttons.get('gold').hidden, false)
    assert.equal(menu.buttons.get('back').hidden, false)

    menu.buttons.get('wood').click()
    menu.buttons.get('back').click()

    assert.equal(menu.buttons.get('move').hidden, false)
    assert.equal(menu.buttons.get('resources').hidden, false)
    assert.equal(menu.buttons.get('wood').hidden, true)
    assert.equal(menu.buttons.get('back').hidden, true)
    assert.deepEqual(calls, ['navigate', 'wood', 'back'])
  })
})

test('NestedButtonMenu reset returns nested menus to the root level', () => {
  withFakeDocument(() => {
    const container = makeFakeElement()
    const { NestedButtonMenu } = loadModule('app/ui/menu/NestedButtonMenu.ts')
    const menu = new NestedButtonMenu({
      container,
      backLabel: 'Back',
      items: [
        {
          id: 'resources',
          label: 'Resources',
          children: [{ id: 'food', label: 'Food' }],
        },
      ],
    })

    menu.buttons.get('resources').click()
    assert.equal(menu.buttons.get('food').hidden, false)

    menu.reset()

    assert.equal(menu.buttons.get('resources').hidden, false)
    assert.equal(menu.buttons.get('food').hidden, true)
    assert.equal(menu.buttons.get('back').hidden, true)
  })
})
