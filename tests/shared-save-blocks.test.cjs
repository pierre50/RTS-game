const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const path = require('node:path')
const os = require('node:os')
const LZString = require('lz-string')
const { createSaveTransactions } = require('../electron/save-transactions.cjs')
const { blockKey, decodeBlock, collectSharedBlocks } = require('../electron/shared-save-blocks.cjs')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { ZonedSaveStore } = loadTsModule('app/serialization/ZonedSaveStore.ts')
const { partitionSave } = loadTsModule('app/serialization/ZonedSaveFormat.ts')

test('native blocks are shared across slots, survive deletion of one root and preserve changed state', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'shared-saves-'))
  try {
    const transactions = createSaveTransactions(dir)
    const index = []
    const record = { resources: [{ label: 'tree', type: 'Tree', i: 1, j: 1, quantity: 10 }], players: [], animals: [] }
    async function save(key, data) {
      const split = partitionSave(data)
      const blocks = [...split.zones].map(([zone, entries]) => {
        const json = JSON.stringify({ format: 'zone-part-v2', zone, entries })
        return [blockKey(json), json]
      })
      const { token } = await transactions.begin(key, 1)
      const stats = await transactions.batch(token, 1, blocks, true)
      const raw = LZString.compressToBase64(
        JSON.stringify({
          format: 'zoned-save-v1',
          version: 1,
          zoneSize: 64,
          metadata: split.metadata,
          collections: split.collections,
          parts: [...split.zones.keys()].map((zone, i) => [zone, blocks[i][0]]),
        })
      )
      const next = [...index.filter(entry => entry.key !== key), { key }]
      await transactions.commit(token, 1, raw, JSON.stringify(next))
      index.splice(0, index.length, ...next)
      return { stats, blocks }
    }
    const first = await save('save_0', record)
    const second = await save('save_1', record)
    assert.equal(second.stats.written, 0)
    assert.equal(second.stats.reused, first.blocks.length)
    const changed = structuredClone(record)
    changed.resources[0].quantity = 3
    const third = await save('save_0', changed)
    assert.equal(third.stats.written, 1)
    const load = async key => {
      const files = new Map()
      for (const name of await fs.readdir(dir))
        if (name.endsWith('.save')) {
          const id = name.slice(0, -5)
          files.set(id, decodeBlock(id, await fs.readFile(path.join(dir, name))))
        }
      return new ZonedSaveStore({ getItem: key => files.get(key), setItem() {}, removeItem() {} }).load(key)
    }
    assert.deepEqual(await load('save_1'), record)
    assert.deepEqual(await load('save_0'), changed)
    await fs.unlink(path.join(dir, 'save_1.save'))
    await fs.writeFile(path.join(dir, 'index.json'), JSON.stringify([{ key: 'save_0' }]))
    await collectSharedBlocks(dir)
    assert.deepEqual(await load('save_0'), changed)
    await assert.rejects(fs.readFile(path.join(dir, `${first.blocks[0][0]}.save`)), { code: 'ENOENT' })
    // Failed transactions may remove only their own newly created blocks.
    const { token } = await transactions.begin('save_2', 1)
    await transactions.batch(token, 1, third.blocks, true)
    await transactions.abort(token, 1)
    assert.deepEqual(await load('save_0'), changed)
  } finally {
    await fs.rm(dir, { recursive: true, force: true })
  }
})
