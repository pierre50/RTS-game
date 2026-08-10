const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')
const LZString = require('lz-string')

function loadSaveStorage(storage) {
  const filename = path.join(__dirname, '../app/serialization/SaveStorage.ts')
  const source = fs.readFileSync(filename, 'utf8')
  const { code } = babel.transformSync(source, {
    filename,
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }], '@babel/preset-typescript'],
  })
  const module = { exports: {} }
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

  new Function('module', 'exports', 'require', code)(module, module.exports, mockRequire)
  return module.exports
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

function makeMemoryStorage(initial = {}) {
  const items = new Map(Object.entries(initial))
  return {
    items,
    getItem: key => items.get(key) ?? null,
    setItem: (key, value) => {
      items.set(key, value)
    },
    removeItem: key => {
      items.delete(key)
    },
  }
}

function compressedSave(data = minimalSaveRecord()) {
  return LZString.compressToBase64(JSON.stringify(data))
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

test('listSaves removes missing and corrupt entries from the index', () => {
  const index = [
    { key: 'save_1', name: 'Missing', date: 1 },
    { key: 'save_2', name: 'Corrupt', date: 2 },
    { key: 'save_3', name: 'Valid', date: 3 },
  ]
  const storage = makeMemoryStorage({
    saves_index: JSON.stringify(index),
    save_2: 'not-compressed-json',
    save_3: compressedSave(),
  })

  const { listSaves } = loadSaveStorage(storage)

  assert.deepEqual(listSaves(), [{ key: 'save_3', name: 'Valid', date: 3 }])
  assert.deepEqual(JSON.parse(storage.items.get('saves_index')), [{ key: 'save_3', name: 'Valid', date: 3 }])
})

test('saveRecord creates numeric unique keys inside the same millisecond', () => {
  const storage = makeMemoryStorage({ saves_index: '[]' })
  const previousNow = Date.now
  Date.now = () => 1234567890

  try {
    const { saveRecord } = loadSaveStorage(storage)

    assert.equal(saveRecord(minimalSaveRecord()).key, 'save_1234567890')
    assert.equal(saveRecord(minimalSaveRecord()).key, 'save_1234567891')
    assert.equal(storage.items.has('save_1234567890'), true)
    assert.equal(storage.items.has('save_1234567891'), true)
  } finally {
    Date.now = previousNow
  }
})
