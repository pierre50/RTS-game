const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')
const { requireFromTsFile } = require('./helpers/loadTsModule.cjs')

function loadSettings() {
  const filename = path.join(__dirname, '../app/lib/audio/settings.ts')
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
  const localRequire = request =>
    Object.hasOwn(mocks, request) ? mocks[request] : requireFromTsFile(request, filename, mocks)
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

    settings.setKeyBindingFromKeyboardEvent('heroTool1', { code: 'Digit1', key: '1' })
    assert.equal(settings.getControlActionForKeyboardEvent({ code: 'Digit1', key: '&' }), 'heroTool1')
  } finally {
    restore()
  }
})

test('H is the default call horse key for the hero', () => {
  const { settings, restore } = loadSettings()
  try {
    assert.equal(settings.getKeyBindings().heroMountHorse, 'h')
    assert.equal(settings.getControlActionForKeyboardEvent({ code: 'KeyH', key: 'h' }), 'heroMountHorse')
    assert.equal(settings.getControlActionForKeyboardEvent({ code: 'KeyH', key: 'H' }), 'heroMountHorse')
  } finally {
    restore()
  }
})

test('Shift is the default dismount horse key for the hero', () => {
  const { settings, restore } = loadSettings()
  try {
    assert.equal(settings.getKeyBindings().heroDismountHorse, 'Shift')
    assert.equal(settings.getControlActionForKeyboardEvent({ code: 'ShiftLeft', key: 'Shift' }), 'heroDismountHorse')
    assert.equal(settings.getControlKeyLabel(settings.getKeyBindings().heroDismountHorse), 'Shift')
  } finally {
    restore()
  }
})

test('E is the default hero interaction key', () => {
  const { settings, restore } = loadSettings()
  try {
    assert.equal(settings.getKeyBindings().heroInteract, 'e')
    assert.equal(settings.getControlActionForKeyboardEvent({ code: 'KeyE', key: 'e' }), 'heroInteract')
    assert.equal(settings.getControlActionForKeyboardEvent({ code: 'KeyE', key: 'E' }), 'heroInteract')

    settings.setKeyBindingFromKeyboardEvent('heroInteract', { code: 'KeyR', key: 'r' })
    assert.equal(settings.getKeyBindings().heroInteract, 'r')
  } finally {
    restore()
  }
})

test('Space is the default hero defense key', () => {
  const { settings, restore } = loadSettings()
  try {
    assert.equal(settings.getKeyBindings().heroDefense, 'Space')
    assert.equal(settings.getControlActionForKeyboardEvent({ code: 'Space', key: ' ' }), 'heroDefense')
    assert.equal(settings.getControlKeyLabel(settings.getKeyBindings().heroDefense), 'Space')
  } finally {
    restore()
  }
})

test('Control is the default hero direction lock key and can be rebound', () => {
  const { settings, restore } = loadSettings()
  try {
    assert.equal(settings.getKeyBindings().heroDirectionLock, 'Control')
    assert.equal(
      settings.getControlActionForKeyboardEvent({ code: 'ControlLeft', key: 'Control' }),
      'heroDirectionLock'
    )
    assert.equal(settings.getControlKeyLabel(settings.getKeyBindings().heroDirectionLock), 'Control')

    settings.setKeyBindingFromKeyboardEvent('heroDirectionLock', { code: 'ControlLeft', key: 'Control' })
    assert.equal(
      settings.getControlActionForKeyboardEvent({ code: 'ControlLeft', key: 'Control' }),
      'heroDirectionLock'
    )
    assert.equal(settings.getControlActionForKeyboardEvent({ code: 'ShiftLeft', key: 'Shift' }), 'heroDismountHorse')
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

test('inventory transfer gamepad bindings can be rebound and reset', () => {
  const { settings, restore } = loadSettings()
  try {
    assert.equal(settings.getGamepadBindings().inventoryTransferOne, 'Button0')
    assert.equal(settings.getGamepadBindings().inventoryTransferAll, 'Button2')
    assert.equal(settings.getGamepadButtonIndex('inventoryTransferOne'), 0)
    assert.equal(settings.getGamepadButtonLabel('Button2'), 'X / Square')

    settings.setGamepadBindingFromButtonIndex('inventoryTransferOne', 1)
    assert.equal(settings.getGamepadBindings().inventoryTransferOne, 'Button1')
    assert.equal(settings.getGamepadButtonIndex('inventoryTransferOne'), 1)

    settings.resetGamepadBindings()
    assert.equal(settings.getGamepadBindings().inventoryTransferOne, 'Button0')
  } finally {
    restore()
  }
})

test('blood effects setting defaults on and can be toggled', () => {
  const { settings, restore } = loadSettings()
  try {
    assert.equal(settings.getBloodEffectsEnabled(), true)

    settings.setBloodEffectsEnabled(false)
    assert.equal(settings.getBloodEffectsEnabled(), false)

    settings.setBloodEffectsEnabled(true)
    assert.equal(settings.getBloodEffectsEnabled(), true)
  } finally {
    restore()
  }
})
