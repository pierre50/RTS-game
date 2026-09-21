const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

const geometryMocks = {
  'pixi.js': { Graphics: class {} },
  '../mapSpaces': {
    sameMapSpace: (a, b) => (a.spaceId ?? 'outside') === (b.spaceId ?? 'outside'),
    getEntitySpaceGrid: () => undefined,
  },
  '../maths': { cartesianToIsometric: (i, j) => [(i - j) * 32, (i + j) * 16] },
  '../grid/cells': { getBuildingFootprintCells: () => [] },
}
const geometry = loadTsModule('app/lib/contact/contactGeometry.ts', { mocks: geometryMocks })
const heroAtOrigin = () => ({ x: 0, y: 0, i: 0, j: 0, degree: 180, family: 'unit' })
const targetAt = (x, y = 0) => ({ x, y, i: 1, j: 0, family: 'unit', hitPoints: 20 })

test('melee uses continuous positions even when targets share a grid cell', () => {
  const hero = heroAtOrigin()
  assert.equal(geometry.isContactTouching(hero, targetAt(40), 'sword_iron'), true)
  assert.equal(geometry.isContactTouching(hero, targetAt(70), 'sword_iron'), false)
  assert.equal(geometry.isContactTouching(hero, targetAt(-30), 'sword_iron'), false)
})

test('weapon reach, body scale and facing determine contact', () => {
  const hero = heroAtOrigin()
  assert.equal(geometry.isContactTouching(hero, targetAt(40)), false)
  assert.equal(geometry.isContactTouching(hero, targetAt(60), 'sword_iron'), false)
  assert.equal(geometry.isContactTouching(hero, targetAt(60), 'spear_iron'), true)
  assert.equal(geometry.isContactTouching({ ...hero, spriteScale: 2 }, targetAt(60), 'sword_iron'), true)
  assert.equal(geometry.isContactTouching({ ...hero, degree: 0 }, targetAt(-40), 'sword_iron'), true)
  assert.equal(geometry.isContactTouching({ ...hero, degree: 270 }, targetAt(0, 20), 'sword_iron'), true)
  assert.equal(geometry.isContactTouching({ ...hero, degree: 90 }, targetAt(0, -20), 'sword_iron'), true)
})

test('building edge can be hit without reaching its center; decorative height is irrelevant', () => {
  const hero = heroAtOrigin()
  const building = { ...targetAt(110), family: 'building', size: 3, width: 900, height: 900 }
  assert.equal(geometry.isContactTouching(hero, building, 'sword_iron'), true)
  assert.equal(geometry.isContactTouching(hero, { ...building, x: 160 }, 'sword_iron'), false)
})

test('dead targets and entities in another map space cannot be hit', () => {
  const hero = heroAtOrigin()
  assert.equal(geometry.isContactTouching(hero, { ...targetAt(25), isDead: true }, 'sword'), false)
  assert.equal(geometry.isContactTouching(hero, { ...targetAt(25), spaceId: 'interior:house' }, 'sword'), false)
})

function setupSwing(initialTargets) {
  const aggressions = []
  let candidates = initialTargets
  let impact
  const hits = []
  const sounds = []
  const hero = { ...heroAtOrigin(), inventory: { activeWeapons: { melee: 'sword_iron' } } }
  const tools = loadTsModule('app/lib/hero/heroMeleeTools.ts', {
    mocks: {
      '../combat': {
        getActionCondition: (_hero, target) => target.hitPoints > 0 && !target.isDead && !target.nonHostile,
        prepareAutomaticParry: () => {},
      },
      '../combat/combatHit': {
        applyCombatHit: (_source, target) => {
          hits.push(target)
          return { damageDealt: 4 }
        },
      },
      '../combat/diplomaticAggression': {
        canTriggerDiplomaticAggression: (_hero, target) => Boolean(target.nonHostile),
        applyDiplomaticAggression: (_hero, target) => {
          aggressions.push(target)
          return { changed: false }
        },
      },
      '../equipment/equipmentStats': {
        getEquipmentCombatStats: () => ({ weaponPower: 4 }),
        getUnitWorkEquipment: () => [],
      },
      '../grid/visibility': { findInstancesInSight: (_hero, predicate) => candidates.filter(predicate) },
      '../graphics': { SLASH_IMPACT_FRAME: 5 },
      '../audio/sound': { playAudibleSoundCue: (_hero, sound) => sounds.push(sound) },
      '../units/unitExperience': { getCombatXpBonus: () => 0, XP_CATEGORIES: { melee: 'melee' } },
      './heroEnergy': { spendHeroEnergy: () => true },
      './heroToolAnimation': {
        playHeroToolAnimation: (_hero, callback) => {
          hero.actionLocked = true
          impact = callback
        },
      },
      './heroToolEquipment': {
        getHeroToolEquipment: (unit, tool) => (tool === 'sword' ? [unit.inventory.activeWeapons.melee] : []),
      },
      './heroTargeting': { CLICK_TARGET_SEARCH_RANGE: 15, getHeroAimDegree: () => 180 },
      '../contact/contactGeometry': geometry,
      '../contact/contactDebug': { showContactDebug: () => {} },
    },
  })
  return {
    hero,
    hits,
    aggressions,
    sounds,
    tools,
    release: () => impact(),
    setTargets: targets => {
      candidates = targets
    },
  }
}

