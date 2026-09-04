const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

const constants = {
  ACTION_TYPES: {
    attack: 'attack',
    hunt: 'hunt',
    takemeat: 'takemeat',
  },
  LABEL_TYPES: {
    sprite: 'sprite',
  },
  SHEET_TYPES: {
    action: 'actionSheet',
    corpse: 'corpseSheet',
    dying: 'dyingSheet',
    harvest: 'harvestSheet',
    standing: 'standingSheet',
    walking: 'walkingSheet',
  },
  UNIT_TYPES: {
    banditArcher: 'BanditArcher',
    banditChief: 'BanditChief',
    banditSword: 'BanditSword',
    bowman: 'Bowman',
    chief: 'Chief',
    hero: 'Hero',
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

test('LPC slash speed maps to the recovery frame delay', () => {
  const { lpcSlashFrameMs } = loadTsModule('app/lib/lpc/animationSpeeds.ts')

  assert.equal(lpcSlashFrameMs(), 67)
})

test('hero hair slash aliases use the same speed as the hero body slash', () => {
  const cache = new Map()
  const atlasAlias = 'hero/hair/page2/male'
  cache.set(atlasAlias, {
    data: {
      frames: {
        '000_graphics_hero_hair_page2_male_front_action_slash.png': {},
        '000_graphics_hero_hair_page2_male_front_action_shoot.png': {},
        '000_graphics_hero_hair_page2_male_front_corpse.png': {},
      },
    },
    textures: {
      '000_graphics_hero_hair_page2_male_front_action_slash.png': {},
      '000_graphics_hero_hair_page2_male_front_action_shoot.png': {},
      '000_graphics_hero_hair_page2_male_front_corpse.png': {},
    },
  })

  const { registerHeroAppearanceAliasesForPlayers } = loadTsModule('app/lib/lpc/heroAppearance.ts', {
    mocks: {
      'pixi.js': {
        Assets: {
          cache: {
            get: key => cache.get(key),
            has: key => cache.has(key),
            set: (key, value) => cache.set(key, value),
          },
        },
      },
    },
  })

  registerHeroAppearanceAliasesForPlayers([
    { civ: 'Hellas', gender: 'male', heroAppearance: { hairStyle: 'page2', hairColor: 'dark_brown' } },
  ])

  assert.equal(cache.get('hero/hair/page2/male/front/action/slash').data.animationSpeed, 0.25)
  assert.equal(cache.get('hero/hair/page2/male/front/action/shoot').data.animationSpeed, 0.3)
  assert.equal(cache.get('hero/hair/page2/male/front/corpse').data.animationSpeed, 0)
})

test('dynamic equipment action sheets stay in sync with slash body sheets', () => {
  const { dynamicEquipmentAliases } = loadTsModule('app/lib/lpc/equipment.ts', {
    mocks: {
      '../../constants': constants,
    },
  })
  const aliases = dynamicEquipmentAliases()
  const pickaxeAction = aliases.find(alias => alias.alias === 'equipments/pickaxe_ceramic/front/action/male')
  const bowAction = aliases.find(alias => alias.alias === 'equipments/bow/front/action')
  const corpse = aliases.find(alias => alias.alias.endsWith('/corpse'))

  assert.equal(pickaxeAction?.animationSpeed, 0.25)
  assert.equal(bowAction?.animationSpeed, 0.3)
  assert.equal(corpse?.animationSpeed, 0)
})

test('appearance layers use harvest art for taking meat instead of hunter shooting art', () => {
  class AnimatedSprite {
    constructor(textures) {
      this.textures = textures
      this.anchor = { set: () => {} }
      this.currentFrame = 0
      this.eventMode = 'none'
      this.label = ''
      this.loop = true
      this.playing = false
      this.position = { x: 0, y: 0 }
      this.scale = { x: 1, y: 1 }
      this.visible = true
      this.zIndex = 0
    }
    destroy() {}
    gotoAndPlay(frame) {
      this.currentFrame = frame
      this.playing = true
    }
    gotoAndStop(frame) {
      this.currentFrame = frame
      this.playing = false
    }
  }

  const sheets = new Map([
    ['hair/action', { data: { animationSpeed: 0.25 }, textures: { frame: { id: 'action' } } }],
    ['hair/harvest', { data: { animationSpeed: 0.25 }, textures: { frame: { id: 'harvest' } } }],
    ['hair/shooting', { data: { animationSpeed: 0.3 }, textures: { frame: { id: 'shooting' } } }],
  ])

  const { syncUnitAppearanceLayers } = loadTsModule('app/classes/unit/UnitAppearanceLayers.ts', {
    mocks: {
      '../../constants': constants,
      '../constants': constants,
      'pixi.js': {
        Assets: {
          cache: {
            get: key => sheets.get(key),
            has: key => sheets.has(key),
          },
        },
        AnimatedSprite,
      },
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
      '../../lib/units/unitExperience': { getUnitEquipmentLevel: () => 0 },
    },
  })

  const unit = {
    action: constants.ACTION_TYPES.takemeat,
    appearance: {
      layers: [
        {
          zIndex: 11,
          actionSheet: 'hair/action',
          harvestSheet: 'hair/harvest',
          shootingSheet: 'hair/shooting',
        },
      ],
    },
    appearanceLayerSprites: new Map(),
    context: { app: {} },
    degree: 180,
    getChildIndex: () => 0,
    getMountedRiderX: () => 0,
    getMountedRiderY: () => 0,
    inventory: { equipped: {} },
    owner: { civ: 'Hellas', color: 'blue' },
    sheetDirectionCounts: {},
    sheetDirectionOrders: {},
    sprite: { currentFrame: 0, loop: true, playing: false },
    type: constants.UNIT_TYPES.hero,
    work: constants.WORK_TYPES.hunter,
    addChild(sprite) {
      sprite.parent = this
    },
    addChildAt(sprite) {
      sprite.parent = this
    },
  }

  syncUnitAppearanceLayers(unit, constants.SHEET_TYPES.action)

  const hair = unit.appearanceLayerSprites.get(0)
  assert.equal(hair.textures[0].id, 'harvest')
  assert.equal(hair.animationSpeed, 0.25)
})

test('appearance layers use shooting art for hero bow charge even without a hunt action', () => {
  class AnimatedSprite {
    constructor(textures) {
      this.textures = textures
      this.anchor = { set: () => {} }
      this.currentFrame = 0
      this.eventMode = 'none'
      this.label = ''
      this.loop = true
      this.playing = false
      this.position = { x: 0, y: 0 }
      this.scale = { x: 1, y: 1 }
      this.visible = true
      this.zIndex = 0
    }
    destroy() {}
    gotoAndPlay(frame) {
      this.currentFrame = frame
      this.playing = true
    }
    gotoAndStop(frame) {
      this.currentFrame = frame
      this.playing = false
    }
  }

  const sheets = new Map([
    ['hair/action', { data: { animationSpeed: 0.25 }, textures: { frame: { id: 'action' } } }],
    ['hair/shooting', { data: { animationSpeed: 0.3 }, textures: { frame: { id: 'shooting' } } }],
  ])

  const { syncUnitAppearanceLayers } = loadTsModule('app/classes/unit/UnitAppearanceLayers.ts', {
    mocks: {
      '../../constants': constants,
      '../constants': constants,
      'pixi.js': {
        Assets: {
          cache: {
            get: key => sheets.get(key),
            has: key => sheets.has(key),
          },
        },
        AnimatedSprite,
      },
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
      '../../lib/units/unitExperience': { getUnitEquipmentLevel: () => 0 },
    },
  })

  const unit = {
    action: null,
    appearance: {
      layers: [{ zIndex: 11, actionSheet: 'hair/action', shootingSheet: 'hair/shooting' }],
    },
    appearanceLayerSprites: new Map(),
    context: { app: {} },
    degree: 180,
    getChildIndex: () => 0,
    getMountedRiderX: () => 0,
    getMountedRiderY: () => 0,
    inventory: { equipped: {} },
    owner: { civ: 'Hellas', color: 'blue' },
    sheetDirectionCounts: {},
    sheetDirectionOrders: {},
    sprite: { currentFrame: 0, loop: true, playing: false },
    type: constants.UNIT_TYPES.hero,
    work: constants.WORK_TYPES.hunter,
    addChild(sprite) {
      sprite.parent = this
    },
    addChildAt(sprite) {
      sprite.parent = this
    },
  }

  syncUnitAppearanceLayers(unit, constants.SHEET_TYPES.action)

  const hair = unit.appearanceLayerSprites.get(0)
  assert.equal(hair.textures[0].id, 'shooting')
  assert.equal(hair.animationSpeed, 0.3)
})
