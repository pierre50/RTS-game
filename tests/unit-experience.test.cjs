const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function loadModule(relativePath, mocks) {
  return loadTsModule(relativePath, {
    mocks: {
      '../HeroLassoThrow': { HeroLassoThrow: class {} },
      '../../lib/horses/horseCapture': {
        getNearestAvailableStableForUnit: () => null,
        routeCapturedHorseToStableWithOwnerContact: () => null,
      },
      '../../lib/entities/slashRecoveryAnimation': { playReverseSlashRecovery: () => false },
      ...mocks,
    },
  })
}

const constants = {
  FAMILY_TYPES: {
    building: 'building',
    unit: 'unit',
  },
  LOADING_TYPES: {
    berry: 'berry',
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
    forager: 'forager',
    goldminer: 'goldminer',
    healer: 'healer',
    hunter: 'hunter',
    stoneminer: 'stoneminer',
    woodcutter: 'woodcutter',
  },
  UNIT_TYPES: {
    villager: 'Villager',
  },
}

const entityHealthDisplayMock = {
  syncEntityHealthDisplay: entity => entity.drawHealthBar?.(),
}

function loadExperience(feedbackCalls = []) {
  return loadModule('app/lib/units/unitExperience.ts', {
    '../constants': constants,
    './combat/combatFeedback': {
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

test('overall level derives from total xp instead of the highest skill', () => {
  const { getUnitLevel, getUnitOverallLevel, getXpForLevel } = loadExperience()
  const unit = makeUnit({
    experience: {
      mining: getXpForLevel(3),
      farming: getXpForLevel(3),
    },
  })

  assert.equal(getUnitLevel(unit, 'mining'), 3)
  assert.equal(getUnitLevel(unit, 'farming'), 3)
  assert.equal(getUnitOverallLevel(unit), 4)
})

test('equipment level follows role skills instead of unrelated expertise', () => {
  const { getUnitEquipmentLevel, getXpForLevel } = loadExperience()
  const infantry = makeUnit({
    type: 'Fantassin',
    category: 'Fantassin',
    experience: {
      woodcutting: getXpForLevel(12),
      melee: getXpForLevel(4),
      defense: getXpForLevel(4),
    },
  })
  const archer = makeUnit({
    type: 'Bowman',
    category: 'Archer',
    experience: {
      melee: getXpForLevel(10),
      ranged: getXpForLevel(3),
      defense: getXpForLevel(3),
    },
  })

  assert.equal(getUnitEquipmentLevel(infantry), 5)
  assert.equal(getUnitEquipmentLevel(archer), 4)
})

test('debug level setter writes exact melee xp and clamps to the max level', () => {
  const { getUnitLevel, setUnitDebugLevel, XP_CATEGORIES, XP_MAX_LEVEL, getXpForLevel } = loadExperience()
  const unit = makeUnit()

  assert.equal(setUnitDebugLevel(unit, 4), 4)
  assert.equal(unit.experience[XP_CATEGORIES.melee], getXpForLevel(4))
  assert.equal(getUnitLevel(unit, XP_CATEGORIES.melee), 4)

  assert.equal(setUnitDebugLevel(unit, 999), XP_MAX_LEVEL)
  assert.equal(getUnitLevel(unit, XP_CATEGORIES.melee), XP_MAX_LEVEL)
})

test('debug level setter writes role skills for equipment progression', () => {
  const { getUnitEquipmentLevel, getUnitLevel, setUnitDebugLevel, XP_CATEGORIES, getXpForLevel } = loadExperience()
  const infantry = makeUnit({ type: 'Fantassin', category: 'Fantassin' })

  setUnitDebugLevel(infantry, 4)

  assert.equal(infantry.experience[XP_CATEGORIES.melee] + infantry.experience[XP_CATEGORIES.defense], getXpForLevel(4))
  assert.equal(getUnitLevel(infantry, XP_CATEGORIES.defense), 2)
  assert.equal(getUnitEquipmentLevel(infantry), 4)
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
  const { formatXpProgressText, getUnitExperienceEntries, getXpForLevel, XP_MAX_LEVEL } = loadExperience()
  const unit = makeUnit()
  unit.experience = { melee: 50, mining: 300, farming: 0 }

  const entries = getUnitExperienceEntries(unit)
  assert.deepEqual(
    entries.map(entry => entry.category),
    ['mining', 'melee']
  )
  assert.equal(entries[0].level, 3)
  assert.equal(formatXpProgressText(unit, 'mining'), '3 (0/200)')

  unit.experience.mining = getXpForLevel(XP_MAX_LEVEL)
  assert.equal(formatXpProgressText(unit, 'mining'), `${XP_MAX_LEVEL} (max)`)
})

test('gathering grants xp for the loading type and applies the gather bonus', () => {
  const xpCalls = []
  const { UnitActions } = loadModule('app/classes/unit/UnitActions.ts', {
    'pixi.js': {
      Assets: { cache: { get: () => ({}) } },
    },
    '../../constants': {
      ACTION_TYPES: { forageberry: 'forageberry' },
      BUILDING_TYPES: {},
      FAMILY_TYPES: {},
      LOADING_FOOD_TYPES: ['berry'],
      LOADING_TYPES: { berry: 'berry' },
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
      SLASH_IMPACT_FRAME: 5,
      BOW_SHOOT_RELEASE_FRAME: 8,
    },
    '../../lib/units/unitExperience': {
      LOADING_XP_CATEGORY: { berry: 'farming' },
      XP_BUILD_TICK: 2,
      XP_CATEGORIES: {},
      XP_CONVERT_SUCCESS: 30,
      XP_FELL_TREE_TICK: 1,
      getBuildRateXpMultiplier: () => 1,
      getGatherXpBonus: () => 2,
      getHealingXpBonus: () => 0,
      grantUnitXp: (unit, category, amount) => xpCalls.push({ category, amount }),
    },
    '../../lib/entities/entityHealthDisplay': entityHealthDisplayMock,
    '../../lib/units/unitControl': {
      isHeroControlled: () => false,
      isManualHeroActionReleased: () => false,
    },
    '../../lib/lang': { t: key => key },
    '../../lib/units/unitEnergy': { spendOrWaitForEnergy: () => true },
    '../../lib/units/unitWorkAppearance': {
      applyUnitWorkAssets: () => {},
    },
    '../Projectile': { Projectile: class {} },
    '../../lib/lpc': { refreshBakedLpcUnitAssets: () => {} },
  })

  const berryBush = { quantity: 10, selected: false }
  const unit = {
    category: 'Villager',
    action: 'forageberry',
    work: 'forager',
    gatherAmount: { forager: 1 },
    dest: berryBush,
    sprite: {},
    context: { controls: { instanceIsAudible: () => false }, menu: { updateInfo: () => {} }, player: {}, map: {} },
    owner: { food: 0 },
    getActionCondition: () => true,
    setTextures: () => {},
    affectNewDest: () => {},
  }

  new UnitActions(unit).getAction('forageberry')

  // base gatherAmount 1 + xp bonus 2 = 3 berries per swing, all granted as xp
  assert.equal(unit.owner.food, 3)
  assert.deepEqual(unit.inventory.resources, { food: 3 })
  assert.equal(berryBush.quantity, 7)
  assert.deepEqual(xpCalls, [{ category: 'farming', amount: 3 }])
})

test('gathered stone is added to the unit inventory while still increasing global resources', () => {
  let inventoryRefreshes = 0
  const { addGatheredResource } = loadModule('app/classes/unit/UnitResourceGathering.ts', {
    '../../constants': {
      LOADING_TYPES: { berry: 'berry', wheat: 'wheat', meat: 'meat', stone: 'stone' },
      RESOURCE_GATHER_SWINGS: {},
      RESOURCE_STOCKPILE_TYPES: { Stone: 'stone' },
      RESOURCE_TYPES: { berrybush: 'Berrybush' },
    },
    '../../lib/lang': { t: key => key },
    '../../lib/units/unitExperience': { getGatherXpBonus: () => 0 },
  })
  const unit = {
    context: {
      controls: {},
      menu: { refreshInventory: () => inventoryRefreshes++ },
    },
    inventory: {},
    owner: { stone: 4 },
  }
  unit.context.controls.heroUnit = unit

  addGatheredResource(unit, 'stone', 6)

  assert.deepEqual(unit.inventory.resources, { stone: 6 })
  assert.equal(unit.owner.stone, 10)
  assert.equal(inventoryRefreshes, 1)
})
