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

const constants = {
  ACTION_TYPES: {
    attack: 'attack',
    takemeat: 'takemeat',
  },
  SHEET_TYPES: {
    action: 'actionSheet',
    standing: 'standingSheet',
    walking: 'walkingSheet',
  },
  UNIT_TYPES: {
    bowman: 'Bowman',
    chief: 'Chief',
    infantry: 'Fantassin',
    priest: 'Priest',
  },
  WORK_TYPES: {
    attacker: 'attacker',
    builder: 'builder',
    farmer: 'farmer',
    goldminer: 'goldminer',
    hunter: 'hunter',
    stoneminer: 'stoneminer',
    woodcutter: 'woodcutter',
  },
}

test('carried-resource layers hide during action and return after it', () => {
  const { isAppearanceLayerHiddenByLoading } = loadModule('app/lib/lpc/appearanceLayers.ts', {
    '../../constants': constants,
  })
  const carriedResourceLayer = { showWhenLoading: true }

  assert.equal(
    isAppearanceLayerHiddenByLoading({
      layer: carriedResourceLayer,
      isLoading: true,
      sheet: constants.SHEET_TYPES.action,
      heroControlled: false,
    }),
    true
  )
  assert.equal(
    isAppearanceLayerHiddenByLoading({
      layer: carriedResourceLayer,
      isLoading: true,
      sheet: constants.SHEET_TYPES.standing,
      heroControlled: false,
    }),
    false
  )
  assert.equal(
    isAppearanceLayerHiddenByLoading({
      layer: carriedResourceLayer,
      isLoading: true,
      sheet: constants.SHEET_TYPES.walking,
      heroControlled: false,
    }),
    false
  )
})

test('tools hidden while carrying come back during action', () => {
  const { isAppearanceLayerHiddenByLoading } = loadModule('app/lib/lpc/appearanceLayers.ts', {
    '../../constants': constants,
  })
  const toolLayer = { hideWhenLoading: true }

  assert.equal(
    isAppearanceLayerHiddenByLoading({
      layer: toolLayer,
      isLoading: true,
      sheet: constants.SHEET_TYPES.action,
      heroControlled: false,
    }),
    false
  )
  assert.equal(
    isAppearanceLayerHiddenByLoading({
      layer: toolLayer,
      isLoading: true,
      sheet: constants.SHEET_TYPES.standing,
      heroControlled: false,
    }),
    true
  )
  assert.equal(
    isAppearanceLayerHiddenByLoading({
      layer: toolLayer,
      isLoading: true,
      sheet: constants.SHEET_TYPES.walking,
      heroControlled: false,
    }),
    true
  )
})

test('villager and hero work tools follow civilization metal age', () => {
  const { dynamicEquipmentForWork, dynamicEquipmentLayersForVillager } = loadModule('app/lib/lpc/equipment.ts', {
    '../../constants': constants,
  })

  const layers = dynamicEquipmentLayersForVillager()
  const woodcutterFront = layers.find(
    layer => layer.workTypes?.includes(constants.WORK_TYPES.woodcutter) && layer.zIndex === 12
  )
  const builderFront = layers.find(
    layer => layer.workTypes?.includes(constants.WORK_TYPES.builder) && layer.zIndex === 12
  )

  assert.equal(woodcutterFront?.walkingSheet, 'lpc-equipment/axe_ceramic/front/walking')
  assert.deepEqual(woodcutterFront?.actionWorkSheetOverrides?.['attacker:attack'], {})
  assert.equal(woodcutterFront?.ageSheetOverrides?.['1']?.walkingSheet, 'lpc-equipment/axe_copper/front/walking')
  assert.equal(woodcutterFront?.ageSheetOverrides?.['1']?.actionSheet, 'lpc-equipment/axe_copper/front/action')
  assert.equal(builderFront?.walkingSheet, 'lpc-equipment/hammer_ceramic/front/walking')
  assert.equal(builderFront?.ageSheetOverrides?.['1']?.actionSheet, 'lpc-equipment/hammer_copper/front/action')
  assert.equal(builderFront?.ageSheetOverrides?.['2']?.actionSheet, 'lpc-equipment/hammer_bronze/front/action')
  assert.equal(builderFront?.ageSheetOverrides?.['3']?.actionSheet, 'lpc-equipment/hammer_iron/front/action')

  assert.deepEqual(dynamicEquipmentForWork('heroSword', 0), ['sword_ceramic'])
  assert.deepEqual(dynamicEquipmentForWork('heroSword', 1), ['sword_copper'])
  assert.deepEqual(dynamicEquipmentForWork('heroSword', 2), ['sword_bronze'])
  assert.deepEqual(dynamicEquipmentForWork('heroSword', 3), ['sword_iron'])
})

