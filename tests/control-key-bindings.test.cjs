const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')
const { requireFromTsFile } = require('./helpers/loadTsModule.cjs')

function loadSettings(initialStore = {}) {
  const filename = path.join(__dirname, '../app/lib/audio/settings.ts')
  const source = fs.readFileSync(filename, 'utf8')
  const { code } = babel.transformSync(source, {
    filename,
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }], '@babel/preset-typescript'],
  })
  const module = { exports: {} }
  const store = new Map(Object.entries(initialStore))
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
    saved: () => Object.fromEntries(store),
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
    assert.equal(settings.getKeyBindings().heroTool3, 'Digit3')
    assert.equal(settings.getControlActionForKeyboardEvent({ code: 'Digit1', key: '&' }), 'heroTool1')
    assert.equal(settings.getControlActionForKeyboardEvent({ code: 'Digit1', key: '1' }), 'heroTool1')
    assert.equal(settings.getControlActionForKeyboardEvent({ code: 'Numpad1', key: '1' }), 'heroTool1')
    assert.equal(settings.getControlActionForKeyboardEvent({ code: 'Digit3', key: '"' }), 'heroTool3')

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

test('all exposed gamepad actions have defaults and can be rebound and reset', () => {
  const { settings, restore } = loadSettings()
  try {
    const defaults = settings.getGamepadBindings()
    const actions = settings.GAMEPAD_BINDING_GROUPS.flatMap(group => group.actions)
    assert.deepEqual(new Set(actions), new Set(Object.keys(defaults)))
    assert.equal(defaults.heroAction, 'Button5')
    assert.equal(defaults.heroInteract, 'Button2')
    assert.equal(defaults.placementPlace, 'Button0')
    for (const action of actions) {
      settings.setGamepadBindingFromButtonIndex(action, 11)
      assert.equal(settings.getGamepadButtonIndex(action), 11)
    }
    assert.deepEqual(settings.resetGamepadBindings(), defaults)
  } finally {
    restore()
  }
})

test('gamepad bindings preserve old transfer preferences, save new actions and restore defaults', () => {
  let saved
  const first = loadSettings({ controls_gamepad_bindings: JSON.stringify({ inventoryTransferOne: 'Button9' }) })
  try {
    assert.equal(first.settings.getGamepadButtonIndex('inventoryTransferOne'), 9)
    assert.equal(first.settings.getGamepadButtonIndex('heroInteract'), 2)
    first.settings.setGamepadBindingFromButtonIndex('heroInteract', 10)
    first.settings.setGamepadBindingFromButtonIndex('placementPlace', 11)
    saved = first.saved()
  } finally {
    first.restore()
  }
  const second = loadSettings(saved)
  try {
    assert.equal(second.settings.getGamepadButtonIndex('heroInteract'), 10)
    assert.equal(second.settings.getGamepadButtonIndex('placementPlace'), 11)
    assert.equal(second.settings.getGamepadButtonIndex('inventoryTransferOne'), 9)
    second.settings.resetGamepadBindings()
    saved = second.saved()
  } finally {
    second.restore()
  }
  const third = loadSettings(saved)
  try {
    assert.equal(third.settings.getGamepadButtonIndex('heroInteract'), 2)
    assert.equal(third.settings.getGamepadButtonIndex('placementPlace'), 0)
    assert.equal(third.settings.getGamepadButtonIndex('inventoryTransferOne'), 0)
  } finally {
    third.restore()
  }
})

test('section resets preserve bindings outside that section and the other device', () => {
  const { settings, restore } = loadSettings()
  try {
    settings.setGamepadBindingFromButtonIndex('heroInteract', 0)
    settings.setGamepadBindingFromButtonIndex('placementPlace', 3)
    settings.setKeyBindingFromKeyboardEvent('inventory', { key: 'o', code: 'KeyO' })
    settings.resetGamepadBindings(['placementPlace', 'placementMirror', 'placementCancel'])
    assert.equal(settings.getGamepadButtonIndex('placementPlace'), 0)
    assert.equal(settings.getGamepadButtonIndex('heroInteract'), 0)
    assert.equal(settings.getKeyBindings().inventory, 'o')
    settings.setKeyBindingFromKeyboardEvent('cameraUp', { key: 'u', code: 'KeyU' })
    settings.resetKeyBindings(['inventory'])
    assert.equal(settings.getKeyBindings().inventory, 'i')
    assert.equal(settings.getKeyBindings().cameraUp, 'u')
    assert.equal(settings.getGamepadButtonIndex('heroInteract'), 0)
  } finally {
    restore()
  }
})

test('controller swaps honor gameplay contexts and reject new third-party conflicts', () => {
  const { settings, restore } = loadSettings()
  try {
    const proposal = settings.getGamepadBindingChange('heroInteract', 4)
    assert.deepEqual(proposal.conflicts, ['heroDefense'])
    assert.equal(settings.getGamepadButtonIndex('heroInteract'), 2)
    assert.equal(settings.rebindGamepadButton('heroInteract', 4), true)
    assert.equal(settings.getGamepadButtonIndex('heroInteract'), 4)
    assert.equal(settings.getGamepadButtonIndex('heroDefense'), 2)
    assert.equal(settings.getGamepadButtonIndex('placementMirror'), 2)
    assert.equal(settings.getGamepadButtonIndex('inventoryTransferAll'), 2)
    assert.deepEqual(settings.getGamepadBindingChange('placementMirror', 4).conflicts, [])
    settings.setGamepadBindingFromButtonIndex('heroAction', 0)
    assert.deepEqual(settings.getGamepadBindingChange('placementPlace', 9).conflicts, ['gameMenu'])
    assert.equal(settings.getGamepadBindingChange('placementPlace', 9).swapped, null)
    assert.equal(settings.rebindGamepadButton('placementPlace', 9), false)
    assert.equal(settings.getGamepadButtonIndex('placementPlace'), 0)
    assert.equal(settings.getGamepadButtonIndex('gameMenu'), 9)
  } finally {
    restore()
  }
})

test('keyboard swaps recognize physical digit aliases and keep unrelated keys', () => {
  const { settings, restore } = loadSettings()
  try {
    const event = { key: '&', code: 'Digit1' }
    assert.deepEqual(settings.getKeyboardBindingChange('heroInteract', event).conflicts, ['heroTool1'])
    assert.equal(settings.getKeyBindings().heroInteract, 'e')
    assert.equal(settings.rebindKeyboardKey('heroInteract', event), true)
    assert.equal(settings.getKeyBindings().heroInteract, 'Digit1')
    assert.equal(settings.getKeyBindings().heroTool1, 'e')
    assert.equal(settings.getKeyBindings().inventory, 'i')
  } finally {
    restore()
  }
})

test('standalone pause binding is removed, including saved shortcuts', () => {
  const { settings, restore } = loadSettings({ controls_key_bindings: JSON.stringify({ pause: 'p' }) })
  try {
    assert.equal(settings.getKeyBindings().pause, undefined)
    assert.equal(settings.getControlActionForKeyboardEvent({ code: 'KeyP', key: 'p' }), null)
    assert.equal(settings.getControlActionForKeyboardEvent({ code: 'KeyP', key: 'P' }), null)
    assert.equal(
      settings.CONTROL_BINDING_GROUPS.some(group => group.actions.includes('pause')),
      false
    )
  } finally {
    restore()
  }
})
