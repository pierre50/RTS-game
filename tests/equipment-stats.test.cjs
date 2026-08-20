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
    infantry: 'Fantassin',
  },
  WORK_TYPES: {
    attacker: 'attacker',
  },
}

const VISUAL_ONLY_EQUIPMENT = [
  'arrow_ceramic',
  'arrow_copper',
  'arrow_bronze',
  'arrow_iron',
  'cape_solid',
  'centurion_crest',
  'centurion_plumage',
  'crest',
  'gold',
  'helmet_wings',
  'legion_plumage',
  'meat',
  'plumage',
  'quiver',
  'sack_cloth_hood_leather',
  'stone',
  'upward_horns_ceramic',
  'upward_horns_white',
]

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
      dynamicEquipmentForUnit: (unitType, age, level) => {
        const equipment = unitEquipment[unitType]
        return typeof equipment === 'function' ? equipment(age, level) : [...(equipment ?? [])]
      },
      dynamicEquipmentForWork: (work, age) => {
        const equipment = workEquipment[work]
        return typeof equipment === 'function' ? equipment(age) : [...(equipment ?? [])]
      },
    },
    './unitExperience': {
      getUnitEquipmentLevel: unit => unit.level ?? 0,
    },
  })
}

function loadGameplayEquipmentJson() {
  return JSON.parse(fs.readFileSync(path.join(__dirname, '../public/assets/data/gameplay/equipment.json'), 'utf8'))
}

function getDynamicEquipmentKeys() {
  const source = fs.readFileSync(path.join(__dirname, '../app/lib/lpc/equipment.ts'), 'utf8')
  const match = source.match(
    /const DYNAMIC_EQUIPMENT_KEYS = \[([\s\S]*?)\] as const satisfies readonly DynamicEquipmentKey\[\]/
  )
  assert.ok(match, 'DYNAMIC_EQUIPMENT_KEYS not found')
  return [...match[1].matchAll(/'([^']+)'/g)].map(([, key]) => key)
}

test('gameplay equipment data covers every dynamic equipment key', () => {
  const equipment = loadGameplayEquipmentJson()
  const missing = getDynamicEquipmentKeys().filter(key => !Object.hasOwn(equipment, key))

  assert.deepEqual(missing, [])
  assert.deepEqual(equipment.helmet_barbarian_ceramic, { armor: { melee: 1, pierce: 1 } })
  assert.deepEqual(equipment.helmet_barbarian_nasal_ceramic, { armor: { melee: 1, pierce: 1 } })

  for (const visualOnly of VISUAL_ONLY_EQUIPMENT) {
    assert.deepEqual(equipment[visualOnly], {}, `${visualOnly} should remain visual-only`)
  }
})

test('combat equipment data declares weapon and armor stats by role', () => {
  const equipment = loadGameplayEquipmentJson()
  const visualOnly = new Set(VISUAL_ONLY_EQUIPMENT)
  const explicitWeapons = new Set([
    'ballista_bolt',
    'boar_tusks',
    'bow',
    'bow_great',
    'bow_recurve',
    'cane',
    'catapult_stone',
    'halberd',
    'longsword',
    'stone_thrower_stone',
    'watch_tower_arrow',
    'wolf_bite',
  ])

  for (const key of Object.keys(equipment)) {
    if (explicitWeapons.has(key) || /^(axe|hammer|pickaxe|scythe|sword)_/.test(key)) {
      assert.ok((equipment[key].weapon?.power ?? 0) > 0, `${key} should declare weapon.power`)
    }
    if (!visualOnly.has(key) && /^(armor_|bracers_|helmet_|leg_armor_|round_shield_|shoulder_)/.test(key)) {
      const armor = equipment[key].armor ?? {}
      assert.ok((armor.melee ?? 0) > 0 || (armor.pierce ?? 0) > 0, `${key} should declare armor stats`)
    }
  }
})

test('the Fantassin qualifies for a melee parry with its sword', () => {
  const { isUnitMeleeWeaponEquipped } = loadEquipmentStats({
    unitEquipment: { Fantassin: ['sword_ceramic'] },
  })
  assert.equal(isUnitMeleeWeaponEquipped({ type: 'Fantassin' }), true)
})

test('a villager never qualifies, even mid-woodcutting with an axe equipped', () => {
  const { isUnitMeleeWeaponEquipped } = loadEquipmentStats({
    workEquipment: { woodcutter: ['axe_ceramic'] },
  })
  assert.equal(isUnitMeleeWeaponEquipped({ type: 'Villager', work: 'woodcutter' }), false)
})

test('a real weapon qualifies; the same unit carrying a bow never does', () => {
  const { isUnitMeleeWeaponEquipped } = loadEquipmentStats({
    unitEquipment: { Fantassin: ['sword_copper'] },
  })
  assert.equal(isUnitMeleeWeaponEquipped({ type: 'Fantassin' }), true)
  assert.equal(isUnitMeleeWeaponEquipped({ type: 'Fantassin', projectile: 'Arrow' }), false)
})

