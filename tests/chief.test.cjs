const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')

function loadChief() {
  const filename = path.join(__dirname, '../app/lib/chief.ts')
  const source = fs.readFileSync(filename, 'utf8')
  const { code } = babel.transformSync(source, {
    filename,
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }], '@babel/preset-typescript'],
  })
  const module = { exports: {} }
  const localRequire = request => {
    if (request === '../constants') {
      return {
        PLAYER_TYPES: { ai: 'AI' },
        UNIT_TYPES: { chief: 'Chief' },
      }
    }
    return require(request)
  }
  new Function('module', 'exports', 'require', code)(module, module.exports, localRequire)
  return module.exports
}

test('chief role can come from either unit type or isChief property', () => {
  const { hasLivingChief, isLivingChief } = loadChief()

  assert.equal(isLivingChief({ type: 'Chief', hitPoints: 1 }), true)
  assert.equal(isLivingChief({ type: 'Villager', isChief: true, hitPoints: 1 }), true)
  assert.equal(isLivingChief({ type: 'Chief', isDead: true, hitPoints: 1 }), false)
  assert.equal(hasLivingChief({ units: [{ type: 'Villager' }, { type: 'Villager', isChief: true }] }), true)
})

test('human and ai players need chief command gating', () => {
  const { playerNeedsChiefForCommand } = loadChief()

  assert.equal(playerNeedsChiefForCommand({ isPlayed: true, type: 'Human' }), true)
  assert.equal(playerNeedsChiefForCommand({ type: 'AI' }), true)
  assert.equal(playerNeedsChiefForCommand({ type: 'Gaia' }), false)
})
