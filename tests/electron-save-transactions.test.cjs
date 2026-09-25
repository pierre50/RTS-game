const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const { createSaveTransactions } = require('../electron/save-transactions.cjs')

test('async batches preserve the old root until publication and rollback on index failure', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'kaelor-save-test-'))
  try {
    const saves = createSaveTransactions(dir)
    await fs.writeFile(path.join(dir, 'save_0.save'), 'previous')
    const { token } = await saves.begin('save_0', 1)
    await assert.rejects(saves.begin('save_1', 1), /SAVE_BUSY/)
    await assert.rejects(saves.batch(token, 2, [['save_5', 'data']]), /INVALID_SAVE_TRANSACTION/)
    await saves.batch(token, 1, [['save_5', 'data']])
    assert.equal(await fs.readFile(path.join(dir, 'save_0.save'), 'utf8'), 'previous')
    await fs.mkdir(path.join(dir, 'index.json'))
    await assert.rejects(saves.commit(token, 1, 'new', '[]'))
    assert.equal(await fs.readFile(path.join(dir, 'save_0.save'), 'utf8'), 'previous')
    await assert.rejects(fs.stat(path.join(dir, 'save_5.save')), { code: 'ENOENT' })
    await fs.rmdir(path.join(dir, 'index.json'))
    const next = await saves.begin('save_0', 1)
    await saves.batch(next.token, 1, [['save_6', 'data']])
    await saves.commit(next.token, 1, 'new', '[]')
    assert.equal(await fs.readFile(path.join(dir, 'save_0.save'), 'utf8'), 'new')
    assert.equal(await fs.readFile(path.join(dir, 'index.json'), 'utf8'), '[]')
  } finally {
    await fs.rm(dir, { recursive: true, force: true })
  }
})

test('abort removes staged parts without touching existing saves or accepting path traversal', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'kaelor-save-test-'))
  try {
    const saves = createSaveTransactions(dir)
    await assert.rejects(saves.begin('../outside', 1), /INVALID_SAVE_KEY/)
    await fs.writeFile(path.join(dir, 'save_8.save'), 'keep')
    const { token } = await saves.begin('save_0', 1)
    await assert.rejects(saves.batch(token, 1, [['save_8', 'overwrite']]), { code: 'EEXIST' })
    await saves.batch(token, 1, [['save_9', 'staged']])
    await saves.abort(token, 1)
    assert.equal(await fs.readFile(path.join(dir, 'save_8.save'), 'utf8'), 'keep')
    await assert.rejects(fs.stat(path.join(dir, 'save_9.save')), { code: 'ENOENT' })
  } finally {
    await fs.rm(dir, { recursive: true, force: true })
  }
})

test('closing the renderer discards staged data and releases the save lock', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'save-owner-'))
  try {
    const store = createSaveTransactions(dir)
    const { token } = await store.begin('save_0', 1)
    await store.batch(token, 1, [['save_12345', 'staged']])
    await store.abortOwner(1)
    await assert.rejects(fs.readFile(path.join(dir, 'save_12345.save')), { code: 'ENOENT' })
    const retry = await store.begin('save_0', 2)
    await store.abort(retry.token, 2)
  } finally {
    await fs.rm(dir, { recursive: true, force: true })
  }
})
