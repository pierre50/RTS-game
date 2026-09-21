const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function loadUnitResourceActions(overrides = {}) {
  return loadTsModule('app/classes/unit/UnitResourceActions.ts', {
    mocks: {
      '../../lib/actions/contactActions': {
        canReachActionTarget: () => true,
        isActionTouchingTarget: () => true,
        getActionContactTool: () => undefined,
      },
      '../../lib/contact/contactGeometry': { getContactAimDegree: () => 0 },
      '../../lib/contact/contactDebug': { showContactDebug: () => {} },
      '../../constants': {
        UNIT_TYPES: { hero: 'Hero' },
        LOADING_TYPES: {
          berry: 'berry',
          fiber: 'fiber',
          herb: 'herb',
          toxicHerb: 'toxicHerb',
          wheat: 'wheat',
          wood: 'wood',
        },
        MENU_INFO_IDS: {},
        MINING_RESOURCE_CONFIG: {},
        RESOURCE_GATHER_SWINGS: {},
        RESOURCE_TYPES: {
          berrybush: 'Berrybush',
          fiberPlant: 'FiberPlant',
          medicinalHerb: 'MedicinalHerb',
          toxicHerb: 'ToxicHerb',
          wheat: 'Wheat',
        },
        RESOURCE_STOCKPILE_TYPES: {
          Berrybush: 'berry',
          FiberPlant: 'fiber',
          MedicinalHerb: 'herb',
          ToxicHerb: 'toxicHerb',
        },
        WILDGRASS_RESOURCE_TYPES: new Set(['MedicinalHerb', 'ToxicHerb', 'FiberPlant']),
        SHEET_TYPES: { action: 'actionSheet' },
        SOUND_CUES: {
          villager: {
            forageBerry: 'berry-gathering',
            gatherFood: 'farming-3',
          },
        },
      },
      '../../lib': {
        SLASH_IMPACT_FRAME: 4,
        onSpriteLoopAtFrame: () => {},
        playAudibleSoundCue: () => {},
        showDamageFeedback: () => {},
        showHitPointGainFeedback: () => {},
        showResourceGainFeedback: () => {},
      },
      '../../lib/animations/actionFrameSequences': {
        getActionAnimationReleaseFrame: (_unit, _action, impactFrame) => impactFrame,
      },
      '../../lib/entities/entityHealthDisplay': { syncEntityHealthDisplay: () => {} },
      '../../lib/entities/workImpactFragments': { spawnWorkImpactFragments: () => {} },
      '../../lib/resources/resourceDelivery': {
        getUnitCarriedResourceAmount: unit => unit.inventory?.resources?.wood ?? 0,
        getResourceKeyForLoadingType: loadingType => loadingType,
        getUnitResourceCapacityRemaining: () => Number.POSITIVE_INFINITY,
        unitShouldDeliverResource: () => false,
      },
      '../../lib/units/unitControl': { isHeroControlled: () => false },
      '../../lib/units/unitEnergy': { spendOrWaitForEnergy: () => true },
      '../../lib/units/unitExperience': {
        LOADING_XP_CATEGORY: {},
        XP_BUILD_TICK: 1,
        XP_CATEGORIES: {},
        XP_FELL_TREE_TICK: 1,
        getBuildRateXpMultiplier: () => 1,
        getGatherXpBonus: () => 0,
        grantUnitXp: () => {},
      },
      '../../lib/lang': { t: key => key },
      './UnitBuildVisuals': { shouldSyncBuildHealthDisplay: () => false },
      './UnitGatherVisualDebug': { logGatherVisualState: () => {} },
      './UnitManualHeroWork': {
        finishManualHeroWorkSwing: () => {},
        lockManualHeroAction: () => {},
        restartManualHeroActionAnimation: () => {},
        stopManualHeroAction: () => {},
      },
      ...overrides,
    },
  }).UnitResourceActions
}

function loadUnitResourceGathering() {
  return loadTsModule('app/classes/unit/UnitResourceGathering.ts', {
    mocks: {
      '../../constants': {
        LOADING_TYPES: { wood: 'wood' },
        RESOURCE_GATHER_SWINGS: {},
        RESOURCE_STOCKPILE_TYPES: {},
        RESOURCE_TYPES: { berrybush: 'Berrybush', wheat: 'Wheat' },
        SOUND_CUES: { villager: {} },
        WILDGRASS_RESOURCE_TYPES: new Set(),
      },
      '../../lib/entities/workImpactFragments': { spawnWorkImpactFragments: () => {} },
      '../../lib/lang': { t: key => key },
      '../../lib/resources/resourceDelivery': {
        getResourceKeyForLoadingType: loadingType => loadingType,
        getUnitCarriedResourceAmount: unit => unit.inventory?.resources?.wood ?? 0,
        getUnitResourceCapacityRemaining: () => Number.POSITIVE_INFINITY,
        unitShouldDeliverResource: unit => (unit.inventory?.resources?.wood ?? 0) >= 30,
      },
      '../../lib/units/unitExperience': {
        getGatherXpBonus: () => 0,
      },
    },
  })
}

function captureForageSound(targetType) {
  const UnitResourceActions = loadUnitResourceActions()
  const action = new UnitResourceActions({
    dest: { family: 'resource', quantity: 2, type: targetType },
    sounds: { work: {} },
  })
  let captured
  action.startGathering = (_loadingType, soundId) => {
    captured = soundId
  }

  action.handleForageBerryAction()

  return captured
}

