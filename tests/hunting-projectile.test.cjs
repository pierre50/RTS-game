const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')

function loadTsModule(relativePath) {
  const filename = path.join(__dirname, '..', relativePath)
  const source = fs.readFileSync(filename, 'utf8')
  const { code } = babel.transformSync(source, {
    filename,
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }], '@babel/preset-typescript'],
  })

  const module = { exports: {} }
  new Function('module', 'exports', 'require', code)(module, module.exports, require)
  return module.exports
}

test('villager hunting uses the age-scaled arrow projectile family', () => {
  const { HUNTING_PROJECTILE } = loadTsModule('app/lib/hunting.ts')
  const { getEffectiveProjectileType } = loadTsModule('app/lib/projectiles.ts')

  assert.equal(HUNTING_PROJECTILE, 'Arrow')
  assert.equal(getEffectiveProjectileType(HUNTING_PROJECTILE, { age: 0 }), 'ArrowCeramic')
  assert.equal(getEffectiveProjectileType(HUNTING_PROJECTILE, { age: 2 }), 'ArrowBronze')
})
