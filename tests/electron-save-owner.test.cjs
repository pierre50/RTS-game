const test = require('node:test')
const assert = require('node:assert/strict')
const { EventEmitter } = require('node:events')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const { createSaveTransactions } = require('../electron/save-transactions.cjs')
const { bindSaveOwner } = require('../electron/save-owner.cjs')

function owner() {
  return Object.assign(new EventEmitter(), { id: 1, isDestroyed: () => false })
}

for (const event of ['reload', 'render-process-gone']) {
  test(`${event} releases abandoned transaction without changing published save`, async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'save-reload-'))
    try {
      const store = createSaveTransactions(directory)
      const sender = owner()
      const bound = bindSaveOwner(store, sender)
      await fs.writeFile(path.join(directory, 'save_0.save'), 'old')
      const first = await bound.begin('save_0')
      await store.batch(first.token, 1, [['save_123', 'staged']])
      // Subframe and same-document navigation must not cancel a live save.
      sender.emit('did-start-navigation', {}, 'url', false, false)
      sender.emit('did-start-navigation', {}, 'url#hash', true, true)
      await assert.rejects(bound.begin('save_1'), /SAVE_BUSY/)
      if (event === 'reload') sender.emit('did-start-navigation', {}, 'url', false, true)
      else sender.emit(event)
      const retry = await bound.begin('save_1')
      assert.equal(await fs.readFile(path.join(directory, 'save_0.save'), 'utf8'), 'old')
      await assert.rejects(fs.readFile(path.join(directory, 'save_123.save')), { code: 'ENOENT' })
      await assert.rejects(store.batch(first.token, 1, []), /INVALID_SAVE_TRANSACTION/)
      await store.abort(retry.token, 1)
    } finally {
      await fs.rm(directory, { recursive: true, force: true })
    }
  })
}

test('reload during begin cleans the late-created transaction before the next begin', async () => {
  const sender = owner()
  let release
  const aborted = []
  let begins = 0
  const bound = bindSaveOwner(
    {
      begin: async () => {
        begins++
        if (begins === 1)
          await new Promise(resolve => {
            release = resolve
          })
        return { token: String(begins) }
      },
      abort: async token => aborted.push(token),
      abortOwner: async () => {},
    },
    sender
  )
  const first = bound.begin('save_0')
  await Promise.resolve()
  sender.emit('did-start-navigation', {}, 'url', false, true)
  const retry = bound.begin('save_1')
  const rejected = assert.rejects(first, /SAVE_OWNER_CLOSED/)
  release()
  await rejected
  assert.equal((await retry).token, '2')
  assert.deepEqual(aborted, ['1'])
})
