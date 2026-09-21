const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')

// Isolate the inventory presentation from rendering, audio and the game world.
const filename = path.join(__dirname, '../app/ui/InventoryManager.ts')
const { code } = babel.transformSync(fs.readFileSync(filename, 'utf8'), {
  filename,
  presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }], '@babel/preset-typescript'],
})
const loaded = { exports: {} }
new Function('module', 'exports', 'require', code)(loaded, loaded.exports, request =>
  request === '../lib/hero/heroTools'
    ? { getEquippedItemWeapon: (_tool, _age, hero) => hero.inventory.activeWeapons.ranged }
    : {}
)

test('inventory shows an equipped bow without arrows and keeps it visible after ammunition runs out', () => {
  const hero = { inventory: { activeWeapons: { ranged: 'bow' }, equipped: {} } }
  const manager = Object.create(loaded.exports.InventoryManager.prototype)
  manager.menu = { context: { controls: { heroUnit: hero }, player: { age: 0 } } }
  assert.equal(manager.getActiveWeaponEquipment('bow'), 'bow')
  hero.inventory.equipped.arrow = 'arrow_wood'
  assert.equal(manager.getActiveWeaponEquipment('bow'), 'bow')
  delete hero.inventory.equipped.arrow
  assert.equal(manager.getActiveWeaponEquipment('bow'), 'bow')
  delete hero.inventory.activeWeapons.ranged
  assert.equal(manager.getActiveWeaponEquipment('bow'), undefined)
})
