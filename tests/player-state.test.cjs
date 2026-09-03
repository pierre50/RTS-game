const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')
const { requireFromTsFile } = require('./helpers/loadTsModule.cjs')

function loadPlayerState() {
  const filename = path.join(__dirname, '../app/lib/playerState.ts')
  const source = fs.readFileSync(filename, 'utf8')
  const { code } = babel.transformSync(source, {
    filename,
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }], '@babel/preset-typescript'],
  })
  const module = { exports: {} }
  const localRequire = request => requireFromTsFile(request, filename)
  new Function('module', 'exports', 'require', code)(module, module.exports, localRequire)
  return module.exports
}

const { isPlayerEliminated, isPlayedHeroDefeated } = loadPlayerState()

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

test('ai player is eliminated when only operational buildings remain', () => {
  const player = {
    type: 'AI',
    units: [{ hitPoints: 0, isDead: true }],
    buildings: [{ hitPoints: 500, isBuilt: true, units: ['Villager'] }],
  }

  assert.equal(isPlayerEliminated(player), true)
})

test('ai player is eliminated when all living units are fleeing', () => {
  const player = {
    type: 'AI',
    units: [{ hitPoints: 12, combatMode: 'flee' }],
    buildings: [{ hitPoints: 500, isBuilt: true, units: ['Villager'] }],
  }

  assert.equal(isPlayerEliminated(player), true)
})

test('ai player is not eliminated while at least one living unit is holding ground', () => {
  const player = {
    type: 'AI',
    units: [
      { hitPoints: 12, combatMode: 'flee' },
      { hitPoints: 20, action: 'attack' },
    ],
    buildings: [{ hitPoints: 500, isBuilt: true, units: ['Villager'] }],
  }

  assert.equal(isPlayerEliminated(player), false)
})
