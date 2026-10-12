const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')
const { requireFromTsFile } = require('./helpers/loadTsModule.cjs')

const constants = {
  FAMILY_TYPES: {
    animal: 'animal',
    building: 'building',
    unit: 'unit',
  },
  UNIT_TYPES: {
    villager: 'Villager',
    infantry: 'Fantassin',
    hero: 'Hero',
  },
  WORK_TYPES: {
    hunter: 'hunter',
    attacker: 'attacker',
  },
}

const VISUAL_ONLY_EQUIPMENT = [
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
    return requireFromTsFile(request, filename, mocks)
  }
  new Function('module', 'exports', 'require', code)(module, module.exports, localRequire)
  return module.exports
}

function loadEquipmentStats({ unitEquipment = {}, workEquipment = {} } = {}) {
  return loadModule('app/lib/equipment/equipmentStats.ts', {
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
    './units/unitExperience': {
      getUnitEquipmentTier: unit => unit.level ?? 0,
      getReflexAttackRecoveryMultiplier: () => 1,
      getEnergyTotalLevelMultiplier: () => 1,
      getEnergyRegenLevelMultiplier: () => 1,
      setLevelUpRefreshHandler: () => {},
    },
  })
}

function loadGameplayEquipmentJson() {
  return JSON.parse(fs.readFileSync(path.join(__dirname, '../public/assets/data/gameplay/equipment.json'), 'utf8'))
}

function getDynamicEquipmentKeys() {
  return require('../tools/maps/load-generation-ts.cjs').loadGenerationTs('app/lib/lpc/equipmentData.ts')
    .DYNAMIC_EQUIPMENT_KEYS
}

test('gameplay equipment data covers every dynamic equipment key', () => {
  const equipment = loadGameplayEquipmentJson()
  const missing = getDynamicEquipmentKeys().filter(key => !Object.hasOwn(equipment, key))

  assert.deepEqual(missing, [])
  assert.deepEqual(equipment.helmet_barbarian_leather, { armor: 1 })
  assert.deepEqual(equipment.helmet_barbarian_nasal_leather, { armor: 1 })

  for (const visualOnly of VISUAL_ONLY_EQUIPMENT) {
    assert.deepEqual(equipment[visualOnly], {}, `${visualOnly} should remain visual-only`)
  }
})

test('combat equipment data declares weapon and armor stats by role', () => {
  const equipment = loadGameplayEquipmentJson()
  const visualOnly = new Set(VISUAL_ONLY_EQUIPMENT)
  const explicitWeapons = new Set([
    'boar_tusks',
    'bow',
    'bow_great',
    'bow_recurve',
    'cane',
    'spear_iron',
    'longsword',
    'watch_tower_arrow',
    'wolf_bite',
  ])

  for (const key of Object.keys(equipment)) {
    if (explicitWeapons.has(key) || /^(arrow|axe|hammer|pickaxe|scythe|sword)_/.test(key)) {
      assert.ok((equipment[key].weapon?.power ?? 0) > 0, `${key} should declare weapon.power`)
    }
    if (!visualOnly.has(key) && /^(armor_|bracers_|helmet_|leg_armor_|round_shield_|shoulder_)/.test(key)) {
      const armor = equipment[key].armor ?? 0
      assert.ok(armor > 0, `${key} should declare armor stats`)
    }
  }
})

test('the Fantassin qualifies for a melee parry with its sword', () => {
  const { isUnitMeleeWeaponEquipped } = loadEquipmentStats({
    unitEquipment: { Fantassin: ['sword_bronze'] },
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
    unitEquipment: { Fantassin: ['sword_iron'] },
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
    unitEquipment: { Fantassin: ['sword_bronze'] },
  })
  const infantryConfig = {}
  const towerConfig = { equipment: ['watch_tower_arrow'] }

  applyEquipmentStatsToUnitConfig('Fantassin', infantryConfig)
  applyEquipmentStatsToUnitConfig('WatchTower', towerConfig)

  assert.equal(infantryConfig.equipment, undefined)
  assert.deepEqual(towerConfig.equipment, ['watch_tower_arrow'])
})

test('villager work damage uses the equipped tool rather than the forge upgrade', () => {
  const { getEntityWeaponPower } = loadEquipmentStats({ workEquipment: { woodcutter: ['axe_ceramic'] } })
  const unit = {
    family: 'unit',
    type: 'Villager',
    work: 'woodcutter',
    owner: { forgeUpgrades: { axes: 3 }, config: {} },
    inventory: { activeWeapons: { tool: 'axe_ceramic' } },
  }
  assert.equal(getEntityWeaponPower(unit), 2)
  unit.inventory.activeWeapons.tool = 'axe_bronze'
  assert.equal(getEntityWeaponPower(unit), 4)
  delete unit.inventory.activeWeapons.tool
  assert.equal(getEntityWeaponPower(unit), 0.5)
})