test('infantry equipment layers unlock by level and switch metal by civilization age', () => {
  const { dynamicEquipmentForUnit, dynamicEquipmentLayersForUnit } = loadModule('app/lib/lpc/equipment.ts', {
    '../../constants': constants,
  })

  assert.deepEqual(dynamicEquipmentForUnit('Chief', 0, 0), ['sword_ceramic'])
  assert.deepEqual(dynamicEquipmentForUnit('Chief', 1, 0), ['sword_copper'])
  assert.deepEqual(dynamicEquipmentForUnit('Chief', 2, 0), ['sword_bronze'])
  assert.deepEqual(dynamicEquipmentForUnit('Chief', 3, 0), ['sword_iron'])
  assert.deepEqual(dynamicEquipmentForUnit('Fantassin', 0, 0), ['sword_ceramic'])
  assert.deepEqual(dynamicEquipmentForUnit('Fantassin', 0, 2), ['sword_ceramic', 'armor_leather'])
  assert.deepEqual(dynamicEquipmentForUnit('Fantassin', 2, 15), [
    'sword_bronze',
    'shoulder_legion_bronze',
    'bracers_bronze',
    'round_shield_bronze_slash',
    'armor_mail_bronze',
    'leg_armor_bronze',
    'cape_solid',
    'helmet_barbuta_bronze',
  ])
  assert.deepEqual(dynamicEquipmentForUnit('Fantassin', 3, 15), [
    'sword_iron',
    'shoulder_legion_iron',
    'bracers_iron',
    'round_shield_iron_slash',
    'armor_mail_iron',
    'leg_armor_iron',
    'cape_solid',
    'helmet_barbuta_iron',
  ])
  assert.deepEqual(dynamicEquipmentForUnit('Fantassin', 2, 16), [
    'sword_bronze',
    'shoulder_legion_bronze',
    'bracers_bronze',
    'round_shield_bronze_slash',
    'armor_mail_bronze',
    'leg_armor_bronze',
    'cape_solid',
    'helmet_barbuta_bronze',
    'crest',
  ])
  assert.deepEqual(dynamicEquipmentForUnit('Fantassin', 2, 18), [
    'sword_bronze',
    'shoulder_legion_bronze',
    'bracers_bronze',
    'round_shield_bronze_slash',
    'armor_legion_bronze',
    'leg_armor_bronze',
    'cape_solid',
    'helmet_barbuta_bronze',
    'centurion_crest',
  ])
  assert.deepEqual(dynamicEquipmentForUnit('Fantassin', 2, 20), [
    'sword_bronze',
    'shoulder_legion_bronze',
    'bracers_bronze',
    'round_shield_bronze_slash',
    'armor_legion_bronze',
    'leg_armor_bronze',
    'cape_solid',
    'helmet_barbuta_bronze',
    'centurion_plumage',
  ])

  const layers = dynamicEquipmentLayersForUnit('Fantassin')
  const sword = layers.find(layer => layer.walkingSheet === 'lpc-equipment/sword_ceramic/front/walking')
  const shield = layers.find(layer => layer.walkingSheet === 'lpc-equipment/round_shield_ceramic_slash/front/walking')
  const leather = layers.find(layer => layer.walkingSheet === 'lpc-equipment/armor_leather/front/walking')
  const mail = layers.find(layer => layer.walkingSheet === 'lpc-equipment/armor_mail_ceramic/front/walking')
  const pointed = layers.find(layer => layer.walkingSheet === 'lpc-equipment/helmet_pointed_ceramic/front/walking')
  const barbuta = layers.find(layer => layer.walkingSheet === 'lpc-equipment/helmet_barbuta_ceramic/front/walking')
  const bracers = layers.find(layer => layer.walkingSheet === 'lpc-equipment/bracers_ceramic/front/walking')
  const cape = layers.find(layer => layer.walkingSheet === 'lpc-equipment/cape_solid/front/walking')
  const crest = layers.find(layer => layer.walkingSheet === 'lpc-equipment/crest/front/walking')
  const centurionCrest = layers.find(layer => layer.walkingSheet === 'lpc-equipment/centurion_crest/front/walking')
  const centurionPlumage = layers.find(layer => layer.walkingSheet === 'lpc-equipment/centurion_plumage/front/walking')

  assert.equal(sword?.zIndex, 12)
  assert.equal(sword?.mountedCut, false)
  assert.equal(shield?.zIndex, 12)
  assert.equal(shield?.mountedCut, false)
  assert.equal(leather?.zIndex, 11)
  assert.equal(leather?.mountedCut, undefined)
  assert.equal(leather?.minLevel, 2)
  assert.equal(leather?.maxLevel, 9)
  assert.equal(leather?.palette, undefined)
  assert.equal(mail?.zIndex, 11)
  assert.equal(mail?.mountedCut, undefined)
  assert.equal(mail?.minLevel, 10)
  assert.equal(mail?.maxLevel, 17)
  assert.equal(mail?.ageSheetOverrides?.['2']?.walkingSheet, 'lpc-equipment/armor_mail_bronze/front/walking')
  assert.equal(mail?.ageSheetOverrides?.['3']?.walkingSheet, 'lpc-equipment/armor_mail_iron/front/walking')
  assert.equal(pointed?.zIndex, 11)
  assert.equal(pointed?.mountedCut, false)
  assert.equal(pointed?.minLevel, 6)
  assert.equal(pointed?.maxLevel, 14)
  assert.equal(pointed?.ageSheetOverrides?.['2']?.walkingSheet, 'lpc-equipment/helmet_pointed_bronze/front/walking')
  assert.equal(pointed?.ageSheetOverrides?.['3']?.walkingSheet, 'lpc-equipment/helmet_pointed_iron/front/walking')
  assert.equal(barbuta?.minLevel, 15)
  assert.equal(barbuta?.ageSheetOverrides?.['2']?.actionSheet, 'lpc-equipment/helmet_barbuta_bronze/front/action')
  assert.equal(bracers?.minLevel, 5)
  assert.equal(bracers?.mountedCut, undefined)
  assert.equal(bracers?.ageSheetOverrides?.['2']?.walkingSheet, 'lpc-equipment/bracers_bronze/front/walking')
  assert.equal(bracers?.ageSheetOverrides?.['3']?.walkingSheet, 'lpc-equipment/bracers_iron/front/walking')
  assert.equal(cape?.minLevel, 14)
  assert.equal(cape?.palette, 'player')
  assert.equal(crest?.minLevel, 16)
  assert.equal(crest?.maxLevel, 17)
  assert.equal(crest?.palette, 'player')
  assert.equal(crest?.mountedSheet, 'lpc-equipment/crest/front/walking')
  assert.equal(centurionCrest?.minLevel, 18)
  assert.equal(centurionCrest?.maxLevel, 19)
  assert.equal(centurionCrest?.palette, 'player')
  assert.equal(centurionCrest?.mountedSheet, 'lpc-equipment/centurion_crest/front/walking')
  assert.equal(centurionPlumage?.minLevel, 20)
  assert.equal(centurionPlumage?.palette, 'player')
  assert.equal(centurionPlumage?.mountedCut, false)
  assert.equal(centurionPlumage?.mountedSheet, 'lpc-equipment/centurion_plumage/front/walking')
})

