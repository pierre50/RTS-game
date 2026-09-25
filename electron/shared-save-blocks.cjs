const fs = require('node:fs/promises')
const path = require('node:path')
const { createHash } = require('node:crypto')
const { gzip, gunzipSync } = require('node:zlib')
const { promisify } = require('node:util')
const LZString = require('lz-string')
const compress = promisify(gzip)
const isSharedKey = key => /^save_9\d{78}$/.test(key)
const blockKey = json =>
  `save_9${BigInt(`0x${createHash('sha256').update(json).digest('hex')}`)
    .toString()
    .padStart(78, '0')}`
function decodeBlock(key, buffer) {
  if (!isSharedKey(key)) return buffer.toString('utf8')
  const json = gunzipSync(buffer).toString('utf8')
  if (blockKey(json) !== key) throw new Error('SAVE_CORRUPT')
  return `json:${json}`
}
async function writeBlock(directory, key, json, created) {
  if (!isSharedKey(key) || blockKey(json) !== key) throw new Error('INVALID_SAVE_BLOCK')
  const filename = path.join(directory, `${key}.save`)
  try {
    await fs.access(filename)
    return false
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
  const compressed = await compress(Buffer.from(json), { level: 1 })
  const handle = await fs.open(filename, 'wx')
  created.add(key)
  try {
    await handle.writeFile(compressed)
  } finally {
    await handle.close()
  }
  return true
}
async function collectSharedBlocks(directory) {
  // Fail closed: a missing/corrupt indexed manifest prevents collection.
  const index = JSON.parse(await fs.readFile(path.join(directory, 'index.json'), 'utf8'))
  if (!Array.isArray(index)) throw new Error('INVALID_SAVE_INDEX')
  const live = new Set()
  for (const entry of index) {
    if (!/^save_(?:\d+|autosave)$/.test(entry.key)) throw new Error('INVALID_SAVE_KEY')
    const raw = await fs.readFile(path.join(directory, `${entry.key}.save`), 'utf8')
    const manifest = JSON.parse(LZString.decompressFromBase64(raw))
    if (manifest?.format === 'zoned-save-v1') {
      if (!Array.isArray(manifest.parts)) throw new Error('SAVE_CORRUPT')
      for (const [, key] of manifest.parts) live.add(key)
    }
  }
  for (const filename of await fs.readdir(directory)) {
    const key = filename.replace(/\.save$/, '')
    if (filename === `${key}.save` && isSharedKey(key) && !live.has(key))
      await fs.unlink(path.join(directory, filename))
  }
}
module.exports = { isSharedKey, blockKey, decodeBlock, writeBlock, collectSharedBlocks }
