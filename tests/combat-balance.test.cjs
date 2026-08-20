const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')

const equipment = require('../public/assets/data/gameplay/equipment.json')
const technologies = require('../public/assets/data/technologies/technologies.json')
const units = require('../public/assets/data/gameplay/units.json')
const animals = require('../public/assets/data/gameplay/animals.json')

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
  return module.exports
}

function getEquipmentStats(keys = []) {
  return keys.reduce(
    (stats, key) => {
      const item = equipment[key] ?? {}
      stats.weaponPower += item.weapon?.power ?? 0
      stats.meleeArmor += item.armor?.melee ?? item.meleeArmor ?? 0
      stats.pierceArmor += item.armor?.pierce ?? item.pierceArmor ?? 0
      return stats
    },
    { weaponPower: 0, meleeArmor: 0, pierceArmor: 0 }
  )
}

function damagePerHit(attacker, target, type = 'melee') {
  const armor = type === 'pierce' ? (target.pierceArmor ?? 0) : (target.meleeArmor ?? 0)
  return Math.max(1, attacker.weaponPower - armor)
}

function hitsToKill(attacker, target, type = 'melee') {
  return Math.ceil(target.totalHitPoints / damagePerHit(attacker, target, type))
}

function createCombatConfig() {
  return loadPlayerConfig().createPlayerData(
    {
      buildings: {},
      equipment,
      projectiles: {},
      units,
    },
    technologies,
    'Greek'
  ).config
}

test('bandit combat pacing stays in ARPG hit-count ranges', () => {
  const config = createCombatConfig()
  const heroSword = getEquipmentStats(['sword_ceramic'])
  const heroBow = getEquipmentStats(['bow'])
  const banditChief = config.units.BanditChief
  const banditSword = config.units.BanditSword
  const banditArcher = config.units.BanditArcher

  assert.equal(hitsToKill(heroSword, banditArcher), 3)
  assert.equal(hitsToKill(heroSword, banditSword), 4)
  assert.equal(hitsToKill(heroSword, banditChief), 8)
  assert.equal(hitsToKill(heroBow, banditArcher, 'pierce'), 4)
  assert.equal(hitsToKill(heroBow, banditSword, 'pierce'), 4)
  assert.equal(hitsToKill(heroBow, banditChief, 'pierce'), 9)
})

test('trainable non-siege units use ARPG health pacing against starting hero weapons', () => {
  const heroSword = getEquipmentStats(['sword_ceramic'])
  const heroBow = getEquipmentStats(['bow'])

  assert.equal(hitsToKill(heroSword, units.Villager), 3)
  assert.equal(hitsToKill(heroSword, units.Priest), 3)
  assert.equal(hitsToKill(heroSword, units.Bowman), 4)
  assert.equal(hitsToKill(heroSword, units.Fantassin), 4)
  assert.equal(hitsToKill(heroSword, units.Chief), 6)
  assert.equal(hitsToKill(heroBow, units.Bowman, 'pierce'), 4)
  assert.equal(hitsToKill(heroBow, units.Fantassin, 'pierce'), 5)
  assert.equal(hitsToKill(heroBow, units.Chief, 'pierce'), 8)
  assert.equal(units.Hero.totalHitPoints, 45)
})

test('animals stay quick to resolve with starting hero weapons', () => {
  const heroSword = getEquipmentStats(['sword_ceramic'])
  const heroBow = getEquipmentStats(['bow'])

  assert.equal(hitsToKill(heroSword, animals.Wolf), 4)
  assert.equal(hitsToKill(heroSword, animals.Boar), 4)
  assert.equal(hitsToKill(heroBow, animals.Wolf, 'pierce'), 4)
  assert.equal(hitsToKill(heroBow, animals.Boar, 'pierce'), 5)
  assert.equal(hitsToKill(heroSword, animals.Deer), 3)
  assert.equal(hitsToKill(heroSword, animals.Hare), 1)
  assert.equal(hitsToKill(heroSword, animals.BlackGrouse), 1)
  assert.equal(hitsToKill(heroSword, animals.Fox), 2)
  assert.equal(hitsToKill(heroSword, animals.Horse), 4)
})

test('starting bandits remain dangerous without deleting the hero instantly', () => {
  const config = createCombatConfig()
  const hero = config.units.Hero
  const banditChief = { ...config.units.BanditChief, ...getEquipmentStats(config.units.BanditChief.equipment) }
  const banditSword = { ...config.units.BanditSword, ...getEquipmentStats(config.units.BanditSword.equipment) }
  const banditArcher = { ...config.units.BanditArcher, ...getEquipmentStats(config.units.BanditArcher.equipment) }

  assert.equal(hitsToKill(banditChief, hero), 9)
  assert.equal(hitsToKill(banditSword, hero), 8)
  assert.equal(hitsToKill(banditArcher, hero, 'pierce'), 12)
})

test('melee weapon technologies improve swords and axes across all ages', () => {
  const expectedTypes = [
    'axe_ceramic',
    'axe_copper',
    'axe_bronze',
    'axe_iron',
    'sword_ceramic',
    'sword_copper',
    'sword_bronze',
    'sword_iron',
  ]

  for (const techName of ['Toolworking', 'Metalworking', 'Metallurgy']) {
    const weaponOperation = technologies[techName].action.operations.find(operation => operation.key === 'weapon.power')
    assert.ok(weaponOperation, `${techName} should improve weapon.power`)
    for (const type of expectedTypes) {
      assert.ok(weaponOperation.type.includes(type), `${techName} should improve ${type}`)
    }
  }
})