test('infantry equipment resolves its sword material by forge upgrade', () => {
  const { getEntityWeaponPower } = loadEquipmentStats({
    unitEquipment: {
      Fantassin: owner => (owner.forgeUpgrades?.weapons >= 1 ? ['sword_iron'] : ['sword_bronze']),
    },
  })

  assert.equal(
    getEntityWeaponPower({
      family: 'unit',
      type: 'Fantassin',
      owner: { age: 0, config: {} },
    }),
    10
  )
  assert.equal(
    getEntityWeaponPower({
      family: 'unit',
      type: 'Fantassin',
      owner: { age: 0, forgeUpgrades: { axes: 1, weapons: 1 }, config: {} },
    }),
    12
  )
})

test('unit combat stats ignore non-work roles and still use unit equipment', () => {
  const { getUnitRuntimeCombatStats } = loadEquipmentStats({
    unitEquipment: { Fantassin: ['sword_bronze', 'armor_leather'] },
    workEquipment: { woodcutter: ['axe_ceramic'] },
  })
  const config = {}

  assert.deepEqual(
    getUnitRuntimeCombatStats(
      {
        type: 'Fantassin',
        work: 'attacker',
        level: 2,
        owner: { age: 0, config: { units: { Fantassin: config } } },
      },
      config
    ),
    {
      weaponPower: 10,
      armor: 1,
    }
  )
})

