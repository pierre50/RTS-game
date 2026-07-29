const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')

function loadSettings() {
  const filename = path.join(__dirname, '../app/lib/settings.ts')
  const source = fs.readFileSync(filename, 'utf8')
  const { code } = babel.transformSync(source, {
    filename,
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }], '@babel/preset-typescript'],
  })
  const module = { exports: {} }
  const store = new Map()
  const previousLocalStorage = global.localStorage
  const previousWindow = global.window

  global.localStorage = {
    getItem: key => store.get(key) ?? null,
    setItem: (key, value) => store.set(key, String(value)),
  }
  global.window = {
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {},
  }

  const mocks = {
    '@pixi/sound': { sound: { volumeAll: 1 } },
  }
  const localRequire = request => (Object.hasOwn(mocks, request) ? mocks[request] : require(request))
  new Function('module', 'exports', 'require', code)(module, module.exports, localRequire)
  return {
    settings: module.exports,
    restore() {
      global.localStorage = previousLocalStorage
      global.window = previousWindow
    },
  }
}

test('hero equipped item slots follow the physical digit row across keyboard layouts', () => {
  const { settings, restore } = loadSettings()
  try {
    assert.equal(settings.getKeyBindings().heroTool1, 'Digit1')
    assert.equal(settings.getKeyBindings().heroTool4, 'Digit4')
    assert.equal(settings.getControlActionForKeyboardEvent({ code: 'Digit1', key: '&' }), 'heroTool1')
    assert.equal(settings.getControlActionForKeyboardEvent({ code: 'Digit1', key: '1' }), 'heroTool1')
    assert.equal(settings.getControlActionForKeyboardEvent({ code: 'Numpad1', key: '1' }), 'heroTool1')
    assert.equal(settings.getControlActionForKeyboardEvent({ code: 'Digit4', key: "'" }), 'heroTool4')

    settings.setKeyBinding('heroTool1', '1')
    assert.equal(settings.getControlActionForKeyboardEvent({ code: 'Digit1', key: '&' }), 'heroTool1')
  } finally {
    restore()
  }
})

test('H is the default debug mount key for the hero', () => {
  const { settings, restore } = loadSettings()
  try {
    assert.equal(settings.getKeyBindings().heroMountHorse, 'h')
    assert.equal(settings.getControlActionForKeyboardEvent({ code: 'KeyH', key: 'h' }), 'heroMountHorse')
    assert.equal(settings.getControlActionForKeyboardEvent({ code: 'KeyH', key: 'H' }), 'heroMountHorse')
  } finally {
    restore()
  }
})

test('recording a digit-row binding stores the physical key code', () => {
  const { settings, restore } = loadSettings()
  try {
    settings.setKeyBindingFromKeyboardEvent('heroTool2', { code: 'Digit2', key: 'é' })
    assert.equal(settings.getKeyBindings().heroTool2, 'Digit2')
    assert.equal(settings.getControlKeyLabel(settings.getKeyBindings().heroTool2), '2')
  } finally {
    restore()
  }
})
