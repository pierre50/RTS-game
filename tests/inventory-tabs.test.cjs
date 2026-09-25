const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')

test('inventory exposes local map and construction tabs without Worlds', t => {
  const previous = global.document
  t.after(() => { global.document = previous })
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
    if (request === './Tabs') return { ModalTabs: class { constructor(entries) { tabs = entries } } }
    return {}
  })
  new loaded.exports.InventoryManager({ minimapWrap: {} })
  assert.deepEqual(tabs.map(tab => tab.id), ['info', 'tools', 'minimap', 'construction'])
})
