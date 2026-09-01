const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function loadModule(relativePath, mocks) {
  return loadTsModule(relativePath, {
    baseDir: path.join(__dirname, '..'),
    mocks: {
      './animationSpeeds': {
        LPC_CORPSE_ANIMATION_SPEED: 0,
        LPC_RUNTIME_ANIMATION_SPEED: 0.3,
        LPC_SLASH_ANIMATION_SPEED: 0.25,
        lpcAnimationSpeedForSheet: () => 0.3,
      },
      '../../lib/units/actionVisualSheet': {
        SHOOTING_SHEET_KEY: 'shootingSheet',
        getActionVisualSheetKey: (action, unitType, work) => {
          if (action === constants.ACTION_TYPES.takemeat) return constants.SHEET_TYPES.harvest
          if (unitType === constants.UNIT_TYPES.bowman || work === constants.WORK_TYPES.hunter) {
            return 'shootingSheet'
          }
          return constants.SHEET_TYPES.action
        },
      },
      ...mocks,
    },
  })
}

const constants = {
  ACTION_TYPES: {
    attack: 'attack',
    takemeat: 'takemeat',
  },
  LABEL_TYPES: {
    sprite: 'sprite',
  },
  SHEET_TYPES: {
    action: 'actionSheet',
    corpse: 'corpseSheet',
    dying: 'dyingSheet',
    standing: 'standingSheet',
    walking: 'walkingSheet',
  },
  UNIT_TYPES: {
    bowman: 'Bowman',
    banditArcher: 'BanditArcher',
    banditChief: 'BanditChief',
    banditSword: 'BanditSword',
    chief: 'Chief',
    infantry: 'Fantassin',
    priest: 'Priest',
    villager: 'Villager',
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

const heroAppearanceMock = {
  heroAppearanceAssetsForPlayers: () => [],
  heroAppearanceLayersForPlayer: () => [],
  registerHeroAppearanceAliasesForPlayers: () => {},
}

test('helmet decor renders above head and helmet on death sheets', () => {
  const { getAppearanceLayerZIndex } = loadModule('app/lib/lpc/appearanceLayers.ts', {
    '../../constants': constants,
  })
  const { dynamicEquipmentLayersForUnit } = loadModule('app/lib/lpc/equipment.ts', {
    '../../constants': constants,
  })

  const chiefLayers = dynamicEquipmentLayersForUnit('BanditChief')
  const helmet = chiefLayers.find(layer => layer.equipmentKey === 'helmet_barbarian_ceramic')
  const hornBack = chiefLayers.find(
    layer =>
      layer.equipmentKey === 'upward_horns_ceramic' &&
      layer.walkingSheet === 'lpc-equipment/upward_horns_ceramic/back/walking'
  )
  const hornFront = chiefLayers.find(
    layer =>
      layer.equipmentKey === 'upward_horns_ceramic' &&
      layer.walkingSheet === 'lpc-equipment/upward_horns_ceramic/front/walking'
  )

  assert.equal(helmet?.zIndex, 11)
  assert.equal(hornBack?.zIndex, 8)
  assert.equal(hornFront?.zIndex, 12)
  assert.equal(hornBack?.shootingSheet, 'lpc-equipment/upward_horns_ceramic/back/shooting')
  assert.equal(hornFront?.shootingSheet, 'lpc-equipment/upward_horns_ceramic/front/shooting')
  assert.equal(getAppearanceLayerZIndex({ layer: hornBack, sheet: constants.SHEET_TYPES.walking }), 8)
  assert.equal(getAppearanceLayerZIndex({ layer: hornBack, sheet: constants.SHEET_TYPES.dying }), 13)
  assert.equal(getAppearanceLayerZIndex({ layer: hornFront, sheet: constants.SHEET_TYPES.corpse }), 13)
})

test('helmet decor with hurt art exposes death sheets', () => {
  const { dynamicEquipmentLayersForUnit } = loadModule('app/lib/lpc/equipment.ts', {
    '../../constants': constants,
  })

  const romanLayers = dynamicEquipmentLayersForUnit('Fantassin', 'Roman')
  const romanPlumage = romanLayers.find(layer => layer.equipmentKey === 'centurion_plumage')
  assert.equal(romanPlumage?.dyingSheet, 'lpc-equipment/centurion_plumage/front/dying')
  assert.equal(romanPlumage?.corpseSheet, 'lpc-equipment/centurion_plumage/front/corpse')

  const babylonianLayers = dynamicEquipmentLayersForUnit('Fantassin', 'Babylonian')
  const legionPlumage = babylonianLayers.find(layer => layer.equipmentKey === 'legion_plumage')
  assert.equal(legionPlumage?.dyingSheet, 'lpc-equipment/legion_plumage/front/dying')
  assert.equal(legionPlumage?.corpseSheet, 'lpc-equipment/legion_plumage/front/corpse')

  const nordicLayers = dynamicEquipmentLayersForUnit('Fantassin', 'Nordic')
  const hornBack = nordicLayers.find(
    layer =>
      layer.equipmentKey === 'upward_horns_white' &&
      layer.walkingSheet === 'lpc-equipment/upward_horns_white/back/walking'
  )
  const hornFront = nordicLayers.find(
    layer =>
      layer.equipmentKey === 'upward_horns_white' &&
      layer.walkingSheet === 'lpc-equipment/upward_horns_white/front/walking'
  )
  assert.equal(hornBack?.dyingSheet, 'lpc-equipment/upward_horns_white/back/dying')
  assert.equal(hornBack?.corpseSheet, 'lpc-equipment/upward_horns_white/back/corpse')
  assert.equal(hornBack?.shootingSheet, 'lpc-equipment/upward_horns_white/back/shooting')
  assert.equal(hornFront?.dyingSheet, 'lpc-equipment/upward_horns_white/front/dying')
  assert.equal(hornFront?.corpseSheet, 'lpc-equipment/upward_horns_white/front/corpse')
  assert.equal(hornFront?.shootingSheet, 'lpc-equipment/upward_horns_white/front/shooting')
})

test('back-worn equipment lifts above body on death sheets', () => {
  const { getAppearanceLayerZIndex } = loadModule('app/lib/lpc/appearanceLayers.ts', {
    '../../constants': constants,
  })
  const { dynamicEquipmentLayersForUnit } = loadModule('app/lib/lpc/equipment.ts', {
    '../../constants': constants,
  })

  const archerLayers = dynamicEquipmentLayersForUnit('Bowman')
  const quiver = archerLayers.find(layer => layer.equipmentKey === 'quiver')
  assert.equal(quiver?.zIndex, 8)
  assert.equal(getAppearanceLayerZIndex({ layer: quiver, sheet: constants.SHEET_TYPES.walking }), 8)
  assert.equal(getAppearanceLayerZIndex({ layer: quiver, sheet: constants.SHEET_TYPES.dying }), 11)

  const infantryLayers = dynamicEquipmentLayersForUnit('Fantassin')
  const capeBack = infantryLayers.find(
    layer => layer.equipmentKey === 'cape_solid' && layer.walkingSheet === 'lpc-equipment/cape_solid/back/walking'
  )
  const capeFront = infantryLayers.find(
    layer => layer.equipmentKey === 'cape_solid' && layer.walkingSheet === 'lpc-equipment/cape_solid/front/walking'
  )
  assert.equal(capeBack?.shootingSheet, 'lpc-equipment/cape_solid/back/shooting')
  assert.equal(capeFront?.shootingSheet, 'lpc-equipment/cape_solid/front/shooting')
  assert.equal(getAppearanceLayerZIndex({ layer: capeBack, sheet: constants.SHEET_TYPES.corpse }), 11)
  assert.equal(getAppearanceLayerZIndex({ layer: capeFront, sheet: constants.SHEET_TYPES.corpse }), 12)
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
  assert.equal(woodcutterFront?.appearanceVariantKey, 'gender')
  assert.deepEqual(woodcutterFront?.actionWorkSheetOverrides?.['attacker:attack'], {})
  assert.equal(woodcutterFront?.ageSheetOverrides?.['1']?.walkingSheet, 'lpc-equipment/axe_copper/front/walking')
  assert.equal(woodcutterFront?.ageSheetOverrides?.['1']?.actionSheet, 'lpc-equipment/axe_copper/front/action')
  assert.equal(builderFront?.walkingSheet, 'lpc-equipment/hammer_ceramic/front/walking')
  assert.equal(builderFront?.appearanceVariantKey, 'gender')
  assert.equal(builderFront?.ageSheetOverrides?.['1']?.actionSheet, 'lpc-equipment/hammer_copper/front/action')
  assert.equal(builderFront?.ageSheetOverrides?.['2']?.actionSheet, 'lpc-equipment/hammer_bronze/front/action')
  assert.equal(builderFront?.ageSheetOverrides?.['3']?.actionSheet, 'lpc-equipment/hammer_iron/front/action')

  assert.deepEqual(dynamicEquipmentForWork('heroSword', 0), ['sword_ceramic'])
  assert.deepEqual(dynamicEquipmentForWork('heroSword', 1), ['sword_copper'])
  assert.deepEqual(dynamicEquipmentForWork('heroSword', 2), ['sword_bronze'])
  assert.deepEqual(dynamicEquipmentForWork('heroSword', 3), ['sword_iron'])
})

test('hero baked appearance includes inventory equipped layers', () => {
  const cachedAliases = new Set(['lpc-baked/hero/greek/male/body/walking'])
  const { applyBakedLpcUnitAssets } = loadModule('app/lib/lpc/baked.ts', {
    './appearance': { hashLpcAppearanceSeed: () => 0 },
    './heroAppearance': heroAppearanceMock,
    './equipment': {
      dynamicEquipmentAssets: () => [],
      dynamicEquipmentLayersForEquipment: equipment => equipment.map(item => ({ equipmentKey: item })),
      dynamicEquipmentLayersForUnit: () => [],
      dynamicEquipmentLayersForVillager: () => [
        { workTypes: ['heroSword'], equipmentKey: 'sword_ceramic' },
        { workTypes: ['hunter'], equipmentKey: 'bow' },
        { workTypes: ['hunter'], equipmentKey: 'quiver' },
      ],
    },
    '../chief': { isChiefUnit: unit => Boolean(unit.isChief) },
    '../units/unitExperience': { getUnitEquipmentLevel: () => 0 },
    '../../constants': constants,
    'pixi.js': { Assets: { cache: { has: alias => cachedAliases.has(alias) }, load: async () => {} } },
  })
  const hero = {
    type: 'Villager',
    isChief: true,
    controlMode: 'hero',
    work: 'heroSword',
    owner: { civ: 'Greek', label: 'P1', gender: 'male' },
    inventory: {
      equipped: {
        helmet: 'helmet_barbuta_ceramic',
        cape: 'cape_solid',
        offhand: 'round_shield_ceramic_slash',
        arrow: 'arrow_copper',
      },
      activeWeapons: {
        melee: 'sword_bronze',
        ranged: 'bow',
      },
    },
    label: 'hero',
    i: 1,
    j: 1,
  }

  assert.equal(applyBakedLpcUnitAssets(hero), true)
  assert.equal(hero.appearance.layers.some(layer => layer.equipmentKey === 'sword_ceramic'), false)
  assert.ok(hero.appearance.layers.some(layer => layer.equipmentKey === 'sword_bronze'))
  assert.ok(hero.appearance.layers.some(layer => layer.equipmentKey === 'round_shield_ceramic_slash'))

  hero.work = constants.WORK_TYPES.hunter
  assert.equal(applyBakedLpcUnitAssets(hero), true)
  assert.equal(hero.appearance.layers.some(layer => layer.workTypes?.includes('hunter') && layer.equipmentKey === 'bow'), false)
  assert.equal(hero.appearance.layers.some(layer => layer.workTypes?.includes('hunter') && layer.equipmentKey === 'quiver'), false)
  assert.ok(hero.appearance.layers.some(layer => layer.equipmentKey === 'bow'))
  assert.ok(hero.appearance.layers.some(layer => layer.equipmentKey === 'arrow_copper'))
  assert.equal(hero.appearance.layers.some(layer => layer.equipmentKey === 'round_shield_ceramic_slash'), false)
})

test('runtime equipment preload collection deduplicates used equipment atlases', () => {
  const cachedAliases = new Set(['lpc-baked/infantry/greek/male/walking'])
  const { collectBakedLpcRuntimeEquipmentAssets } = loadModule('app/lib/lpc/baked.ts', {
    './appearance': { hashLpcAppearanceSeed: () => 0 },
    './heroAppearance': heroAppearanceMock,
    './equipment': {
      dynamicEquipmentAsset: equipment => ({
        alias: equipment.startsWith('sword_') ? 'lpc-equipment/weapon/sword' : `lpc-equipment/${equipment}`,
        src: `${equipment}.json`,
      }),
      dynamicEquipmentAssets: () => [],
      dynamicEquipmentLayersForEquipment: () => [],
      dynamicEquipmentLayersForUnit: () => [
        { equipmentKey: 'sword_ceramic' },
        { equipmentKey: 'sword_copper' },
        { equipmentKey: 'helmet_pointed_ceramic' },
        { equipmentKey: 'not_dynamic' },
      ],
      dynamicEquipmentLayersForVillager: () => [],
      isDynamicEquipmentKey: equipment => equipment !== 'not_dynamic',
    },
    '../chief': { isChiefUnit: () => false },
    '../units/unitExperience': { getUnitEquipmentLevel: () => 0 },
    '../../constants': constants,
    'pixi.js': { Assets: { cache: { has: alias => cachedAliases.has(alias) }, load: async () => {} } },
  })
  const unit = {
    type: 'Fantassin',
    owner: { civ: 'Greek', label: 'P1' },
    label: 'unit',
    i: 1,
    j: 1,
  }

  assert.deepEqual(collectBakedLpcRuntimeEquipmentAssets([{ units: [unit] }]), [
    { alias: 'lpc-equipment/weapon/sword', src: 'sword_ceramic.json' },
    { alias: 'lpc-equipment/helmet_pointed_ceramic', src: 'helmet_pointed_ceramic.json' },
  ])
})

test('hero hair appearance layer is hidden while a helmet is equipped and restored after unequip', () => {
  class AnimatedSprite {
    constructor(textures) {
      this.textures = textures
      this.label = ''
      this.eventMode = 'none'
      this.position = { x: 0, y: 0 }
      this.scale = { x: 1, y: 1 }
      this.anchor = {
        set: (x, y) => {
          this.anchor.x = x
          this.anchor.y = y
        },
      }
      this.roundPixels = false
      this.loop = true
      this.updateAnchor = false
      this.zIndex = 0
      this.visible = true
      this.parent = null
      this.playing = false
      this.currentFrame = 0
      this.filters = null
    }
    destroy() {}
    gotoAndStop(frame) { this.currentFrame = frame }
    gotoAndPlay(frame) { this.currentFrame = frame; this.playing = true }
  }
  const spritesheet = {
    data: { animationSpeed: 0.2 },
    textures: { frame0: { defaultAnchor: { x: 0.5, y: 1 } } },
  }
  const { syncUnitAppearanceLayers } = loadModule('app/classes/unit/UnitAppearanceLayers.ts', {
    'pixi.js': {
      Assets: {
        cache: {
          has: id => id === 'hair/walking',
          get: id => (id === 'hair/walking' ? spritesheet : undefined),
        },
      },
      AnimatedSprite,
    },
    '../../constants': constants,
    '../../lib': {
      bindAnimatedSpriteToTicker: () => {},
      changeSpriteColor: () => {},
      changeSpritePalette: () => {},
      getSpriteFrameSelection: textures => ({ textures: Object.values(textures), mirrored: false }),
    },
    '../../lib/lpc/appearanceLayers': { getAppearanceAgeSheetOverride: () => undefined, getAppearanceLayerZIndex: ({ layer }) => layer.zIndex },
    '../../lib/lpc/equipment': { civilizationKey: civ => String(civ || '').toLowerCase() },
    '../../lib/units/unitExperience': { getUnitEquipmentLevel: () => 0 },
  })
  const unit = {
    appearance: {
      layers: [{ zIndex: 11, hideWhenEquippedSlots: ['helmet'], walkingSheet: 'hair/walking' }],
    },
    appearanceLayerSprites: new Map(),
    inventory: { equipped: {} },
    owner: { civ: 'Greek', color: 'blue' },
    sprite: { currentFrame: 0, loop: true, playing: false },
    context: { app: {} },
    degree: 180,
    currentSheet: constants.SHEET_TYPES.walking,
    sheetDirectionCounts: {},
    sheetDirectionOrders: {},
    getMountedRiderX: () => 0,
    getMountedRiderY: () => 0,
    getChildIndex: () => 0,
    addChildAt(sprite) { sprite.parent = this },
    addChild(sprite) { sprite.parent = this },
    removeChild(sprite) { sprite.parent = null },
  }

  syncUnitAppearanceLayers(unit, constants.SHEET_TYPES.walking)
  assert.equal(unit.appearanceLayerSprites.size, 1)

  unit.inventory.equipped.helmet = 'helmet_barbuta_ceramic'
  syncUnitAppearanceLayers(unit, constants.SHEET_TYPES.walking)
  assert.equal(unit.appearanceLayerSprites.size, 0)

  delete unit.inventory.equipped.helmet
  syncUnitAppearanceLayers(unit, constants.SHEET_TYPES.walking)
  assert.equal(unit.appearanceLayerSprites.size, 1)
})

test('appearance layers inherit the unit action frame sequence', () => {
  class AnimatedSprite {
    constructor(textures) {
      this.textures = textures
      this.label = ''
      this.eventMode = 'none'
      this.position = { x: 0, y: 0 }
      this.scale = { x: 1, y: 1 }
      this.anchor = { set: () => {} }
      this.roundPixels = false
      this.loop = true
      this.updateAnchor = false
      this.zIndex = 0
      this.visible = true
      this.parent = null
      this.playing = false
      this.currentFrame = 0
      this.filters = null
    }
    destroy() {}
    gotoAndStop(frame) { this.currentFrame = frame }
    gotoAndPlay(frame) { this.currentFrame = frame; this.playing = true }
  }
  const spritesheet = {
    data: { animationSpeed: 0.25 },
    textures: Object.fromEntries(Array.from({ length: 6 }, (_, index) => [`00${index}.png`, { id: index }])),
  }
  const { syncUnitAppearanceLayers } = loadModule('app/classes/unit/UnitAppearanceLayers.ts', {
    'pixi.js': {
      Assets: {
        cache: {
          has: id => id === 'hammer/action',
          get: id => (id === 'hammer/action' ? spritesheet : undefined),
        },
      },
      AnimatedSprite,
    },
    '../../constants': constants,
    '../../lib': {
      bindAnimatedSpriteToTicker: () => {},
      changeSpriteColor: () => {},
      changeSpritePalette: () => {},
      getSpriteFrameSelection: textures => ({ textures: Object.values(textures), mirrored: false }),
    },
    '../../lib/lpc/appearanceLayers': { getAppearanceAgeSheetOverride: () => undefined, getAppearanceLayerZIndex: ({ layer }) => layer.zIndex },
    '../../lib/lpc/equipment': { civilizationKey: civ => String(civ || '').toLowerCase() },
    '../../lib/lpc/lazyEquipmentAssets': { loadDynamicEquipmentAssetQueued: () => Promise.resolve() },
    '../../lib/units/unitExperience': { getUnitEquipmentLevel: () => 0 },
  })
  const unit = {
    actionFrameSequence: [5, 5, 4, 4, 1, 0, 0, 0, 0],
    appearance: { layers: [{ zIndex: 12, actionSheet: 'hammer/action' }] },
    appearanceLayerSprites: new Map(),
    context: { app: {}, map: { ready: true } },
    degree: 180,
    currentSheet: constants.SHEET_TYPES.action,
    sheetDirectionCounts: {},
    sheetDirectionOrders: {},
    sprite: { currentFrame: 3, loop: true, playing: false },
    type: constants.UNIT_TYPES.villager,
    work: constants.WORK_TYPES.builder,
    owner: { civ: 'Greek', color: 'blue' },
    getMountedRiderX: () => 0,
    getMountedRiderY: () => 0,
    getChildIndex: () => 0,
    addChildAt(sprite) { sprite.parent = this },
    addChild(sprite) { sprite.parent = this },
  }

  syncUnitAppearanceLayers(unit, constants.SHEET_TYPES.action)
  assert.equal(unit.sprite.currentFrame, 3)
  assert.equal(unit.appearanceLayerSprites.get(0).currentFrame, 3)
  assert.deepEqual(
    unit.appearanceLayerSprites.get(0).textures.map(texture => texture.id),
    [5, 5, 4, 4, 1, 0, 0, 0, 0]
  )

  unit.sprite.currentFrame = 8
  syncUnitAppearanceLayers(unit, constants.SHEET_TYPES.action)
  assert.equal(unit.appearanceLayerSprites.get(0).currentFrame, 8)
})

test('appearance layers stay frame-locked to the unit sprite', () => {
  class AnimatedSprite {
    constructor(textures) {
      this.textures = textures
      this.label = ''
      this.eventMode = 'none'
      this.position = { x: 0, y: 0 }
      this.scale = { x: 1, y: 1 }
      this.anchor = { set: () => {} }
      this.roundPixels = false
      this.loop = true
      this.updateAnchor = false
      this.zIndex = 0
      this.visible = true
      this.parent = null
      this.playing = false
      this.currentFrame = 0
      this.filters = null
    }
    destroy() {}
    gotoAndStop(frame) { this.currentFrame = frame; this.playing = false }
    gotoAndPlay(frame) { this.currentFrame = frame; this.playing = true }
  }
  const spritesheet = {
    data: { animationSpeed: 0.1 },
    textures: Object.fromEntries(Array.from({ length: 6 }, (_, index) => [`00${index}.png`, { id: index }])),
  }
  const { syncUnitAppearanceLayers } = loadModule('app/classes/unit/UnitAppearanceLayers.ts', {
    'pixi.js': {
      Assets: {
        cache: {
          has: id => id === 'hair/action',
          get: id => (id === 'hair/action' ? spritesheet : undefined),
        },
      },
      AnimatedSprite,
    },
    '../../constants': constants,
    '../../lib': {
      bindAnimatedSpriteToTicker: () => {},
      changeSpriteColor: () => {},
      changeSpritePalette: () => {},
      getSpriteFrameSelection: textures => ({ textures: Object.values(textures), mirrored: false }),
    },
    '../../lib/lpc/appearanceLayers': {
      getAppearanceAgeSheetOverride: () => undefined,
      getAppearanceLayerZIndex: ({ layer }) => layer.zIndex,
    },
    '../../lib/lpc/equipment': { civilizationKey: civ => String(civ || '').toLowerCase() },
    '../../lib/lpc/lazyEquipmentAssets': { loadDynamicEquipmentAssetQueued: () => Promise.resolve() },
    '../../lib/units/unitExperience': { getUnitEquipmentLevel: () => 0 },
  })
  const unit = {
    action: constants.ACTION_TYPES.attack,
    appearance: { layers: [{ zIndex: 11, actionSheet: 'hair/action' }] },
    appearanceLayerSprites: new Map(),
    context: { app: {}, map: { ready: true } },
    degree: 180,
    currentSheet: constants.SHEET_TYPES.action,
    sheetDirectionCounts: {},
    sheetDirectionOrders: {},
    sprite: { currentFrame: 2, loop: true, playing: true, animationSpeed: 0.25 },
    type: constants.UNIT_TYPES.villager,
    work: constants.WORK_TYPES.attacker,
    owner: { civ: 'Greek', color: 'blue' },
    getMountedRiderX: () => 0,
    getMountedRiderY: () => 0,
    getChildIndex: () => 0,
    addChildAt(sprite) { sprite.parent = this },
    addChild(sprite) { sprite.parent = this },
  }

  syncUnitAppearanceLayers(unit, constants.SHEET_TYPES.action)
  const hair = unit.appearanceLayerSprites.get(0)
  assert.equal(hair.animationSpeed, 0.25)
  assert.equal(hair.currentFrame, 2)

  hair.currentFrame = 4
  unit.sprite.currentFrame = 1
  hair.onFrameChange(4)
  assert.equal(hair.currentFrame, 1)
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
    'centurion_crest',
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
    'centurion_crest',
  ])
  assert.equal(dynamicEquipmentForUnit('Fantassin', 2, 20, 'Roman').includes('helmet_legion_bronze'), true)
  assert.equal(dynamicEquipmentForUnit('Fantassin', 2, 20, 'Roman').includes('centurion_plumage'), true)
  assert.equal(dynamicEquipmentForUnit('Fantassin', 2, 20, 'Babylonian').includes('helmet_nasal_bronze'), true)
  assert.equal(dynamicEquipmentForUnit('Fantassin', 2, 20, 'Babylonian').includes('legion_plumage'), true)
  assert.equal(dynamicEquipmentForUnit('Fantassin', 2, 20, 'Egyptian').includes('helmet_bascinet_round_bronze'), true)
  assert.equal(dynamicEquipmentForUnit('Fantassin', 2, 20, 'Asian').includes('plumage'), true)
  assert.equal(dynamicEquipmentForUnit('Fantassin', 2, 20, 'Celtic').includes('helmet_wings'), true)
  assert.equal(dynamicEquipmentForUnit('Fantassin', 2, 20, 'Nordic').includes('helmet_norman_bronze'), true)
  assert.equal(dynamicEquipmentForUnit('Fantassin', 2, 20, 'Nordic').includes('upward_horns_white'), true)
  assert.equal(dynamicEquipmentForUnit('Fantassin', 2, 20, 'Viking').includes('upward_horns_white'), true)
  assert.equal(dynamicEquipmentForUnit('Fantassin', 2, 20, 'Nubian').includes('helmet_nasal_bronze'), true)

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
  assert.equal(crest, undefined)
  assert.equal(centurionCrest?.minLevel, 16)
  assert.equal(centurionCrest?.maxLevel, undefined)
  assert.equal(centurionCrest?.palette, 'player')
  assert.equal(centurionCrest?.mountedSheet, 'lpc-equipment/centurion_crest/front/walking')
  assert.equal(centurionPlumage, undefined)
  const nordicLayers = dynamicEquipmentLayersForUnit('Fantassin', 'Nordic')
  const nordicHorns = nordicLayers.find(
    layer => layer.walkingSheet === 'lpc-equipment/upward_horns_white/front/walking'
  )
  assert.equal(nordicHorns?.minLevel, 16)
  assert.equal(nordicHorns?.palette, undefined)
  assert.equal(nordicHorns?.mountedSheet, 'lpc-equipment/upward_horns_white/front/walking')
  const vikingLayers = dynamicEquipmentLayersForUnit('Fantassin', 'Viking')
  assert.equal(
    vikingLayers.some(layer => layer.walkingSheet === 'lpc-equipment/upward_horns_white/front/walking'),
    true
  )
})

