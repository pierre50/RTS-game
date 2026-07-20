const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')

function loadPlayerState() {
  const filename = path.join(__dirname, '../app/lib/playerState.ts')
  const source = fs.readFileSync(filename, 'utf8')
  const { code } = babel.transformSync(source, {
    filename,
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }], '@babel/preset-typescript'],
  })
  const module = { exports: {} }
  new Function('module', 'exports', 'require', code)(module, module.exports, require)
  return module.exports
}

const { isPlayedHeroDefeated } = loadPlayerState()

test('played player is not defeated while the hero is alive even without other units', () => {
  const hero = { hitPoints: 10, isDead: false }
  const player = { units: [hero], buildings: [] }

  assert.equal(isPlayedHeroDefeated(player), false)
})

test('played player is defeated when the active hero dies', () => {
  const hero = { hitPoints: 10, isDead: false }
  const activeHero = { hitPoints: 0, isDead: true }
  const player = { units: [hero], buildings: [{ hitPoints: 500, isBuilt: true, units: ['Villager'] }] }

  assert.equal(isPlayedHeroDefeated(player, activeHero), true)
})