test('unit entities without weapon equipment use the unarmed fallback power', () => {
  const { getEntityWeaponPower, UNARMED_UNIT_WEAPON_POWER } = loadEquipmentStats()

  assert.equal(getEntityWeaponPower({ family: 'unit', type: 'Villager' }), UNARMED_UNIT_WEAPON_POWER)
  assert.equal(getEntityWeaponPower({ family: 'animal', type: 'Deer' }), 0)
  assert.equal(getEntityWeaponPower({ family: 'building', type: 'House' }), 0)
})

test('dynamic unit equipment is not frozen into config during base stat normalization', () => {
  const { applyEquipmentStatsToUnitConfig } = loadEquipmentStats({
    unitEquipment: { Fantassin: ['sword_ceramic'] },
  })
  const infantryConfig = {}
  const towerConfig = { equipment: ['watch_tower_arrow'] }

  applyEquipmentStatsToUnitConfig('Fantassin', infantryConfig)
  applyEquipmentStatsToUnitConfig('WatchTower', towerConfig)

  assert.equal(infantryConfig.equipment, undefined)
  assert.deepEqual(towerConfig.equipment, ['watch_tower_arrow'])
})

test('villager work equipment resolves material-specific stats by owner age', () => {
  const { getUnitEffectiveCombatStats, getEntityWeaponPower } = loadEquipmentStats({
    workEquipment: {
      woodcutter: age => (age >= 1 ? ['axe_copper'] : ['axe_ceramic']),
    },
  })

  assert.equal(getUnitEffectiveCombatStats('Villager', {}, 'woodcutter', 0).weaponPower, 5)
  assert.equal(getUnitEffectiveCombatStats('Villager', {}, 'woodcutter', 1).weaponPower, 7)
  assert.equal(
    getEntityWeaponPower({
      family: 'unit',
      type: 'Villager',
      work: 'woodcutter',
      owner: { age: 1, config: {} },
    }),
    7
  )
})

test('infantry equipment resolves its sword material by owner age', () => {
  const { getUnitEffectiveCombatStats, getEntityWeaponPower } = loadEquipmentStats({
    unitEquipment: {
      Fantassin: age => (age >= 1 ? ['sword_copper'] : ['sword_ceramic']),
    },
  })

  assert.equal(getUnitEffectiveCombatStats('Fantassin', {}, undefined, 0).weaponPower, 6)
  assert.equal(getUnitEffectiveCombatStats('Fantassin', {}, undefined, 1).weaponPower, 8)
  assert.equal(
    getEntityWeaponPower({
      family: 'unit',
      type: 'Fantassin',
      owner: { age: 1, config: {} },
    }),
    8
  )
})

test('unit combat stats ignore non-work roles and still use unit equipment', () => {
  const { getUnitEffectiveCombatStats } = loadEquipmentStats({
    unitEquipment: { Fantassin: ['sword_ceramic', 'armor_leather'] },
    workEquipment: { woodcutter: ['axe_ceramic'] },
  })

  assert.deepEqual(getUnitEffectiveCombatStats('Fantassin', {}, 'attacker', 0, 2), {
    weaponPower: 6,
    meleeArmor: 1,
    pierceArmor: 0,
  })
})

test('infantry equipment stats unlock armor by level and cap effective combat armor', () => {
  const { getUnitEffectiveCombatStats, getEntityWeaponPower } = loadEquipmentStats({
    unitEquipment: {
      Fantassin: (age, level) => {
        const material = age >= 2 ? 'bronze' : age >= 1 ? 'copper' : 'ceramic'
        return [
          age >= 1 ? 'sword_copper' : 'sword_ceramic',
          ...(level >= 2 && level <= 9 ? ['armor_leather'] : []),
          ...(level >= 4 ? [`shoulder_legion_${material}`] : []),
          ...(level >= 5 ? [`bracers_${material}`] : []),
          ...(level >= 6 && level <= 14 ? [`helmet_pointed_${material}`] : []),
          ...(level >= 8 ? [`round_shield_${material}_slash`] : []),
          ...(level >= 10 && level <= 17 ? [`armor_mail_${material}`] : []),
          ...(level >= 12 ? [`leg_armor_${material}`] : []),
          ...(level >= 15 ? [`helmet_barbuta_${material}`] : []),
          ...(level >= 18 ? [`armor_legion_${material}`] : []),
        ]
      },
    },
  })

  assert.deepEqual(getUnitEffectiveCombatStats('Fantassin', {}, undefined, 0, 0), {
    weaponPower: 6,
    meleeArmor: 0,
    pierceArmor: 0,
  })
  assert.equal(getUnitEffectiveCombatStats('Fantassin', {}, undefined, 2, 15).meleeArmor, 3)
  assert.equal(getUnitEffectiveCombatStats('Fantassin', {}, undefined, 2, 15).pierceArmor, 2)
  assert.equal(getUnitEffectiveCombatStats('Fantassin', {}, undefined, 2, 18).meleeArmor, 3)
  assert.equal(getUnitEffectiveCombatStats('Fantassin', {}, undefined, 2, 18).pierceArmor, 2)
  assert.equal(
    getEntityWeaponPower({
      family: 'unit',
      type: 'Fantassin',
      level: 15,
      owner: { age: 2, config: {} },
    }),
    8
  )
})