test('target leaving during windup receives no damage at release', () => {
  const target = targetAt(25)
  const swing = setupSwing([target])
  assert.equal(swing.tools.triggerSwordAttackAt(swing.hero), true)
  target.x = 100
  swing.release()
  assert.deepEqual(swing.hits, [])
  assert.equal(swing.sounds.length, 1)
})

test('a swing begun in empty space hits a target entering before impact', () => {
  const swing = setupSwing([])
  assert.equal(swing.tools.triggerSwordAttackAt(swing.hero), true)
  const target = targetAt(25)
  swing.setTargets([target])
  swing.release()
  assert.deepEqual(swing.hits, [target])
})

test('only one intersecting target is hit and a nearer target behind does not mask it', () => {
  const target = targetAt(35)
  const swing = setupSwing([targetAt(-15), targetAt(45), target])
  swing.tools.triggerSwordAttackAt(swing.hero)
  swing.release()
  assert.deepEqual(swing.hits, [target])
})

test('another attack input during windup cannot redirect the swing', () => {
  const target = targetAt(25)
  const swing = setupSwing([target])
  swing.tools.triggerSwordAttackAt(swing.hero)
  assert.equal(swing.tools.triggerSwordAttackAt(swing.hero, { x: -100, y: 0 }), false)
  swing.release()
  assert.deepEqual(swing.hits, [target])
})

test('bare hand swing can hit a newcomer, but cannot reach sword distance', () => {
  const swing = setupSwing([])
  assert.equal(swing.tools.playEmptyHandWhiff(swing.hero), true)
  const near = targetAt(20)
  swing.setTargets([near, targetAt(40)])
  swing.release()
  assert.deepEqual(swing.hits, [near])
})

function loadMeleeApproach() {
  return loadTsModule('app/classes/unit/movement/UnitContactApproach.ts', {
    mocks: {
      '../../../lib/contact/contactGeometry': geometry,
      '../../../lib/actions/contactActions': {
        usesUnitContactAction: (unit, action) => action === 'attack' && !unit.projectile,
        sampleActionApproach: (unit, target) => geometry.sampleContactApproach(unit, target, unit.equipment?.[0]),
      },
      '../../../lib/combat/unitMelee': {
        usesMeleeAttack: unit => !unit.projectile,
        getUnitMeleeWeapon: unit => unit.equipment?.[0],
      },
      '../../../lib/mapSpaces': geometryMocks['../mapSpaces'],
    },
  })
}

function makeNpcApproach(target, equipment = ['sword_iron']) {
  let tick
  let attacks = 0
  let repaths = 0
  const unit = {
    ...heroAtOrigin(),
    equipment,
    speed: 2,
    dest: target,
    action: 'attack',
    path: [],
    getActionCondition: target => !target.isDead,
    moveDirect: (dx, dy, step) => {
      unit.x += dx * step
      unit.y += dy * step
      return true
    },
    setDest: target => {
      unit.dest = target
    },
    startInterval: callback => {
      tick = callback
    },
    stopInterval: () => {
      tick = null
    },
    getAction: () => {
      attacks++
    },
    sendToEvt: () => {
      repaths++
    },
  }
  return {
    unit,
    run: () => {
      for (let count = 0; tick && count < 200; count++) tick()
    },
    attacks: () => attacks,
    repaths: () => repaths,
  }
}

test('NPC closes the last fraction of a cell and stops at the same weapon contact as the hero', () => {
  const { tryStartUnitContactApproach } = loadMeleeApproach()
  const target = targetAt(64)
  for (const equipment of [['sword_iron'], []]) {
    const npc = makeNpcApproach(target, equipment)
    assert.equal(geometry.canReachContact(npc.unit, target, equipment[0]), false)
    assert.equal(tryStartUnitContactApproach(npc.unit, target, 'attack'), true)
    npc.run()
    assert.equal(npc.attacks(), 1)
    assert.equal(geometry.isContactTouching(npc.unit, target, equipment[0]), true)
    assert.ok(npc.unit.x > 0 && npc.unit.x < target.x)
    assert.equal(npc.repaths(), 0)
  }
})