test('wildgrass forage uses the wheat contact sound', () => {
  assert.equal(captureForageSound('MedicinalHerb'), 'farming-3')
  assert.equal(captureForageSound('ToxicHerb'), 'farming-3')
  assert.equal(captureForageSound('FiberPlant'), 'farming-3')
})

test('berrybush forage keeps the berry gathering sound', () => {
  assert.equal(captureForageSound('Berrybush'), 'berry-gathering')
})

test('delivery helper reports failure when a full bag cannot be delivered', () => {
  const { sendVillagerToDeliveryIfFull } = loadUnitResourceGathering()
  const calls = []
  const unit = {
    inventory: { resources: { wood: 30 } },
    owner: { isPlayed: true },
    sendToDelivery: () => false,
    stop: () => calls.push('stop'),
  }

  assert.equal(sendVillagerToDeliveryIfFull(unit, 'wood'), false)
  assert.deepEqual(calls, [])
})

for (const [type, age, action] of [
  ['Iron', 0, 'mineiron'],
]) {
  test(`locked ${type} swings without resources, XP or depletion and warns only once`, () => {
    const constants = loadTsModule('app/lib/constants.ts')
    const { onSpriteLoopAtFrame, SLASH_IMPACT_FRAME } = loadTsModule('app/lib/graphics.ts', {
      mocks: Object.fromEntries(
        ['assets', 'colors', 'canvas', 'selection', 'textures'].map(name => [`./graphics/${name}`, {}])
      ),
    })
    let swings = 0
    let sounds = 0
    const messages = []
    const target = { type, quantity: 10, hitPoints: 20 }
    const UnitResourceActions = loadUnitResourceActions({
      '../../constants': constants,
      '../../lib': {
        SLASH_IMPACT_FRAME,
        onSpriteLoopAtFrame,
        playAudibleSoundCue: () => {
          sounds++
        },
        showResourceGainFeedback: () => assert.fail('no resource feedback'),
      },
      '../../lib/units/unitControl': { isHeroControlled: unit => unit.controlMode === 'hero' },
      '../../lib/units/unitExperience': { grantUnitXp: () => assert.fail('no XP') },
      './UnitManualHeroWork': {
        restartManualHeroActionAnimation: () => {
          swings++
        },
        lockManualHeroAction: () => {},
        finishManualHeroWorkSwing: () => {},
        stopManualHeroAction: () => {},
      },
    })
    const unit = {
      type: 'Hero',
      controlMode: 'hero',
      owner: { age, isPlayed: true },
      dest: target,
      action,
      sprite: {},
      inventory: { resources: {} },
      context: { menu: { showMessage: (...args) => messages.push(args) } },
      getActionCondition: () => false,
      affectNewDest: () => assert.fail('the swing should be allowed'),
    }
    const actions = new UnitResourceActions(unit)
    const expectedWarning = [['Une pioche en bronze ou en fer est nécessaire pour extraire le fer.', 'warning']]
    for (let i = 0; i < 3; i++) {
      actions.startMiningResource(action)
      assert.equal(typeof unit.sprite.onFrameChange, 'function')
      for (let frame = 0; frame < SLASH_IMPACT_FRAME; frame++) {
        unit.sprite.onFrameChange(frame)
        assert.deepEqual(messages, i === 0 ? [] : expectedWarning, 'no warning before the first impact')
      }
      // Also cover a render tick skipping the exact impact frame.
      unit.sprite.onFrameChange(SLASH_IMPACT_FRAME + (i === 1 ? 1 : 0))
      assert.deepEqual(messages, expectedWarning, 'the first impact warns, subsequent impacts do not repeat it')
      unit.sprite.onFrameChange(SLASH_IMPACT_FRAME + 2)
      assert.deepEqual(messages, expectedWarning)
    }
    assert.equal(swings, 3)
    assert.equal(sounds, 3)
    assert.deepEqual(messages, expectedWarning)
    assert.equal(constants.RESOURCE_TYPES[type.toLowerCase()], type)
    assert.deepEqual(unit.inventory.resources, {})
    assert.equal(target.quantity, 10)
    assert.equal(target.hitPoints, 20)
    let gathering = false
    actions.startGathering = () => {
      gathering = true
    }
    unit.owner.age++
    actions.startMiningResource(action)
    assert.equal(gathering, true, 'reaching the required age restores normal gathering')
  })
}

test('the final mining hit only grants the remaining stock', () => {
  const UnitResourceActions = loadUnitResourceActions()
  let impact
  let depleted = false
  const target = {
    family: 'resource',
    type: 'Gold',
    quantity: 1,
    die: () => {
      depleted = true
    },
  }
  const unit = {
    dest: target,
    action: 'minegold',
    work: 'goldminer',
    gatherAmount: { goldminer: 10 },
    inventory: { resources: {} },
    sprite: {},
    getActionCondition: () => target.quantity > 0,
  }
  const actions = new UnitResourceActions(unit)
  actions.prepareLoopingWorkAction = () => true
  actions.ensureWorkContact = () => true
  actions.bindWorkImpact = (_frame, callback) => {
    impact = callback
  }
  actions.startGathering('gold', null, { dieOnEmpty: true })
  impact()
  assert.equal(unit.inventory.resources.gold, 1)
  assert.equal(target.quantity, 0)
  assert.equal(depleted, true)
})
