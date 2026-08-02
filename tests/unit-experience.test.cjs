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
  FAMILY_TYPES: {
    building: 'building',
    unit: 'unit',
  },
  LOADING_TYPES: {
    berry: 'berry',
    fish: 'fish',
    gold: 'gold',
    meat: 'meat',
    stone: 'stone',
    wheat: 'wheat',
    wood: 'wood',
  },
  WORK_TYPES: {
    attacker: 'attacker',
    builder: 'builder',
    farmer: 'farmer',
    fisher: 'fisher',
    forager: 'forager',
    goldminer: 'goldminer',
    healer: 'healer',
    hunter: 'hunter',
    stoneminer: 'stoneminer',
    woodcutter: 'woodcutter',
  },
}

function loadExperience(feedbackCalls = []) {
  return loadModule('app/lib/unitExperience.ts', {
    '../constants': constants,
    './combatFeedback': {
      showLevelUpFeedback: (target, text) => feedbackCalls.push({ target, text }),
    },
    './lang': { t: key => key },
  })
}

function makeUnit(extra = {}) {
  return {
    family: constants.FAMILY_TYPES.unit,
    experience: {},
    ...extra,
  }
}

test('xp thresholds follow the 25·L·(L+1) curve and clamp at the max level', () => {
  const { getXpForLevel, XP_MAX_LEVEL } = loadExperience()

  assert.equal(getXpForLevel(0), 0)
  assert.equal(getXpForLevel(1), 50)
  assert.equal(getXpForLevel(2), 150)
  assert.equal(getXpForLevel(3), 300)
  assert.equal(getXpForLevel(XP_MAX_LEVEL), 25 * XP_MAX_LEVEL * (XP_MAX_LEVEL + 1))
  assert.equal(getXpForLevel(999), getXpForLevel(XP_MAX_LEVEL))
})

test('levels derive from accumulated xp with a hard cap', () => {
  const { getUnitLevel, XP_MAX_LEVEL } = loadExperience()
  const unit = makeUnit()

  unit.experience.mining = 49
  assert.equal(getUnitLevel(unit, 'mining'), 0)
  unit.experience.mining = 50
  assert.equal(getUnitLevel(unit, 'mining'), 1)
  unit.experience.mining = 149
  assert.equal(getUnitLevel(unit, 'mining'), 1)
  unit.experience.mining = 150
  assert.equal(getUnitLevel(unit, 'mining'), 2)
  unit.experience.mining = 1_000_000
  assert.equal(getUnitLevel(unit, 'mining'), XP_MAX_LEVEL)
})

test('grantUnitXp accumulates per category and ignores invalid grants', () => {
  const { grantUnitXp } = loadExperience()
  const unit = makeUnit()

  grantUnitXp(unit, 'melee', 30)
  grantUnitXp(unit, 'mining', 50)
  grantUnitXp(unit, 'melee', 5)
  assert.deepEqual(unit.experience, { melee: 35, mining: 50 })

  grantUnitXp(unit, 'melee', 0)
  grantUnitXp(unit, 'melee', -10)
  grantUnitXp(unit, null, 10)
  assert.deepEqual(unit.experience, { melee: 35, mining: 50 })

  const deadUnit = makeUnit({ isDead: true })
  grantUnitXp(deadUnit, 'melee', 10)
  assert.deepEqual(deadUnit.experience, {})

  const tower = makeUnit({ family: constants.FAMILY_TYPES.building })
  grantUnitXp(tower, 'ranged', 10)
  assert.deepEqual(tower.experience, {})
})

test('a unit without an experience record still receives xp', () => {
  const { grantUnitXp } = loadExperience()
  const unit = makeUnit({ experience: undefined })

  grantUnitXp(unit, 'hunting', 12)
  assert.deepEqual(unit.experience, { hunting: 12 })
})