test('archer equipment follows soldier armor progression without shield', () => {
  const { dynamicEquipmentForUnit, dynamicEquipmentLayersForUnit } = loadModule('app/lib/lpc/equipment.ts', {
    '../../constants': constants,
  })

  assert.deepEqual(dynamicEquipmentForUnit('Bowman', 0, 0), ['quiver', 'bow'])
  assert.deepEqual(dynamicEquipmentForUnit('Bowman', 1, 0), ['quiver', 'bow_great'])
  assert.deepEqual(dynamicEquipmentForUnit('Bowman', 2, 0), ['quiver', 'bow_recurve'])
  assert.deepEqual(dynamicEquipmentForUnit('Bowman', 2, 15), [
    'quiver',
    'bow_recurve',
    'shoulder_legion_bronze',
    'bracers_bronze',
    'armor_mail_bronze',
    'leg_armor_bronze',
    'cape_solid',
    'helmet_barbuta_bronze',
  ])
  assert.deepEqual(dynamicEquipmentForUnit('Bowman', 3, 15), [
    'quiver',
    'bow_recurve',
    'shoulder_legion_iron',
    'bracers_iron',
    'armor_mail_iron',
    'leg_armor_iron',
    'cape_solid',
    'helmet_barbuta_iron',
  ])
  assert.equal(dynamicEquipmentForUnit('Bowman', 2, 20).includes('round_shield_bronze_slash'), false)
  assert.equal(dynamicEquipmentForUnit('Bowman', 3, 20).includes('round_shield_iron_slash'), false)

  const layers = dynamicEquipmentLayersForUnit('Bowman')
  const bow = layers.find(layer => layer.walkingSheet === 'lpc-equipment/bow/front/walking')
  const quiver = layers.find(layer => layer.walkingSheet === 'lpc-equipment/quiver/back/walking')
  const mail = layers.find(layer => layer.walkingSheet === 'lpc-equipment/armor_mail_ceramic/front/walking')
  const shield = layers.find(layer => layer.walkingSheet === 'lpc-equipment/round_shield_ceramic_slash/front/walking')
  assert.equal(bow?.ageSheetOverrides?.['1']?.walkingSheet, 'lpc-equipment/bow_great/front/walking')
  assert.equal(bow?.ageSheetOverrides?.['2']?.actionSheet, 'lpc-equipment/bow_recurve/front/action')
  assert.equal(bow?.mountedCut, false)
  assert.equal(quiver?.mountedCut, false)
  assert.equal(mail?.minLevel, 10)
  assert.equal(mail?.mountedCut, undefined)
  assert.equal(mail?.ageSheetOverrides?.['2']?.walkingSheet, 'lpc-equipment/armor_mail_bronze/front/walking')
  assert.equal(mail?.ageSheetOverrides?.['3']?.walkingSheet, 'lpc-equipment/armor_mail_iron/front/walking')
  assert.equal(shield, undefined)
})

