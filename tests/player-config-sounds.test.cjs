const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')

function loadPlayerConfig() {
  const filename = path.join(__dirname, '../app/config/playerConfig.ts')
  const source = fs.readFileSync(filename, 'utf8')
  const { code } = babel.transformSync(source, {
    filename,
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }], '@babel/preset-typescript'],
  })
  const module = { exports: {} }
  const unitTypes = {
    banditArcher: 'BanditArcher',
    banditChief: 'BanditChief',
    banditSword: 'BanditSword',
  }
  const soundCues = {
    projectile: { arrowLaunch: ['archer-attack', 'archer-attack-2'] },
    unit: { swordAttack: ['sword-attack', 'sword-attack-2'] },
  }
  const mocks = {
    './civilizations': { getCivilizationDefinition: () => ({ disabledUnits: [], disabledTechnologies: [] }) },
    '../constants': { UNIT_TYPES: unitTypes },
    '../constants/sounds': { SOUND_CUES: soundCues },
    '../lib/equipmentStats': { applyEquipmentStatsToUnitConfig: () => {} },
  }
  const localRequire = request => (Object.hasOwn(mocks, request) ? mocks[request] : require(request))
  new Function('module', 'exports', 'require', code)(module, module.exports, localRequire)
  return { ...module.exports, soundCues }
}

test('BanditSword uses the sword attack sound cues for melee impacts', () => {
  const { createPlayerData, soundCues } = loadPlayerConfig()
  const { config } = createPlayerData(
    {
      buildings: {},
      projectiles: {},
      units: {},
    },
    {},
    'Greek'
  )

  assert.deepEqual(config.units.BanditSword.sounds.hit, soundCues.unit.swordAttack)
})

test('LPC arrows spawn lower when fired toward the left', () => {
  const { createPlayerData } = loadPlayerConfig()
  const { config } = createPlayerData(
    {
      buildings: {},
      projectiles: {},
      units: {},
    },
    {},
    'Greek'
  )

  assert.deepEqual(config.projectiles.Arrow.directionalSpawnOffsets.west, { x: -10, y: 8 })
  assert.deepEqual(config.projectiles.ArrowCeramic.directionalSpawnOffsets.west, { x: -10, y: 8 })
})