test('level-up shows gold feedback and refreshes the selected unit panel', () => {
  const feedbackCalls = []
  const { grantUnitXp } = loadExperience(feedbackCalls)
  const infoUpdates = []
  const editorPanelUpdates = []
  const unit = makeUnit({ selected: true })
  const menu = {
    setActionTarget: selection => editorPanelUpdates.push(selection),
    updateInfo: (id, value) => infoUpdates.push({ id, value }),
  }
  unit.owner = { isPlayed: true, selectedUnit: unit }
  unit.context = { menu }

  grantUnitXp(unit, 'mining', 49)
  assert.deepEqual(feedbackCalls, [])
  assert.deepEqual(editorPanelUpdates, [])
  assert.deepEqual(infoUpdates, [{ id: 'xp-mining-text', value: '0 (49/50)' }])

  grantUnitXp(unit, 'mining', 1)
  assert.equal(feedbackCalls.length, 1)
  assert.equal(feedbackCalls[0].target, unit)
  assert.equal(feedbackCalls[0].text, 'levelShort 1')
  assert.deepEqual(editorPanelUpdates, [unit])
  assert.equal(infoUpdates.length, 1)
})

test('level-up feedback still fires when the unit is not selected', () => {
  const feedbackCalls = []
  const { grantUnitXp } = loadExperience(feedbackCalls)
  const unit = makeUnit()

  grantUnitXp(unit, 'melee', 50)
  assert.equal(feedbackCalls.length, 1)
})

test('gather bonus follows the category of the current work', () => {
  const { getGatherXpBonus, getXpForLevel } = loadExperience()
  const unit = makeUnit({ work: constants.WORK_TYPES.stoneminer })

  assert.equal(getGatherXpBonus(unit), 0)
  unit.experience.mining = getXpForLevel(3)
  assert.equal(getGatherXpBonus(unit), 1)
  unit.experience.mining = getXpForLevel(6)
  assert.equal(getGatherXpBonus(unit), 2)

  // stone and gold mining share the same skill bucket
  unit.work = constants.WORK_TYPES.goldminer
  assert.equal(getGatherXpBonus(unit), 2)

  unit.work = null
  assert.equal(getGatherXpBonus(unit), 0)
})

test('combat, healing and build bonuses scale with the category level', () => {
  const { getBuildRateXpMultiplier, getCombatXpBonus, getHealingXpBonus, getXpForLevel } = loadExperience()
  const unit = makeUnit()

  assert.equal(getCombatXpBonus(unit, 'melee'), 0)
  unit.experience.melee = getXpForLevel(4)
  assert.equal(getCombatXpBonus(unit, 'melee'), 2)
  assert.equal(getCombatXpBonus(unit, 'ranged'), 0)

  unit.experience.healing = getXpForLevel(2)
  assert.equal(getHealingXpBonus(unit), 1)

  assert.equal(getBuildRateXpMultiplier(unit), 1)
  unit.experience.building = getXpForLevel(4)
  assert.equal(getBuildRateXpMultiplier(unit), 1.2)
})

test('loading types and works map to the expected xp categories', () => {
  const { LOADING_XP_CATEGORY, WORK_XP_CATEGORY, XP_CATEGORIES } = loadExperience()

  assert.deepEqual(LOADING_XP_CATEGORY, {
    berry: XP_CATEGORIES.farming,
    fish: XP_CATEGORIES.fishing,
    gold: XP_CATEGORIES.mining,
    meat: XP_CATEGORIES.hunting,
    stone: XP_CATEGORIES.mining,
    wheat: XP_CATEGORIES.farming,
    wood: XP_CATEGORIES.woodcutting,
  })
  assert.equal(WORK_XP_CATEGORY[constants.WORK_TYPES.forager], XP_CATEGORIES.farming)
  assert.equal(WORK_XP_CATEGORY[constants.WORK_TYPES.hunter], XP_CATEGORIES.hunting)
  assert.equal(WORK_XP_CATEGORY[constants.WORK_TYPES.attacker], XP_CATEGORIES.melee)
})

