const assert = require('node:assert/strict')
const test = require('node:test')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const vm = require('node:vm')

function setup(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rts-save-'))
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }))
  const handlers = new Map()
  const fileSystem = { ...fs }
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../main.js'), 'utf8'), {
    __dirname: path.join(__dirname, '..'),
    process: { env: {}, platform: 'darwin' },
    require: id =>
      id === 'electron'
        ? {
            app: { getPath: () => directory, whenReady: () => ({ then() {} }), on() {} },
            ipcMain: { on: (name, callback) => handlers.set(name, callback) },
            BrowserWindow: {},
          }
        : id === 'fs'
          ? fileSystem
          : require(id),
  })
  return {
    fileSystem,
    directory,
    call(name, ...args) {
      const event = {}
      handlers.get(name)(event, ...args)
      return event.returnValue
    },
  }
}

test('Electron manifest and index writes preserve the previous file after partial write or rename failure', t => {
  for (const channel of ['saves:setItem', 'saves:setIndex']) {
    const h = setup(t)
    const args = channel === 'saves:setItem' ? ['save_0'] : []
    const get = () => h.call(channel === 'saves:setItem' ? 'saves:getItem' : 'saves:getIndex', ...args)
    assert.equal(h.call(channel, ...args, 'old').ok, true)
    h.fileSystem.writeFileSync = (file, value, encoding) => {
      fs.writeFileSync(file, value.slice(0, 2), encoding)
      throw new Error('disk full')
    }
    assert.equal(h.call(channel, ...args, 'new-data').ok, false)
    assert.equal(get(), 'old')
    h.fileSystem.writeFileSync = fs.writeFileSync
    h.fileSystem.renameSync = () => {
      throw new Error('rename failed')
    }
    assert.equal(h.call(channel, ...args, 'new-data').ok, false)
    assert.equal(get(), 'old')
    assert.ok(fs.readdirSync(path.join(h.directory, 'saves')).every(name => !name.endsWith('.tmp')))
  }
})
