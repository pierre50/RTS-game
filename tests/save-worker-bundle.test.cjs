const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const path = require('node:path')
const os = require('node:os')
const vm = require('node:vm')
const { webcrypto } = require('node:crypto')
const webpack = require('webpack')
const LZString = require('lz-string')

test('compiled compression worker starts and saves without window or document', { timeout: 30000 }, async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'save-worker-bundle-'))
  const compiler = webpack({
    mode: 'development',
    target: 'webworker',
    entry: path.resolve('app/serialization/SaveCompression.worker.ts'),
    output: { path: directory, filename: 'worker.js', publicPath: '' },
    devtool: false,
    resolve: { extensions: ['.ts', '.js'] },
    module: { rules: [{ test: /\.ts$/, exclude: /node_modules/, use: 'babel-loader' }] },
  })
  try {
    const stats = await new Promise((resolve, reject) =>
      compiler.run((error, stats) => (error ? reject(error) : resolve(stats)))
    )
    assert.equal(stats.hasErrors(), false, stats.toString({ all: false, errors: true }))
    const modules = stats
      .toJson({ all: false, modules: true })
      .modules.map(module => module.name ?? '')
      .join('\n')
    assert.doesNotMatch(modules, /CompactResourceSet|constants\/core|ZonedSaveFormat/)
    const code = await fs.readFile(path.join(directory, 'worker.js'), 'utf8')
    const parts = []
    let scope
    const ready = new Promise((resolve, reject) => {
      scope = {
        postMessage(message) {
          if (message.type === 'error') reject(new Error(message.message))
          if (message.type === 'ready') resolve(message)
          if (message.type === 'batch') {
            parts.push(...message.parts)
            queueMicrotask(() => scope.onmessage({ data: { type: 'ack' } }))
          }
        },
      }
    })
    vm.runInNewContext(code, { self: scope, crypto: webcrypto, TextEncoder, console }, { timeout: 5000 })
    assert.equal(typeof scope.onmessage, 'function')
    scope.onmessage({
      data: {
        key: 'save_0',
        oldRaw: null,
        metadata: {},
        collections: [],
        retained: [],
        zones: [['zone', [{ collection: 'resources', id: 'tree', value: { quantity: 7 } }]]],
      },
    })
    const result = await ready
    assert.equal(result.written, 1)
    assert.equal(parts[0][0], require('../electron/shared-save-blocks.cjs').blockKey(parts[0][1]))
    const saved = JSON.parse(parts[0][1])
    assert.equal(saved.entries[0].value.quantity, 7)
    assert.equal(JSON.parse(LZString.decompressFromBase64(result.raw)).zoneSize, 64)
  } finally {
    await new Promise(resolve => compiler.close(resolve))
    await fs.rm(directory, { recursive: true, force: true })
  }
})