test('NPC approach cannot walk through a blocker and leaves ranged actions to pathfinding', () => {
  const { tryStartUnitContactApproach } = loadMeleeApproach()
  const target = targetAt(64)
  const npc = makeNpcApproach(target)
  npc.unit.moveDirect = () => false
  assert.equal(tryStartUnitContactApproach(npc.unit, target, 'attack'), false)
  assert.equal(npc.unit.x, 0)
  assert.equal(npc.attacks(), 0)
  npc.unit.projectile = 'arrow'
  assert.equal(tryStartUnitContactApproach(npc.unit, target, 'attack'), false)
})

test('NPC abandons its final approach after a new order', () => {
  const { tryStartUnitContactApproach } = loadMeleeApproach()
  const target = targetAt(64)
  const npc = makeNpcApproach(target)
  assert.equal(tryStartUnitContactApproach(npc.unit, target, 'attack'), true)
  npc.unit.dest = targetAt(100)
  npc.run()
  assert.equal(npc.attacks(), 0)
  assert.equal(npc.repaths(), 0)
})

test('NPC melee impact applies the shared geometry even when legacy arrival says true', () => {
  let callbacks
  let damage = 0
  const { UnitCombat } = loadTsModule('app/classes/unit/UnitCombat.ts', {
    mocks: {
      '../../lib': {
        applyCombatHit: () => {
          damage++
          return { killed: false }
        },
        playAudibleSoundCue: () => {},
        SLASH_IMPACT_FRAME: 5,
      },
      '../../lib/contact/contactDebug': { showContactDebug: () => {} },
      '../../lib/contact/contactGeometry': geometry,
      '../../lib/combat/unitMelee': { getUnitMeleeWeapon: unit => unit.equipment?.[0], usesMeleeAttack: () => true },
      '../../lib/combat/combatAttackLoop': {
        runAttackLoopOnFrame: (_unit, options) => {
          callbacks = options
        },
      },
      '../../lib/equipment/equipmentStats': { getUnitCombatRange: () => undefined },
      '../../lib/units/unitExperience': { getCombatXpBonus: () => 0, XP_CATEGORIES: { melee: 'melee' } },
      '../../lib/combat/combatBehavior': { markCombatAttack: () => {} },
      '../../lib/entities/slashRecoveryAnimation': {},
      '../../lib/buildings/interiorAccess': {},
      '../../services/BuildingInteriorSpaceSystem': {},
      '../../lib/projectiles': {},
      '../../lib/units/unitWorkAppearance': {},
      '../../lib/units/unitVisualTransition': {},
      '../../lib/combat/combatFeedback': {},
      '../../lib/units/unitControl': {},
      '../Projectile': {},
    },
  })
  const target = targetAt(30)
  const npc = {
    ...heroAtOrigin(),
    equipment: ['sword_iron'],
    dest: target,
    getActionCondition: () => true,
    isUnitAtDest: () => true,
  }
  new UnitCombat(npc).handleAttackAction()
  assert.equal(callbacks.trackTargetOnRelease, false)
  npc.degree = 0
  callbacks.syncMovingTargetDirection()
  assert.equal(npc.degree, 180)
  target.x = 100
  callbacks.onReadyToAttack(target)
  assert.equal(damage, 0)
  target.x = 30
  callbacks.onReadyToAttack(target)
  assert.equal(damage, 1)
})

for (const family of ['unit', 'building', 'animal']) {
  test(`interact cannot attack a non-hostile ${family}, including on an empty-hand swing`, () => {
    const target = { ...targetAt(20), family, nonHostile: true }
    const swing = setupSwing([target])
    assert.equal(swing.tools.triggerInteractMeleeAt(swing.hero), 'miss')
    swing.tools.playEmptyHandWhiff(swing.hero)
    swing.release()
    assert.deepEqual(swing.hits, [])
    assert.deepEqual(swing.aggressions, [])
  })
}

test('interact rechecks relations at impact and never triggers diplomatic aggression', () => {
  const target = targetAt(20)
  const swing = setupSwing([target])
  assert.equal(swing.tools.triggerInteractMeleeAt(swing.hero), 'triggered')
  target.nonHostile = true
  swing.release()
  assert.deepEqual(swing.hits, [])
  assert.deepEqual(swing.aggressions, [])
})

test('interact can still hit enemies without invoking diplomatic aggression', () => {
  const target = targetAt(20)
  const swing = setupSwing([target])
  assert.equal(swing.tools.triggerInteractMeleeAt(swing.hero), 'triggered')
  swing.release()
  assert.deepEqual(swing.hits, [target])
  assert.deepEqual(swing.aggressions, [])
})

test('sword still allows deliberate diplomatic aggression', () => {
  const target = { ...targetAt(20), nonHostile: true }
  const swing = setupSwing([target])
  assert.equal(swing.tools.triggerSwordAttackAt(swing.hero), true)
  assert.deepEqual(swing.aggressions, [target])
})
