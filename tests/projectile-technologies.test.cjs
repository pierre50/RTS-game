const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')

function loadProjectileHelpers() {
  const filename = path.join(__dirname, '../app/lib/projectiles.ts')
  const source = fs.readFileSync(filename, 'utf8')
  const { code } = babel.transformSync(source, {
    filename,
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }], '@babel/preset-typescript'],
  })

  const module = { exports: {} }
  new Function('module', 'exports', 'require', code)(module, module.exports, require)
  return module.exports
}

test('arrow family depends only on age, ignoring legacy bonuses', () => {
  const { getEffectiveProjectileType } = loadProjectileHelpers()
  const player = { technologies: ['Alchemy'] }

  assert.equal(getEffectiveProjectileType('Arrow', player), 'ArrowCeramic')
  assert.equal(getEffectiveProjectileType('ArrowCopper', player), 'ArrowCopper')
  assert.equal(getEffectiveProjectileType('Arrow', { age: 1, technologies: ['Alchemy'] }), 'ArrowBronze')
  assert.equal(getEffectiveProjectileType('Arrow', { age: 2, technologies: ['Alchemy'] }), 'ArrowIron')
  assert.equal(getEffectiveProjectileType('Arrow', { age: 0, technologies: [] }), 'ArrowCeramic')
})
