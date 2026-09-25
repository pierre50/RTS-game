const test = require('node:test')
const assert = require('node:assert/strict')
const LZString = require('lz-string')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { partitionSave, assembleSave } = loadTsModule('app/serialization/ZonedSaveFormat.ts')

function prepare(input) {
  return new Promise((resolve, reject) => {
    const batches = []
    const scope = {
      postMessage(message) {
        if (message.type === 'error') reject(new Error(message.message))
        if (message.type === 'batch') {
          batches.push(message.parts)
          setImmediate(() => scope.onmessage({ data: { type: 'ack' } }))
        }
        if (message.type === 'ready') resolve({ ...message, batches })
      },
    }
    global.self = scope
    loadTsModule('app/serialization/SaveCompression.worker.ts')
    scope.onmessage({ data: input })
  })
}

test('worker batches compressed parts, round-trips state, reuses unchanged hashes and preserves changed state', async () => {
  const record = {
    resources: Array.from({ length: 70 }, (_, i) => ({ label: `tree${i}`, i: i * 64, j: 0, quantity: 10 })),
    players: [],
    animals: [],
  }
  const split = partitionSave(record)
  const input = {
    key: 'save_0',
    oldRaw: null,
    metadata: split.metadata,
    collections: split.collections,
    zones: [...split.zones],
    retained: [],
  }
  const first = await prepare(input)
  assert.equal(first.written, split.zones.size)
  assert.ok(first.batches.length > 1)
  assert.ok(first.batches.every(batch => batch.length <= 32))
  const data = new Map(first.batches.flat())
  const restore = raw => {
    const manifest = JSON.parse(LZString.decompressFromBase64(raw))
    return assembleSave(
      manifest.metadata,
      manifest.collections,
      manifest.parts.map(([, key]) => JSON.parse(data.get(key)).entries)
    )
  }
  assert.deepEqual(restore(first.raw), record)
  const second = await prepare({ ...input, oldRaw: first.raw })
  assert.equal(second.written, 0)
  assert.equal(second.reused, split.zones.size)
  record.resources[0].quantity = 3
  const changed = partitionSave(record)
  const third = await prepare({ ...input, oldRaw: second.raw, metadata: changed.metadata, zones: [...changed.zones] })
  assert.equal(third.written, 1)
  for (const pair of third.batches.flat()) data.set(...pair)
  assert.deepEqual(restore(third.raw), record)
  const retained = await prepare({ ...input, oldRaw: third.raw, zones: [], retained: [...changed.zones.keys()] })
  assert.equal(retained.written, 0)
  assert.deepEqual(restore(retained.raw), record)
  delete global.self
})
