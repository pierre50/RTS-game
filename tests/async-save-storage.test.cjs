const assert = require('node:assert/strict')
const test = require('node:test')
const path = require('node:path')
const { pathToFileURL } = require('node:url')
const babel = require('@babel/core')
const LZString = require('lz-string')
const { loadTsModule, requireFromTsFile } = require('./helpers/loadTsModule.cjs')

function fixture(failure) {
  const workers = [],
    events = [],
    parts = new Map(),
    roots = new Map()
  class CompressionWorker {
    constructor() {
      workers.push(this)
      this.scope = { postMessage: data => queueMicrotask(() => this.onmessage({ data })) }
      const previous = global.self
      global.self = this.scope
      try {
        loadTsModule('app/serialization/SaveCompressionWorker.ts')
      } finally {
        global.self = previous
      }
    }
    postMessage(data) {
      if (failure === 'worker') return queueMicrotask(() => this.onerror({ message: 'compression failed' }))
      if (failure === 'reported')
        return queueMicrotask(() => this.onmessage({ data: { type: 'error', message: 'invalid save' } }))
      if (failure === 'silent-worker') return queueMicrotask(() => this.onerror({}))
      if (failure === 'message') return queueMicrotask(() => this.onmessageerror())
      this.scope.onmessage({ data })
    }
    terminate() {
      this.terminated = true
    }
  }
  const filename = path.resolve(__dirname, '../app/serialization/AsyncSaveStorage.ts')
  // Preserve instrumentation of the original source; only adapt the worker URL to CommonJS.
  const { code } = babel.transformFileSync(filename)
  const module = { exports: {} }
  new Function(
    'module',
    'exports',
    'require',
    'Worker',
    code.replaceAll('import.meta.url', JSON.stringify(pathToFileURL(filename).href))
  )(module, module.exports, request => requireFromTsFile(request, filename), CompressionWorker)
  let serial = 0
  const keys = new Map()
  const bridge = {
    async begin(key) {
      events.push(['begin', key])
      if (failure === 'begin') throw new Error("No handler registered for 'saves:begin'")
      const token = `transaction-${++serial}`
      keys.set(token, key)
      return { token, oldRaw: roots.get(key) ?? null }
    },
    async batchNative(token, batch) {
      events.push(['batch', token])
      if (failure === 'batch') throw new Error('disk full')
      for (const [key, value] of batch) parts.set(key, value)
      return { written: batch.length, reused: 0 }
    },
    async commit(token, raw, index) {
      events.push(['commit', token, index])
      if (failure === 'commit') throw new Error('publish failed')
      roots.set(keys.get(token), raw)
    },
    async abort(token) {
      events.push(['abort', token])
    },
  }
  return { ...module.exports, bridge, workers, roots, parts, events }
}

test('queued saves publish complete recoverable state and reuse unchanged zones', async () => {
  const f = fixture()
  const record = { players: [], animals: [], resources: [{ label: 'tree', i: 2, j: 3, quantity: 9 }] }
  const progress = []
  await Promise.all([
    f.writeElectronSave(f.bridge, 'slot', record, 'first-index', value => progress.push(value.phase)),
    f.writeElectronSave(f.bridge, 'slot', record, 'second-index'),
  ])
  assert.deepEqual(
    f.events.filter(([kind]) => kind !== 'batch').map(([kind]) => kind),
    ['begin', 'commit', 'begin', 'commit']
  )
  assert.equal(f.events.filter(([kind]) => kind === 'batch').length, 1)
  assert.equal(f.events.at(-1)[2], 'second-index')
  assert.equal(progress[0], 'prepare')
  assert.deepEqual(progress.slice(-2), ['publish', 'complete'])
  assert.ok(progress.includes('write'))
  const manifest = JSON.parse(LZString.decompressFromBase64(f.roots.get('slot')))
  const { assembleSave } = loadTsModule('app/serialization/ZonedSaveFormat.ts')
  assert.deepEqual(
    assembleSave(
      manifest.metadata,
      manifest.collections,
      manifest.parts.map(([, key]) => JSON.parse(f.parts.get(key)).entries)
    ),
    record
  )
  assert.ok(f.workers.every(worker => worker.terminated))
})

for (const [failure, message] of [
  ['worker', 'compression failed'],
  ['reported', 'invalid save'],
  ['silent-worker', 'SAVE_WORKER_FAILED'],
  ['message', 'SAVE_WORKER_MESSAGE_FAILED'],
  ['batch', 'disk full'],
  ['commit', 'publish failed'],
]) {
  test(`${failure} failure aborts without publishing and releases the save queue`, async () => {
    const f = fixture(failure)
    const record = { players: [], animals: [], resources: [{ i: 1, j: 1 }] }
    await assert.rejects(f.writeElectronSave(f.bridge, 'slot', record, 'index'), new RegExp(message))
    assert.equal(f.roots.size, 0)
    assert.equal(f.events.at(-1)[0], 'abort')
    assert.ok(f.workers[0].terminated)
    await assert.rejects(f.writeElectronSave(f.bridge, 'slot', record, 'index'), new RegExp(message))
    assert.equal(f.events.filter(([kind]) => kind === 'begin').length, 2)
  })
}

test('an outdated Electron bridge requests restart before creating a worker', async () => {
  const f = fixture('begin')
  await assert.rejects(f.writeElectronSave(f.bridge, 'slot', {}, 'index'), /SAVE_RESTART_ELECTRON_REQUIRED/)
  assert.equal(f.workers.length, 0)
  assert.deepEqual(f.events, [['begin', 'slot']])
})
