const fs = require('node:fs/promises')
const path = require('node:path')
const LZString = require('lz-string')
const { randomUUID } = require('node:crypto')
const { isSharedKey, writeBlock, collectSharedBlocks } = require('./shared-save-blocks.cjs')
const validKey = key => typeof key === 'string' && /^save_\d+$/.test(key)

function createSaveTransactions(directory) {
  const transactions = new Map()
  let busy = false
  const file = key => path.join(directory, `${key}.save`)
  const read = async filename => {
    try {
      return await fs.readFile(filename, 'utf8')
    } catch (error) {
      if (error.code === 'ENOENT') return null
      throw error
    }
  }
  const atomic = async (filename, value) => {
    const temporary = `${filename}.${randomUUID()}.tmp`
    try {
      await fs.writeFile(temporary, value, 'utf8')
      await fs.rename(temporary, filename)
    } finally {
      await fs.unlink(temporary).catch(() => {})
    }
  }
  const remove = key => fs.unlink(file(key)).catch(() => {})
  return {
    async begin(key, owner) {
      if (!validKey(key)) throw new Error('INVALID_SAVE_KEY')
      if (busy) throw new Error('SAVE_BUSY')
      busy = true
      try {
        await fs.mkdir(directory, { recursive: true })
        const token = randomUUID()
        const oldRaw = await read(file(key))
        transactions.set(token, { key, owner, oldRaw, created: new Set() })
        return { token, oldRaw }
      } catch (error) {
        busy = false
        throw error
      }
    },
    async batch(token, owner, parts, native = false) {
      const tx = transactions.get(token)
      if (!tx || tx.owner !== owner || tx.aborting) throw new Error('INVALID_SAVE_TRANSACTION')
      if (!Array.isArray(parts) || parts.length > 32) throw new Error('INVALID_SAVE_BATCH')
      if (tx.pending || tx.publishing) throw new Error('SAVE_BUSY')
      let written = 0
      tx.pending = (async () => {
        for (const [key, value] of parts) {
          if (!validKey(key) || key === tx.key || typeof value !== 'string') throw new Error('INVALID_SAVE_PART')
          if (native) {
            if (await writeBlock(directory, key, value, tx.created)) written++
            continue
          }
          // Exclusive creation: staged data must never overwrite an existing save.
          const handle = await fs.open(file(key), 'wx')
          tx.created.add(key)
          try {
            await handle.writeFile(value, 'utf8')
          } finally {
            await handle.close()
          }
        }
      })()
      try {
        await tx.pending
        return { written, reused: native ? parts.length - written : 0 }
      } finally {
        tx.pending = null
      }
    },
    async commit(token, owner, raw, index) {
      const tx = transactions.get(token)
      if (!tx || tx.owner !== owner || tx.aborting || typeof raw !== 'string' || typeof index !== 'string')
        throw new Error('INVALID_SAVE_TRANSACTION')
      if (tx.pending || tx.publishing) throw new Error('SAVE_BUSY')
      tx.publishing = true
      try {
        await atomic(file(tx.key), raw)
        await atomic(path.join(directory, 'index.json'), index)
      } catch (error) {
        // Keep staged files if rollback fails: either manifest must remain readable.
        try {
          if (tx.oldRaw === null)
            await fs.unlink(file(tx.key)).catch(e => {
              if (e.code !== 'ENOENT') throw e
            })
          else await atomic(file(tx.key), tx.oldRaw)
          for (const key of tx.created) await remove(key)
        } finally {
          transactions.delete(token)
          busy = false
        }
        throw error
      }
      // Publication succeeded. Only remove files named by the old manifest and
      // absent from the new one; never trust arbitrary deletion paths from the renderer.
      try {
        const old = tx.oldRaw && JSON.parse(LZString.decompressFromBase64(tx.oldRaw))
        const current = JSON.parse(LZString.decompressFromBase64(raw))
        if (old?.format === 'zoned-save-v1' && current?.format === 'zoned-save-v1') {
          const live = new Set(current.parts.map(part => part[1]))
          for (const [, key] of old.parts)
            if (validKey(key) && !isSharedKey(key) && key !== tx.key && !live.has(key)) await remove(key)
        }
      } catch {
        /* Obsolete parts can be recovered later; the committed save remains valid. */
      }
      await collectSharedBlocks(directory).catch(error =>
        console.warn('[save] Shared block cleanup deferred:', error.message)
      )
      transactions.delete(token)
      busy = false
    },
    async abortOwner(owner) {
      for (const [token, tx] of transactions) if (tx.owner === owner) await this.abort(token, owner)
    },
    async abort(token, owner) {
      const tx = transactions.get(token)
      if (!tx || tx.owner !== owner || tx.publishing) return
      if (!tx.aborting)
        tx.aborting = (async () => {
          await tx.pending?.catch(() => {})
          for (const key of tx.created) await remove(key)
          transactions.delete(token)
          busy = false
        })()
      await tx.aborting
    },
  }
}
module.exports = { createSaveTransactions }
