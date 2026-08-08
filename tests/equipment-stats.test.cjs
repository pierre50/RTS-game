const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')

const constants = {
  FAMILY_TYPES: {
    animal: 'animal',
    building: 'building',
    unit: 'unit',
  },
  UNIT_TYPES: {
    villager: 'Villager',
    axeman: 'Axeman',
    broadSwordsman: 'BroadSwordsman',
  },
  WORK_TYPES: {
    attacker: 'attacker',
  },
}

function loadModule(relativePath, mocks) {
  const filename = path.join(__dirname, '..', relativePath)
  const source = fs.readFileSync(filename, 'utf8')
  const { code } = babel.transformSync(source, {
    filename,
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }], '@babel/preset-typescript'],
  })
  const module = { exports: {} }
  const localRequire = request => {
    if (Object.hasOwn(mocks, request)) return mocks[request]
    return require(request)
  }
  new Function('module', 'exports', 'require', code)(module, module.exports, localRequire)
  return module.exports
}

function loadEquipmentStats({ unitEquipment = {}, workEquipment = {} } = {}) {
  return loadModule('app/lib/equipmentStats.ts', {
    'pixi.js': { Assets: { cache: { get: () => undefined } } },
    '../constants': constants,
    './lpc/equipment': {
      dynamicEquipmentForUnit: unitType => [...(unitEquipment[unitType] ?? [])],
      dynamicEquipmentForWork: work => [...(workEquipment[work] ?? [])],
    },
  })
}

test('the Axeman qualifies for a melee parry — its only weapon is an axe', () => {
  const { isUnitMeleeWeaponEquipped } = loadEquipmentStats({
    unitEquipment: { Axeman: ['axe'] },
  })
  assert.equal(isUnitMeleeWeaponEquipped({ type: 'Axeman' }), true)
})

test('a villager never qualifies, even mid-woodcutting with an axe equipped', () => {
  const { isUnitMeleeWeaponEquipped } = loadEquipmentStats({
    workEquipment: { woodcutter: ['axe'] },
  })
  assert.equal(isUnitMeleeWeaponEquipped({ type: 'Villager', work: 'woodcutter' }), false)
})

test('a real weapon (broadsword) qualifies; the same unit carrying a bow never does', () => {
  const { isUnitMeleeWeaponEquipped } = loadEquipmentStats({
    unitEquipment: { BroadSwordsman: ['round_shield_brass_slash', 'broadsword'] },
  })
  assert.equal(isUnitMeleeWeaponEquipped({ type: 'BroadSwordsman' }), true)
  assert.equal(isUnitMeleeWeaponEquipped({ type: 'BroadSwordsman', projectile: 'Arrow' }), false)
})

test('unit entities without weapon equipment use the unarmed fallback power', () => {
  const { getEntityWeaponPower, UNARMED_UNIT_WEAPON_POWER } = loadEquipmentStats()

  assert.equal(getEntityWeaponPower({ family: 'unit', type: 'Villager' }), UNARMED_UNIT_WEAPON_POWER)
  assert.equal(getEntityWeaponPower({ family: 'animal', type: 'Deer' }), 0)
  assert.equal(getEntityWeaponPower({ family: 'building', type: 'House' }), 0)
})