test('archer equipment follows soldier armor progression without shield', () => {
  const { dynamicEquipmentAssets, dynamicEquipmentForUnit, dynamicEquipmentLayersForUnit } = loadModule(
    'app/lib/lpc/equipment.ts',
    {
      '../../constants': constants,
    }
  )

  assert.deepEqual(dynamicEquipmentForUnit('Bowman', 0, 0), ['quiver', 'bow', 'arrow_ceramic'])
  assert.deepEqual(dynamicEquipmentForUnit('Bowman', 1, 0), ['quiver', 'bow_great', 'arrow_copper'])
  assert.deepEqual(dynamicEquipmentForUnit('Bowman', 2, 0), ['quiver', 'bow_recurve', 'arrow_bronze'])
  assert.deepEqual(dynamicEquipmentForUnit('Bowman', 2, 15), [
    'quiver',
    'bow_recurve',
    'arrow_bronze',
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
    'arrow_iron',
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
  const arrow = layers.find(layer => layer.actionSheet === 'lpc-equipment/arrow_ceramic/front/action')
  const quiver = layers.find(layer => layer.walkingSheet === 'lpc-equipment/quiver/back/walking')
  const mail = layers.find(layer => layer.walkingSheet === 'lpc-equipment/armor_mail_ceramic/front/walking')
  const shield = layers.find(layer => layer.walkingSheet === 'lpc-equipment/round_shield_ceramic_slash/front/walking')
  assert.equal(bow?.ageSheetOverrides?.['1']?.walkingSheet, 'lpc-equipment/bow_great/front/walking')
  assert.equal(bow?.ageSheetOverrides?.['2']?.actionSheet, 'lpc-equipment/bow_recurve/front/action')
  assert.equal(bow?.shootingSheet, 'lpc-equipment/bow/front/action')
  assert.equal(bow?.ageSheetOverrides?.['1']?.shootingSheet, 'lpc-equipment/bow_great/front/action')
  assert.equal(bow?.ageSheetOverrides?.['2']?.shootingSheet, 'lpc-equipment/bow_recurve/front/action')
  assert.equal(bow?.mountedCut, false)
  assert.equal(arrow?.walkingSheet, undefined)
  assert.equal(arrow?.shootingSheet, 'lpc-equipment/arrow_ceramic/front/action')
  assert.equal(arrow?.ageSheetOverrides?.['1']?.actionSheet, 'lpc-equipment/arrow_copper/front/action')
  assert.equal(arrow?.ageSheetOverrides?.['1']?.shootingSheet, 'lpc-equipment/arrow_copper/front/action')
  assert.equal(arrow?.ageSheetOverrides?.['2']?.actionSheet, 'lpc-equipment/arrow_bronze/front/action')
  assert.equal(arrow?.ageSheetOverrides?.['2']?.shootingSheet, 'lpc-equipment/arrow_bronze/front/action')
  assert.equal(arrow?.ageSheetOverrides?.['3']?.actionSheet, 'lpc-equipment/arrow_iron/front/action')
  assert.equal(arrow?.ageSheetOverrides?.['3']?.shootingSheet, 'lpc-equipment/arrow_iron/front/action')
  assert.equal(arrow?.mountedCut, false)
  assert.equal(arrow?.hideOnOrAfterFrame, 9)
  assert.equal(quiver?.shootingSheet, 'lpc-equipment/quiver/back/action')
  assert.equal(quiver?.mountedCut, false)
  assert.equal(mail?.minLevel, 10)
  assert.equal(mail?.mountedCut, undefined)
  assert.equal(mail?.ageSheetOverrides?.['2']?.walkingSheet, 'lpc-equipment/armor_mail_bronze/front/walking')
  assert.equal(mail?.ageSheetOverrides?.['3']?.walkingSheet, 'lpc-equipment/armor_mail_iron/front/walking')
  assert.equal(shield, undefined)

  const arrowAssets = dynamicEquipmentAssets().filter(asset => asset.alias.includes('/weapon/arrow'))
  assert.deepEqual(arrowAssets.map(asset => asset.alias).sort(), [
    'lpc-equipment/weapon/arrow',
  ])
})

test('bandit units use fixed runtime equipment loadouts', () => {
  const { dynamicEquipmentForUnit, dynamicEquipmentLayersForUnit } = loadModule('app/lib/lpc/equipment.ts', {
    '../../constants': constants,
  })

  assert.deepEqual(dynamicEquipmentForUnit('BanditChief'), [
    'axe_ceramic',
    'armor_leather',
    'cape_solid',
    'helmet_barbarian_ceramic',
    'upward_horns_ceramic',
    'round_shield_ceramic_slash',
  ])
  assert.deepEqual(dynamicEquipmentForUnit('BanditSword'), [
    'sword_ceramic',
    'helmet_barbarian_nasal_ceramic',
    'round_shield_ceramic_slash',
  ])
  assert.deepEqual(dynamicEquipmentForUnit('BanditArcher'), [
    'quiver',
    'bow',
    'arrow_ceramic',
    'sack_cloth_hood_leather',
  ])

  const chiefLayers = dynamicEquipmentLayersForUnit('BanditChief')
  const hornFront = chiefLayers.find(layer => layer.walkingSheet === 'lpc-equipment/upward_horns_ceramic/front/walking')
  const helmet = chiefLayers.find(
    layer => layer.walkingSheet === 'lpc-equipment/helmet_barbarian_ceramic/front/walking'
  )
  const capeFront = chiefLayers.find(layer => layer.walkingSheet === 'lpc-equipment/cape_solid/front/walking')
  const shield = chiefLayers.find(
    layer => layer.walkingSheet === 'lpc-equipment/round_shield_ceramic_slash/front/walking'
  )
  assert.equal(hornFront?.mountedSheet, 'lpc-equipment/upward_horns_ceramic/front/walking')
  assert.equal(hornFront?.shootingSheet, 'lpc-equipment/upward_horns_ceramic/front/shooting')
  assert.equal(hornFront?.dyingSheet, 'lpc-equipment/upward_horns_ceramic/front/dying')
  assert.equal(hornFront?.corpseSheet, 'lpc-equipment/upward_horns_ceramic/front/corpse')
  assert.equal(helmet?.zIndex, 11)
  assert.equal(helmet?.dyingSheet, 'lpc-equipment/helmet_barbarian_ceramic/front/dying')
  assert.equal(helmet?.corpseSheet, 'lpc-equipment/helmet_barbarian_ceramic/front/corpse')
  assert.equal(capeFront?.zIndex, 12)
  assert.equal(capeFront?.palette, 'player')
  assert.equal(capeFront?.shootingSheet, 'lpc-equipment/cape_solid/front/shooting')
  assert.equal(capeFront?.dyingSheet, 'lpc-equipment/cape_solid/front/dying')
  assert.equal(capeFront?.corpseSheet, 'lpc-equipment/cape_solid/front/corpse')
  assert.equal(shield?.dyingSheet, undefined)
  assert.equal(shield?.corpseSheet, undefined)

  const swordLayers = dynamicEquipmentLayersForUnit('BanditSword')
  const sword = swordLayers.find(layer => layer.walkingSheet === 'lpc-equipment/sword_ceramic/front/walking')
  assert.equal(sword?.dyingSheet, 'lpc-equipment/sword_ceramic/front/dying')
  assert.equal(sword?.corpseSheet, 'lpc-equipment/sword_ceramic/front/corpse')

  const archerLayers = dynamicEquipmentLayersForUnit('BanditArcher')
  const hood = archerLayers.find(layer => layer.walkingSheet === 'lpc-equipment/sack_cloth_hood_leather/front/walking')
  const arrow = archerLayers.find(layer => layer.actionSheet === 'lpc-equipment/arrow_ceramic/front/action')
  assert.equal(hood?.actionSheet, 'lpc-equipment/sack_cloth_hood_leather/front/action')
  assert.equal(hood?.dyingSheet, 'lpc-equipment/sack_cloth_hood_leather/front/dying')
  assert.equal(hood?.corpseSheet, 'lpc-equipment/sack_cloth_hood_leather/front/corpse')
  assert.equal(hood?.zIndex, 11)
  assert.equal(arrow?.hideOnOrAfterFrame, 9)
})

test('unique bandit baked units do not include civilization in asset paths', () => {
  const cachedAliases = new Set(['lpc-baked/bandit_archer/male/walking'])
  const { applyBakedLpcUnitAssets, getBakedUnitStandingSheetAlias } = loadModule('app/lib/lpc/baked.ts', {
    './appearance': { hashLpcAppearanceSeed: () => 0 },
    './heroAppearance': heroAppearanceMock,
    './equipment': {
      dynamicEquipmentAssets: () => [],
      dynamicEquipmentLayersForEquipment: () => [],
      dynamicEquipmentLayersForUnit: type => [{ unitType: type }],
      dynamicEquipmentLayersForVillager: () => [],
    },
    '../chief': { isChiefUnit: () => false },
    '../units/unitExperience': { getUnitEquipmentLevel: () => 0 },
    '../../constants': constants,
    'pixi.js': { Assets: { cache: { has: alias => cachedAliases.has(alias) }, load: async () => {} } },
  })
  const owner = { civ: 'Egyptian', label: 'P1', gender: 'female' }
  const unit = {
    type: 'BanditArcher',
    owner,
    label: 'bandit',
    i: 1,
    j: 1,
  }

  assert.equal(getBakedUnitStandingSheetAlias('BanditArcher', owner), 'lpc-baked/bandit_archer/male/walking')
  assert.equal(applyBakedLpcUnitAssets(unit), true)
  assert.equal(unit.assets.walkingSheet, 'lpc-baked/bandit_archer/male/walking')
  assert.equal(unit.assets.actionSheet, 'lpc-baked/bandit_archer/male/action')
  assert.deepEqual(unit.appearanceVariants, { gender: 'male' })
  assert.deepEqual(unit.appearance.layers, [{ unitType: 'BanditArcher' }])
})

test('helmeted infantry swaps to no-hair baked base', () => {
  const cachedAliases = new Set([
    'lpc-baked/infantry/greek/male/walking',
    'lpc-baked/infantry_nohair/greek/male/walking',
  ])
  const { applyBakedLpcUnitAssets } = loadModule('app/lib/lpc/baked.ts', {
    './appearance': { hashLpcAppearanceSeed: () => 0 },
    './heroAppearance': heroAppearanceMock,
    './equipment': {
      dynamicEquipmentAssets: () => [],
      dynamicEquipmentLayersForEquipment: () => [],
      dynamicEquipmentLayersForUnit: () => [],
      dynamicEquipmentLayersForVillager: () => [],
    },
    '../chief': { isChiefUnit: () => false },
    '../units/unitExperience': { getUnitEquipmentLevel: unit => unit.level ?? 0 },
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
    './heroAppearance': heroAppearanceMock,
    './equipment': {
      dynamicEquipmentAssets: () => [],
      dynamicEquipmentLayersForEquipment: () => [],
      dynamicEquipmentLayersForUnit: () => [],
      dynamicEquipmentLayersForVillager: () => [],
    },
    '../chief': { isChiefUnit: () => false },
    '../units/unitExperience': { getUnitEquipmentLevel: unit => unit.level ?? 0 },
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

test('looted corpse swaps back to hair baked base when helmet is removed', () => {
  const cachedAliases = new Set([
    'lpc-baked/infantry/greek/male/walking',
    'lpc-baked/infantry_nohair/greek/male/walking',
  ])
  const { applyBakedLpcUnitAssets } = loadModule('app/lib/lpc/baked.ts', {
    './appearance': { hashLpcAppearanceSeed: () => 0 },
    './heroAppearance': heroAppearanceMock,
    './equipment': {
      dynamicEquipmentAssets: () => [],
      dynamicEquipmentLayersForEquipment: equipment => equipment.map(item => ({ equipmentKey: item })),
      dynamicEquipmentLayersForUnit: () => [],
      dynamicEquipmentLayersForVillager: () => [],
    },
    '../chief': { isChiefUnit: () => false },
    '../units/unitExperience': { getUnitEquipmentLevel: unit => unit.level ?? 0 },
    '../../constants': constants,
    'pixi.js': { Assets: { cache: { has: alias => cachedAliases.has(alias) }, load: async () => {} } },
  })
  const corpse = {
    type: 'Fantassin',
    owner: { civ: 'Greek', label: 'P1' },
    label: 'unit',
    i: 1,
    j: 1,
    isDead: true,
    level: 6,
    lootEquipment: ['sword_ceramic', 'helmet_pointed_ceramic'],
  }

  assert.equal(applyBakedLpcUnitAssets(corpse), true)
  assert.equal(corpse.assets.walkingSheet, 'lpc-baked/infantry_nohair/greek/male/walking')
  assert.ok(corpse.appearance.layers.some(layer => layer.equipmentKey === 'helmet_pointed_ceramic'))

  corpse.lootEquipment = ['sword_ceramic']
  assert.equal(applyBakedLpcUnitAssets(corpse), true)
  assert.equal(corpse.assets.walkingSheet, 'lpc-baked/infantry/greek/male/walking')
  assert.equal(corpse.appearance.layers.some(layer => layer.equipmentKey === 'helmet_pointed_ceramic'), false)
})
