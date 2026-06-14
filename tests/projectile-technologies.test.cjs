const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')

function loadProjectileHelpers() {
  const filename = path.join(__dirname, '../app/lib/projectiles.js')
  const source = fs.readFileSync(filename, 'utf8')
  const { code } = babel.transformSync(source, {
    filename,
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }]],
  })

  const module = { exports: {} }
  new Function('module', 'exports', 'require', code)(module, module.exports, require)
  return module.exports
}

const technologies = require('../public/assets/data/technologies/technologies.json')

test('Alchemy converts each military projectile family to its fiery variant', () => {
  const { getEffectiveProjectileType } = loadProjectileHelpers()
  const player = { technologies: ['Alchemy'] }

  assert.equal(getEffectiveProjectileType('Arrow', player), 'FireArrow')
  assert.equal(getEffectiveProjectileType('Bolt', player), 'FireBolt')
  assert.equal(getEffectiveProjectileType('Stone', player), 'FireStone')
  assert.equal(getEffectiveProjectileType('Spear', player), 'Spear')
  assert.equal(getEffectiveProjectileType('Arrow', { technologies: [] }), 'Arrow')
})

test('Ballistics tracks standard and fiery military projectiles', () => {
  const { projectileTracksTarget } = loadProjectileHelpers()
  const player = { technologies: ['Ballistics'] }

  for (const type of ['Arrow', 'FireArrow', 'Bolt', 'FireBolt', 'Stone', 'FireStone']) {
    assert.equal(projectileTracksTarget(type, player), true)
  }
  assert.equal(projectileTracksTarget('Spear', player), false)
  assert.equal(projectileTracksTarget('Arrow', { technologies: [] }), false)
})

test('Ballista Tower research requires Ballistics', () => {
  const conditions = technologies.ResearchBallistaTower.conditions

  assert.ok(
    conditions.some(
      condition => condition.key === 'technologies' && condition.op === 'includes' && condition.value === 'Ballistics'
    )
  )
})

test('Alchemy improves siege attack without retaining the old Ballistics fire-rate bonus', () => {
  const alchemyTypes = technologies.Alchemy.action.operations[0].type

  for (const type of ['StoneThrower', 'Catapult', 'Ballista']) {
    assert.ok(alchemyTypes.includes(type))
  }
  assert.equal(technologies.Ballistics.action, undefined)
})
