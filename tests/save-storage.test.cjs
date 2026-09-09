const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')
const LZString = require('lz-string')

function loadSaveStorage(storage, electronSaves) {
  const filename = path.join(__dirname, '../app/serialization/SaveStorage.ts')
  const source = fs.readFileSync(filename, 'utf8')
  const { code } = babel.transformSync(source, {
    filename,
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }], '@babel/preset-typescript'],
  })
  const module = { exports: {} }
  global.window = { electronSaves }
  global.localStorage = storage
  const mockRequire = id => {
    if (id === './SaveSerializer') return { serializeGame: () => ({}) }
    if (id === './CampaignSave') {
      return {
        createInitialCampaignSave: data => data,
        updateCurrentWorldState: (_campaign, data) => data,
      }
    }
    if (id === '../lib/debug') return { debugLog: () => {} }
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
    world: { seed: 1, size: 16, mapType: 'world-region' },
    config: { seed: 1, size: 16, mapType: 'world-region' },
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

test('invalid index shapes and entries do not crash listing or saving', () => {
  for (const raw of ['broken', 'null', '{}', '1', '"index"']) {
    const storage = makeMemoryStorage({ saves_index: raw })
    const api = loadSaveStorage(storage)
    assert.deepEqual(api.listSaves(), [])
    assert.ok(api.saveRecord(minimalSaveRecord()).key)
  }
  const valid = { key: 'save_1', name: 'Good', date: 1 }
  const invalid = [
    null,
    1,
    {},
    { ...valid, key: '' },
    { ...valid, key: 1 },
    { ...valid, name: null },
    { ...valid, date: '1' },
    { ...valid, date: null },
  ]
  const storage = makeMemoryStorage({ saves_index: JSON.stringify([...invalid, valid]), save_1: compressedSave() })
  assert.deepEqual(loadSaveStorage(storage).listSaves(), [valid])
})

test('manual limits allow replacement and autosaving, then deletion frees a slot', () => {
  const storage = makeMemoryStorage()
  const api = loadSaveStorage(storage)
  for (let i = 1; i <= 10; i++) api.saveRecord(minimalSaveRecord(), { key: `save_${i}`, name: `Save ${i}` })
  assert.throws(() => api.saveRecord(minimalSaveRecord()), /MAX_SAVES_REACHED/)
  assert.equal(api.saveRecord(minimalSaveRecord(), { key: 'save_1', name: 'Replacement' }).name, 'Replacement')
  assert.equal(api.autosaveRecord(minimalSaveRecord()).key, 'save_0')
  assert.equal(api.autosaveRecord(minimalSaveRecord(), 'Automatic').name, 'Automatic')
  assert.equal(api.listSaves().length, 11)
  api.deleteSave('save_1')
  api.deleteSave('save_2')
  assert.equal(storage.items.has('save_1'), false)
  assert.ok(api.saveRecord(minimalSaveRecord()).key)
  assert.deepEqual(api.loadSave('save_0'), minimalSaveRecord())
  assert.deepEqual(api.buildSaveRecord({}), {})
  assert.deepEqual(api.buildSaveRecord({}, { version: 1 }), {})
})

test('missing and corrupt saves return explicit errors and listing survives index write failure', t => {
  const storage = makeMemoryStorage({
    saves_index: JSON.stringify([{ key: 'bad', name: 'Bad', date: 0 }]),
    bad: LZString.compressToBase64('{'),
    empty: LZString.compressToBase64(''),
  })
  const api = loadSaveStorage(storage)
  assert.throws(() => api.loadSave('missing'), /SAVE_NOT_FOUND/)
  assert.throws(() => api.loadSave('bad'), /SAVE_CORRUPT/)
  assert.throws(() => api.loadSave('empty'), /SAVE_CORRUPT/)
  t.mock.method(storage, 'setItem', () => {
    throw new Error('quota')
  })
  const warn = t.mock.method(console, 'warn', () => {})
  assert.deepEqual(api.listSaves(), [])
  assert.equal(warn.mock.callCount(), 1)
})

function electronStorage(storage, result = true) {
  return {
    getIndex: () => storage.getItem('saves_index'),
    setIndex: value => {
      storage.setItem('saves_index', value)
      return result
    },
    getItem: storage.getItem,
    setItem: (key, value) => {
      storage.setItem(key, value)
      return result
    },
    removeItem: storage.removeItem,
  }
}

test('Electron storage accepts both success protocols and surfaces detailed write failures', () => {
  for (const result of [true, { ok: true }]) {
    const storage = makeMemoryStorage()
    const api = loadSaveStorage(storage, electronStorage(storage, result))
    const saved = api.saveRecord(minimalSaveRecord())
    assert.deepEqual(api.loadSave(saved.key), minimalSaveRecord())
    assert.equal(api.listSaves().length, 1)
    api.deleteSave(saved.key)
    assert.deepEqual(api.listSaves(), [])
  }
  for (const [result, message] of [
    [false, /STORAGE_FULL/],
    [{}, /STORAGE_FULL/],
    [{ ok: false, error: 'disk', path: '/saves' }, /STORAGE_FULL: disk path=\/saves/],
  ]) {
    const storage = makeMemoryStorage()
    assert.throws(
      () => loadSaveStorage(storage, electronStorage(storage, result)).saveRecord(minimalSaveRecord()),
      message
    )
  }
  const storage = makeMemoryStorage()
  const bridge = electronStorage(storage)
  bridge.setIndex = () => ({ error: 'index' })
  assert.throws(
    () => loadSaveStorage(storage, bridge).saveRecord(minimalSaveRecord()),
    /SAVE_INDEX_WRITE_FAILED: index/
  )
  for (const error of [null, new Error(''), new Error('STORAGE_FULL: disk'), new Error('quota')]) {
    const broken = makeMemoryStorage()
    broken.setItem = () => {
      throw error
    }
    assert.throws(() => loadSaveStorage(broken).saveRecord(minimalSaveRecord()), /STORAGE_FULL/)
  }
})

function mockReader(t, result, failure = false, missingTarget = false) {
  const original = global.FileReader
  global.FileReader = class {
    readAsText() {
      if (failure) this.onerror()
      else this.onload(missingTarget ? {} : { target: { result } })
    }
  }
  t.after(() => {
    if (original === undefined) delete global.FileReader
    else global.FileReader = original
  })
}

test('save imports reject unreadable, malformed and corrupt payloads', async t => {
  const storage = makeMemoryStorage()
  const api = loadSaveStorage(storage)
  for (const [result, message] of [
    [null, /INVALID_FORMAT/],
    ['{', /INVALID_FORMAT/],
    ['null', /INVALID_FORMAT/],
    ['{}', /INVALID_FORMAT/],
    [JSON.stringify({ format: 'save-v1', data: 1 }), /INVALID_FORMAT/],
    [JSON.stringify({ format: 'save-v1', data: '' }), /SAVE_CORRUPT/],
    [JSON.stringify({ format: 'save-v1', data: LZString.compressToBase64('{') }), /SAVE_CORRUPT/],
  ]) {
    mockReader(t, result)
    await assert.rejects(api.importSaveFile({}), message)
  }
  mockReader(t, '', true)
  await assert.rejects(api.importSaveFile({}), /READ_ERROR/)
  mockReader(t, '', false, true)
  await assert.rejects(api.importSaveFile({}), /INVALID_FORMAT/)
  assert.equal(storage.items.size, 0)
})

test('save imports retain metadata, provide defaults, and reject capacity and write failures', async t => {
  const storage = makeMemoryStorage()
  const api = loadSaveStorage(storage)
  mockReader(t, JSON.stringify({ format: 'save-v1', data: compressedSave(), name: 'Imported', date: 123 }))
  const saved = await api.importSaveFile({})
  assert.equal(saved.name, 'Imported')
  assert.deepEqual(api.listSaves(), [{ ...saved, date: 123 }])
  mockReader(t, JSON.stringify({ format: 'save-v1', data: compressedSave(), name: '', date: 'bad' }))
  assert.match((await api.importSaveFile({})).name, /^\d\d\/\d\d \d\d:\d\d$/)
  mockReader(t, JSON.stringify({ format: 'save-v1', data: compressedSave() }))
  assert.ok((await api.importSaveFile({})).name)
  t.mock.method(storage, 'setItem', () => {
    throw new Error('quota')
  })
  await assert.rejects(api.importSaveFile({}), /STORAGE_FULL/)
  t.mock.restoreAll()
  for (let i = 0; i < 7; i++) api.saveRecord(minimalSaveRecord())
  await assert.rejects(api.importSaveFile({}), /MAX_SAVES_REACHED/)
})

test('export saves downloads the compressed payload and releases its object URL', async t => {
  const storage = makeMemoryStorage()
  const api = loadSaveStorage(storage)
  assert.throws(() => api.exportSave('missing'), /SAVE_NOT_FOUND/)
  const saved = api.saveRecord(minimalSaveRecord(), { name: '08/09 10:15' })
  const original = global.document
  const anchor = { click: t.mock.fn() }
  global.document = {
    createElement: tag => {
      assert.equal(tag, 'a')
      return anchor
    },
  }
  t.after(() => {
    if (original === undefined) delete global.document
    else global.document = original
  })
  let blob
  t.mock.method(URL, 'createObjectURL', value => {
    blob = value
    return 'blob:test'
  })
  const revoke = t.mock.method(URL, 'revokeObjectURL', () => {})
  api.exportSave(saved.key)
  assert.equal(anchor.download, '08-09 10-15.save')
  assert.equal(anchor.href, 'blob:test')
  assert.equal(anchor.click.mock.callCount(), 1)
  assert.deepEqual(revoke.mock.calls[0].arguments, ['blob:test'])
  const payload = JSON.parse(await blob.text())
  assert.equal(payload.format, 'save-v1')
  assert.equal(payload.name, saved.name)
  assert.equal(payload.data, storage.getItem(saved.key))
  storage.removeItem(saved.key)
  assert.throws(() => api.exportSave(saved.key), /SAVE_NOT_FOUND/)
})
