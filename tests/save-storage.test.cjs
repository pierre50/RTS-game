const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')

function loadSaveStorage(storage) {
  const filename = path.join(__dirname, '../app/serialization/SaveStorage.ts')
  const source = fs.readFileSync(filename, 'utf8')
  const { code } = babel.transformSync(source, {
    filename,
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }], '@babel/preset-typescript'],
  })
  const module = { exports: {} }
  const previousWindow = global.window
  const previousLocalStorage = global.localStorage
  global.window = {}
  global.localStorage = storage
  const mockRequire = id => {
    if (id === './SaveSerializer') return { serializeGame: () => ({}) }
    if (id === './CampaignSave') {
      return {
        createInitialCampaignSave: data => data,
        updateCurrentWorldState: (_campaign, data) => data,
      }
    }
    return require(id)
  }

  try {
    new Function('module', 'exports', 'require', code)(module, module.exports, mockRequire)
    return module.exports
  } finally {
    global.window = previousWindow
    global.localStorage = previousLocalStorage
  }
}

function minimalSaveRecord() {
  return {
    version: 2,
    runtime: { elapsedMs: 0 },
    camera: { x: 0, y: 0 },
    world: { seed: 1, size: 16, mapType: 'continent' },
    config: { seed: 1, size: 16, mapType: 'continent' },
    players: [],
    resources: [],
    animals: [],
  }
}

test('autosave storage failures do not throw', () => {
  const storage = {
    getItem: () => '[]',
    setItem: () => {
      throw new Error('quota')
    },
    removeItem: () => {},
  }
  const warnings = []
  const previousWarn = console.warn
  console.warn = (...args) => warnings.push(args)

  try {
    const { autosaveRecord, saveRecord } = loadSaveStorage(storage)
    assert.equal(autosaveRecord(minimalSaveRecord()), null)
    assert.equal(warnings.length, 1)
    assert.throws(() => saveRecord(minimalSaveRecord()), /STORAGE_FULL/)
  } finally {
    console.warn = previousWarn
  }
})
