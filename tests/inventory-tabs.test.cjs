const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')

test('inventory exposes local map and construction tabs without Worlds', t => {
  const previous = global.document
  t.after(() => {
    global.document = previous
  })
  global.document = { createElement: () => ({ appendChild() {}, append() {} }) }
  const filename = path.join(__dirname, '../app/ui/InventoryManager.ts')
  const { code } = babel.transformSync(fs.readFileSync(filename, 'utf8'), {
    filename,
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }], '@babel/preset-typescript'],
  })
  const loaded = { exports: {} }
  let tabs
  new Function('module', 'exports', 'require', code)(loaded, loaded.exports, request => {
    if (request === '../lib/lang') return { t: key => key }
    if (request === './Tabs')
      return {
        ModalTabs: class {
          constructor(entries) {
            tabs = entries
          }
        },
      }
    return {}
  })
  new loaded.exports.InventoryManager({ minimapWrap: {} })
  assert.deepEqual(
    tabs.map(tab => tab.id),
    ['info', 'tools', 'minimap', 'construction']
  )
})

test('closing and reopening inventory remembers every tab and releases the minimap', t => {
  const previous = global.document
  t.after(() => {
    global.document = previous
  })
  global.document = { getElementById: () => null }
  const filename = path.join(__dirname, '../app/ui/InventoryManager.ts')
  const { code } = babel.transformSync(fs.readFileSync(filename, 'utf8'), {
    filename,
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }], '@babel/preset-typescript'],
  })
  const loaded = { exports: {} }
  new Function('module', 'exports', 'require', code)(loaded, loaded.exports, request => {
    if (request === '../lib')
      return {
        Modal: class {
          constructor() {
            this._panel = { classList: { add() {} } }
          }
          close() {}
        },
      }
    return {}
  })
  const { InventoryManager } = loaded.exports
  for (const tab of ['info', 'tools', 'minimap', 'construction']) {
    const calls = []
    const manager = Object.create(InventoryManager.prototype)
    Object.assign(manager, {
      activeTab: tab,
      opened: true,
      pausedByMenu: false,
      modal: { close() {} },
      menu: {
        context: { paused: true, controls: {} },
        deactivateMiniMap: () => calls.push('detach'),
        clearActionHotkeys() {},
        updateActionTarget() {},
      },
      mountTabs() {},
      showTab: selected => calls.push(selected),
    })
    manager.close()
    assert.equal(manager.activeTab, tab)
    manager.open()
    assert.deepEqual(calls, ['detach', tab])
  }
})
