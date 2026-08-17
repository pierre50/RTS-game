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

const technologies = require('../public/assets/data/technologies/technologies.json')

test('Alchemy keeps arrow family by age while still using stone enhancements', () => {
  const { getEffectiveProjectileType } = loadProjectileHelpers()
  const player = { technologies: ['Alchemy'] }

  assert.equal(getEffectiveProjectileType('Arrow', player), 'ArrowCeramic')
  assert.equal(getEffectiveProjectileType('ArrowCopper', player), 'ArrowCopper')
  assert.equal(getEffectiveProjectileType('Stone', player), 'FireStone')
  assert.equal(getEffectiveProjectileType('Arrow', { age: 1, technologies: ['Alchemy'] }), 'ArrowCopper')
  assert.equal(getEffectiveProjectileType('Arrow', { age: 2, technologies: ['Alchemy'] }), 'ArrowBronze')
  assert.equal(getEffectiveProjectileType('Arrow', { age: 3, technologies: ['Alchemy'] }), 'ArrowIron')
  assert.equal(getEffectiveProjectileType('Arrow', { age: 0, technologies: [] }), 'ArrowCeramic')
})

test('Ballistics tracks standard military projectiles', () => {
  const { projectileTracksTarget } = loadProjectileHelpers()
  const player = { technologies: ['Ballistics'] }

  for (const type of ['Arrow', 'ArrowCeramic', 'ArrowCopper', 'ArrowBronze', 'ArrowIron', 'Stone', 'FireStone']) {
    assert.equal(projectileTracksTarget(type, player), true)
  }
  assert.equal(projectileTracksTarget('Arrow', { technologies: [] }), false)
})

test('Alchemy improves siege attack without retaining the old Ballistics fire-rate bonus', () => {
  const alchemyTypes = technologies.Alchemy.action.operations[0].type

  for (const type of ['stone_thrower_stone', 'catapult_stone', 'ballista_bolt']) {
    assert.ok(alchemyTypes.includes(type))
  }
  assert.equal(technologies.Ballistics.action, undefined)
})
