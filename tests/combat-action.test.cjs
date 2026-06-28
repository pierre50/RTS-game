const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')

function loadModule(relativePath, mocks) {
  const filename = path.join(__dirname, '..', relativePath)
  const source = fs.readFileSync(filename, 'utf8')
  const { code } = babel.transformSync(source, {
    filename,
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }]],
  })
  const module = { exports: {} }
  const localRequire = request => {
    if (Object.hasOwn(mocks, request)) return mocks[request]
    return require(request)
  }
  new Function('module', 'exports', 'require', code)(module, module.exports, localRequire)
  return module.exports
}

const constants = {
  BUILDING_TYPES: {},
  FAMILY_TYPES: {
    animal: 'animal',
    building: 'building',
    unit: 'unit',
  },
  RESOURCE_TYPES: {},
  UNIT_TYPES: {
    villager: 'Villager',
  },
}

const owner = {
  isEnemy: targetOwner => targetOwner?.label === 'enemy',
}
const target = {
  family: constants.FAMILY_TYPES.unit,
  hitPoints: 20,
  isDead: false,
  owner: { label: 'enemy' },
}

test('units with no attack stats cannot attack enemies', () => {
  const { getActionCondition } = loadModule('app/lib/combat.js', {
    '../constants': constants,
  })

  const fishingBoat = {
    hitPoints: 45,
    isDead: false,
    owner,
    type: 'FishingBoat',
  }

  assert.equal(getActionCondition(fishingBoat, target, 'attack'), false)
})

test('units with attack stats can attack enemies', () => {
  const { getActionCondition } = loadModule('app/lib/combat.js', {
    '../constants': constants,
  })

  const scoutShip = {
    hitPoints: 120,
    isDead: false,
    owner,
    pierceAttack: 5,
    type: 'ScoutShip',
  }

  assert.equal(getActionCondition(scoutShip, target, 'attack'), true)
})
