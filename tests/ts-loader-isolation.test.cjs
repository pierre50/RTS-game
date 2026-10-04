const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

test('compiled modules keep independent mock scopes and runtime state across tests', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'kaelor-loader-'))
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }))
  const filename = path.join(directory, 'Counter.ts')
  fs.writeFileSync(
    filename,
    "import { initial } from './dependency'\nlet value: number = initial\nexport const next = () => ++value\n"
  )
  const first = loadTsModule(filename, { mocks: { './dependency': { initial: 10 } } })
  const second = loadTsModule(filename, { mocks: { './dependency': { initial: 100 } } })
  assert.equal(first.next(), 11)
  assert.equal(second.next(), 101)
  assert.equal(first.next(), 12)
  fs.writeFileSync(filename, 'export const next = () => 42\n')
  assert.equal(loadTsModule(filename).next(), 42)
  const moduleCache = new Map()
  const shared = loadTsModule(filename, { moduleCache })
  assert.equal(loadTsModule(filename, { moduleCache }), shared)
})