test('infantry equipment stats unlock armor by level and preserve protection above three', () => {
  const { getEntityWeaponPower, getUnitRuntimeCombatStats } = loadEquipmentStats({
    unitEquipment: {
      Fantassin: (owner, level) => {
        const age = owner.forgeUpgrades?.armor ?? 0
        const material = age >= 2 ? 'bronze' : age >= 1 ? 'copper' : 'ceramic'
        return [
          age >= 1 ? 'sword_iron' : 'sword_bronze',
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
  const config = {}
  const makeUnit = (age, level) => ({
    type: 'Fantassin',
    level,
    owner: { age: 0, forgeUpgrades: { armor: age, weapons: age }, config: { units: { Fantassin: config } } },
  })

  assert.deepEqual(getUnitRuntimeCombatStats(makeUnit(0, 0), config), {
    weaponPower: 10,
    armor: 0,
  })
  assert.equal(getUnitRuntimeCombatStats(makeUnit(2, 15), config).armor, 11)
  assert.equal(getUnitRuntimeCombatStats(makeUnit(2, 18), config).armor, 14)
  assert.equal(
    getEntityWeaponPower({
      family: 'unit',
      type: 'Fantassin',
      level: 15,
      owner: { age: 0, forgeUpgrades: { armor: 2, weapons: 2 }, config: {} },
    }),
    12
  )
})

test('hero inventory equipment drives runtime attack armor and range', () => {
  const {
    getEntityWeaponPower,
    getHeroInventoryWeaponCombatStats,
    getUnitCombatRange,
    getUnitRuntimeCombatStats,
    refreshUnitEquipmentStats,
    UNARMED_UNIT_WEAPON_POWER,
  } = loadEquipmentStats()
  const heroConfig = { category: 'Hero', armor: 1 }
  const owner = {
    age: 0,
    civ: 'demo',
    config: {
      units: { Hero: heroConfig },
    },
  }
  const hero = {
    family: 'unit',
    type: 'Hero',
    controlMode: 'hero',
    work: 'heroSword',
    owner,
    inventory: {
      equipped: {
        helmet: 'helmet_barbuta_ceramic',
        offhand: 'round_shield_ceramic_slash',
      },
      activeWeapons: {
        melee: 'sword_bronze',
        ranged: 'bow_great',
      },
    },
  }

  assert.deepEqual(getUnitRuntimeCombatStats(hero, heroConfig), {
    weaponPower: 10,
    armor: 3,
  })
  assert.deepEqual(getHeroInventoryWeaponCombatStats(hero), {
    meleeWeaponPower: 10,
    rangedWeaponPower: 7,
  })
  assert.equal(getEntityWeaponPower(hero), 10)
  assert.equal(getUnitCombatRange(hero), undefined)

  refreshUnitEquipmentStats(hero)
  assert.equal(hero.weaponPower, 10)
  assert.equal(hero.armor, 3)

  hero.work = 'hunter'
  assert.deepEqual(getUnitRuntimeCombatStats(hero, heroConfig), {
    weaponPower: 7,
    armor: 3,
  })
  assert.equal(getEntityWeaponPower(hero), 7)
  assert.equal(getUnitCombatRange(hero), 5)

  delete hero.inventory.activeWeapons.ranged
  assert.equal(getUnitRuntimeCombatStats(hero, heroConfig).weaponPower, UNARMED_UNIT_WEAPON_POWER)
  assert.equal(getUnitCombatRange(hero), undefined)
})

test('arrow materials add ranged damage without affecting melee damage or bow range', () => {
  const {
    getEquipmentCombatStats,
    getEntityWeaponPower,
    getEntityMeleeWeapon,
    getHeroInventoryWeaponCombatStats,
    getUnitCombatRange,
    getUnitRuntimeCombatStats,
    UNARMED_UNIT_WEAPON_POWER,
  } = loadEquipmentStats()
  for (const definitions of [undefined, loadGameplayEquipmentJson()]) {
    const hero = {
      type: 'Hero',
      work: 'hunter',
      owner: { config: { equipment: definitions, units: { Hero: {} } } },
      inventory: {
        equipped: {},
        activeWeapons: { ranged: 'bow', melee: 'sword_bronze' },
      },
    }
    for (const [index, material] of [
      [0, 'ceramic'],
      [2, 'bronze'],
      [3, 'iron'],
    ]) {
      const arrow = `arrow_${material}`
      hero.inventory.equipped.arrow = arrow
      assert.equal(getEquipmentCombatStats([arrow], definitions).weaponPower, index + 1)
      assert.equal(getEntityWeaponPower(hero), 6 + index)
      assert.equal(getUnitRuntimeCombatStats(hero, {}).weaponPower, 6 + index)
      assert.deepEqual(getHeroInventoryWeaponCombatStats(hero), {
        meleeWeaponPower: 10,
        rangedWeaponPower: 6 + index,
      })
      assert.equal(getUnitCombatRange(hero), 4)
      assert.equal(getEntityMeleeWeapon({ equipment: ['bow', arrow] }), undefined)
      hero.work = 'heroSword'
      assert.equal(getEntityWeaponPower(hero), 10)
      hero.work = 'hunter'
    }
    delete hero.inventory.activeWeapons.ranged
    assert.equal(getHeroInventoryWeaponCombatStats(hero).rangedWeaponPower, 0)
    assert.equal(getUnitRuntimeCombatStats(hero, {}).weaponPower, UNARMED_UNIT_WEAPON_POWER)
  }
})

test('melee collision weapon follows equipment and ignores shields and bows', () => {
  const { getEntityMeleeWeapon } = loadEquipmentStats()
  assert.equal(getEntityMeleeWeapon({ equipment: ['armor_leather', 'bow', 'axe_iron'] }), 'axe_iron')
  assert.equal(getEntityMeleeWeapon({ equipment: ['armor_leather', 'bow'] }), undefined)
  assert.equal(getEntityMeleeWeapon({ equipment: [] }), undefined)
})

test('worn equipment keeps normal stats until broken, then contributes nothing', () => {
  const { getEquipmentCombatStats } = loadEquipmentStats()
  assert.deepEqual(getEquipmentCombatStats(['sword_iron~condition:40']), getEquipmentCombatStats(['sword_iron']))
  assert.deepEqual(getEquipmentCombatStats(['sword_iron~condition:0', 'armor_mail_iron~condition:0']), {
    weaponPower: 0,
    armor: 0,
  })
})

test('an unusable bow does not display damage from its equipped arrows', () => {
  const { getHeroInventoryWeaponCombatStats } = loadEquipmentStats()
  const hero = { inventory: { activeWeapons: { ranged: 'bow~condition:0' }, equipped: { arrow: 'arrow_iron' } } }
  assert.equal(getHeroInventoryWeaponCombatStats(hero).rangedWeaponPower, 0)
})

test('ordinary unit protection above three keeps every intact piece and excludes broken pieces', () => {
  const { getUnitRuntimeCombatStats, applyEquipmentStatsToUnitConfig } = loadEquipmentStats()
  const config = { equipment: ['armor_mail_iron', 'helmet_barbuta_iron'] }
  applyEquipmentStatsToUnitConfig('Fantassin', config)
  assert.equal(config.armor, 9)
  const unit = {
    type: 'Fantassin',
    equipment: ['armor_mail_iron', 'helmet_barbuta_iron'],
    equipmentDurability: { armor_mail_iron: 0 },
    owner: { config: {} },
  }
  assert.equal(getUnitRuntimeCombatStats(unit, {}).armor, 5)
  unit.equipmentDurability.armor_mail_iron = 100
  assert.equal(getUnitRuntimeCombatStats(unit, {}).armor, 9)
})