test('experience entries are sorted by xp and formatted with progress', () => {
  const { formatXpProgressText, getUnitExperienceEntries, getXpForLevel } = loadExperience()
  const unit = makeUnit()
  unit.experience = { melee: 50, mining: 300, farming: 0 }

  const entries = getUnitExperienceEntries(unit)
  assert.deepEqual(
    entries.map(entry => entry.category),
    ['mining', 'melee']
  )
  assert.equal(entries[0].level, 3)
  assert.equal(formatXpProgressText(unit, 'mining'), '3 (0/200)')

  unit.experience.mining = getXpForLevel(10)
  assert.equal(formatXpProgressText(unit, 'mining'), '10 (max)')
})

test('gathering grants xp for the loading type and applies the gather bonus', () => {
  const xpCalls = []
  const { UnitActions } = loadModule('app/classes/unit/UnitActions.ts', {
    'pixi.js': {
      Assets: { cache: { get: () => ({}) } },
    },
    '../../constants': {
      ACTION_TYPES: { fishing: 'fishing' },
      BUILDING_TYPES: {},
      FAMILY_TYPES: {},
      LOADING_FOOD_TYPES: ['fish'],
      LOADING_TYPES: { fish: 'fish' },
      MENU_INFO_IDS: { quantityText: 'quantityText' },
      SHEET_TYPES: { action: 'actionSheet' },
      SOUND_CUES: { villager: {} },
      TYPE_ACTION: {},
      UNIT_TYPES: {},
    },
    '../../lib': {
      degreeToDirection: () => 'south',
      getInstanceDegree: () => 0,
      onSpriteLoopAtFrame: (sprite, frame, callback) => callback(),
      playSoundCue: () => {},
      playerCanSeeInstance: () => false,
      showResourceGainFeedback: () => {},
      THRUST_RELEASE_FRAME: 9,
      SLASH_IMPACT_FRAME: 3,
      SHOOT_RELEASE_FRAME: 5,
    },
    '../../lib/unitExperience': {
      LOADING_XP_CATEGORY: { fish: 'fishing' },
      XP_BUILD_TICK: 2,
      XP_CATEGORIES: {},
      XP_CONVERT_SUCCESS: 30,
      XP_FELL_TREE_TICK: 1,
      getBuildRateXpMultiplier: () => 1,
      getGatherXpBonus: () => 2,
      getHealingXpBonus: () => 0,
      grantUnitXp: (unit, category, amount) => xpCalls.push({ category, amount }),
    },
    '../../lib/unitControl': {
      isHeroControlled: () => false,
      isManualHeroActionReleased: () => false,
    },
    '../Projectile': { Projectile: class {} },
    '../../lib/lpc': { applyBakedLpcUnitAssets: () => {} },
    '../../lib/buildings/towers': {
      getTowerType: () => null,
      isTower: () => false,
    },
  })

  const fish = { quantity: 10, selected: false }
  const unit = {
    category: 'Villager',
    action: 'fishing',
    work: 'fisher',
    loading: 0,
    loadingType: null,
    loadingMax: { fish: 10 },
    gatherAmount: { fisher: 1 },
    silentWorkSounds: ['fishing'],
    dest: fish,
    sprite: {},
    context: { controls: { instanceIsAudible: () => false }, menu: { updateInfo: () => {} }, player: {}, map: {} },
    getActionCondition: () => true,
    setTextures: () => {},
    updateInterfaceLoading: () => {},
    affectNewDest: () => {},
    sendToDelivery: () => {},
  }

  new UnitActions(unit).getAction('fishing')

  // base gatherAmount 1 + xp bonus 2 = 3 fish per swing, all granted as xp
  assert.equal(unit.loading, 3)
  assert.equal(fish.quantity, 7)
  assert.deepEqual(xpCalls, [{ category: 'fishing', amount: 3 }])
})