test('helmeted infantry swaps to no-hair baked base', () => {
  const cachedAliases = new Set([
    'lpc-baked/infantry/greek/male/walking',
    'lpc-baked/infantry_nohair/greek/male/walking',
  ])
  const { applyBakedLpcUnitAssets } = loadModule('app/lib/lpc/baked.ts', {
    './appearance': { hashLpcAppearanceSeed: () => 0 },
    './equipment': {
      dynamicEquipmentAssets: () => [],
      dynamicEquipmentLayersForUnit: () => [],
      dynamicEquipmentLayersForVillager: () => [],
    },
    '../chief': { isChiefUnit: () => false },
    '../unitExperience': { getUnitEquipmentLevel: unit => unit.level ?? 0 },
    '../../constants': constants,
    'pixi.js': { Assets: { cache: { has: alias => cachedAliases.has(alias) }, load: async () => {} } },
  })
  const baseUnit = {
    type: 'Fantassin',
    owner: { civ: 'Greek', label: 'P1' },
    label: 'unit',
    i: 1,
    j: 1,
    level: 5,
  }
  const helmetedUnit = { ...baseUnit, level: 6 }

  assert.equal(applyBakedLpcUnitAssets(baseUnit), true)
  assert.equal(baseUnit.assets.walkingSheet, 'lpc-baked/infantry/greek/male/walking')
  assert.equal(baseUnit.assets.actionSheet, 'lpc-baked/infantry/greek/male/action')
  assert.equal(applyBakedLpcUnitAssets(helmetedUnit), true)
  assert.equal(helmetedUnit.assets.walkingSheet, 'lpc-baked/infantry_nohair/greek/male/walking')
  assert.equal(helmetedUnit.assets.actionSheet, 'lpc-baked/infantry_nohair/greek/male/action')
})

test('helmeted archer swaps to no-hair baked base', () => {
  const cachedAliases = new Set([
    'lpc-baked/infantry/greek/male/walking',
    'lpc-baked/infantry_nohair/greek/male/walking',
  ])
  const { applyBakedLpcUnitAssets } = loadModule('app/lib/lpc/baked.ts', {
    './appearance': { hashLpcAppearanceSeed: () => 0 },
    './equipment': {
      dynamicEquipmentAssets: () => [],
      dynamicEquipmentLayersForUnit: () => [],
      dynamicEquipmentLayersForVillager: () => [],
    },
    '../chief': { isChiefUnit: () => false },
    '../unitExperience': { getUnitEquipmentLevel: unit => unit.level ?? 0 },
    '../../constants': constants,
    'pixi.js': { Assets: { cache: { has: alias => cachedAliases.has(alias) }, load: async () => {} } },
  })
  const baseUnit = {
    type: 'Bowman',
    owner: { civ: 'Greek', label: 'P1' },
    label: 'unit',
    i: 1,
    j: 1,
    level: 5,
  }
  const helmetedUnit = { ...baseUnit, level: 6 }

  assert.equal(applyBakedLpcUnitAssets(baseUnit), true)
  assert.equal(baseUnit.assets.walkingSheet, 'lpc-baked/infantry/greek/male/walking')
  assert.equal(baseUnit.assets.actionSheet, 'lpc-baked/infantry/greek/male/action/shoot')
  assert.equal(applyBakedLpcUnitAssets(helmetedUnit), true)
  assert.equal(helmetedUnit.assets.walkingSheet, 'lpc-baked/infantry_nohair/greek/male/walking')
  assert.equal(helmetedUnit.assets.actionSheet, 'lpc-baked/infantry_nohair/greek/male/action/shoot')
})
