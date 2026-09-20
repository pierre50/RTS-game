const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

const frames = loadTsModule('app/lib/graphics.ts', {
  mocks: Object.fromEntries(
    ['assets', 'colors', 'canvas', 'isoFootprint', 'textures'].map(name => [`./graphics/${name}`, {}])
  ),
})
const attackLoop = loadTsModule('app/lib/combat/combatAttackLoop.ts', {
  mocks: {
    '../graphics': frames,
    '../maths': { instancesDistance: () => 0 },
    '../debug': { debugLog: () => {} },
    '../units/unitEnergy': { hasEnergyForAction: () => true, spendOrWaitForEnergy: () => true },
  },
})

const geometry = loadTsModule('app/lib/contact/contactGeometry.ts', {
  mocks: {
    'pixi.js': { Graphics: class {} },
    '../mapSpaces': { sameMapSpace: (a, b) => a.spaceId === b.spaceId, getEntitySpaceGrid: () => undefined },
    '../maths': { cartesianToIsometric: (i, j) => [(i - j) * 32, (i + j) * 16] },
    '../grid/cells': { getBuildingFootprintCells: () => [] },
  },
})
const contacts = loadTsModule('app/lib/actions/contactActions.ts', {
  mocks: {
    '../contact/contactGeometry': geometry,
    '../combat/unitMelee': {
      usesMeleeAttack: unit => !unit.projectile,
      getUnitMeleeWeapon: unit => unit.equipment?.[0],
    },
    '../equipment/equipmentStats': {
      getUnitWorkEquipment: work =>
        ({
          woodcutter: ['axe_iron'],
          stoneminer: ['pickaxe_iron'],
          goldminer: ['pickaxe_iron'],
          builder: ['hammer_iron'],
          farmer: ['scythe_iron'],
        })[work] ?? [],
    },
  },
})
const actor = () => ({ x: 0, y: 0, i: 0, j: 0, degree: 180, family: 'unit', equipment: ['sword_iron'] })
const resource = (x = 46) => ({ x, y: 0, i: 1, j: 0, family: 'resource', size: 1, quantity: 20, hitPoints: 10 })

test('work uses axe, pickaxe and hammer; foraging and carcasses use the hand despite an equipped sword', () => {
  const unit = actor()
  for (const [action, tool] of [
    ['chopwood', 'axe_iron'],
    ['minestone', 'pickaxe_iron'],
    ['minegold', 'pickaxe_iron'],
    ['build', 'hammer_iron'],
    ['forageberry', undefined],
    ['takemeat', undefined],
  ]) {
    assert.equal(contacts.getActionContactTool(unit, action), tool)
  }
  assert.equal(contacts.canReachActionTarget(unit, resource(64), 'chopwood'), true)
  assert.equal(contacts.canReachActionTarget(unit, resource(64), 'forageberry'), false)
})

test('hero and NPC work share approach and impact geometry, independent of their grid coordinates', () => {
  for (const controlMode of ['hero', 'unit']) {
    const unit = { ...actor(), controlMode }
    const target = resource(46)
    for (const action of ['chopwood', 'minestone', 'forageberry', 'farm', 'build']) {
      assert.equal(contacts.canReachActionTarget(unit, target, action), true)
      assert.equal(contacts.isActionTouchingTarget(unit, target, action), true)
      assert.equal(contacts.isActionTouchingTarget(unit, { ...target, x: 150 }, action), false)
    }
  }
})

test('dead animals can be harvested but cannot be hit as combat targets', () => {
  const unit = actor()
  const corpse = { ...resource(20), family: 'animal', isDead: true }
  assert.equal(contacts.isActionTouchingTarget(unit, corpse, 'takemeat'), true)
  assert.equal(geometry.isContactTouching(unit, corpse, 'sword_iron'), false)
  assert.equal(contacts.isActionTouchingTarget(unit, { ...corpse, spaceId: 'inside' }, 'takemeat'), false)
})

test('animal attacks and attacks against animals use the same geometric intersection', () => {
  const wolf = { ...actor(), family: 'animal', equipment: undefined }
  const unit = { ...actor(), x: 40 }
  assert.equal(geometry.canReachContact(wolf, unit), true)
  assert.equal(geometry.isContactTouching(wolf, unit), true)
  assert.equal(geometry.isContactTouching(wolf, { ...unit, x: 90 }), false)
  assert.equal(geometry.isContactTouching({ ...unit, degree: 0 }, wolf, 'sword_iron'), true)
  assert.equal(geometry.isContactTouching({ ...wolf, degree: 0 }, unit), false)
})

function workHarness(action, target, hero = false) {
  let gained = 0
  let spent = 0
  let rerouted = 0
  let stopped = 0
  const unit = {
    ...actor(),
    action,
    dest: target,
    sprite: {},
    controlMode: hero ? 'hero' : 'unit',
    getActionCondition: () => true,
    setTextures: () => {},
    sendToEvt: () => rerouted++,
  }
  const { UnitResourceActions } = loadTsModule('app/classes/unit/UnitResourceActions.ts', {
    mocks: {
      '../../lib/actions/contactActions': contacts,
      '../../lib/contact/contactGeometry': geometry,
      '../../lib/contact/contactDebug': { showContactDebug: () => {} },
      '../../lib': {
        SLASH_IMPACT_FRAME: 5,
        onSpriteLoopAtFrame: frames.onSpriteLoopAtFrame,
        playAudibleSoundCue: () => {},
        showResourceGainFeedback: () => {},
        showDamageFeedback: () => {},
        showHitPointGainFeedback: () => {},
      },
      '../../lib/units/unitExperience': {
        grantUnitXp: () => {},
        LOADING_XP_CATEGORY: {},
        XP_CATEGORIES: {},
        getBuildRateXpMultiplier: () => 1,
      },
      '../../lib/units/unitControl': { isHeroControlled: () => hero },
      '../../lib/units/unitEnergy': {
        spendOrWaitForEnergy: () => {
          spent++
          return true
        },
      },
      '../../lib/animations/actionFrameSequences': { getActionAnimationReleaseFrame: (_unit, _action, frame) => frame },
      '../../lib/entities/entityHealthDisplay': { syncEntityHealthDisplay: () => {} },
      '../../lib/entities/workImpactFragments': { spawnWorkImpactFragments: () => {} },
      './UnitManualHeroWork': {
        finishManualHeroWorkSwing: () => {},
        restartManualHeroActionAnimation: () => {},
        lockManualHeroAction: () => {},
        stopManualHeroAction: () => stopped++,
      },
      './UnitResourceGathering': {
        clampDepletedBerrybushHitPoints: () => {},
        isRuntimeEntity: Boolean,
        isResourceEntity: Boolean,
        isFarmHarvestTarget: Boolean,
        isBuildingEntity: Boolean,
        getGatherAmount: () => 1,
        shouldReleaseGatheredResource: () => true,
        getCarriedResourceAmountForLoadingType: () => 0,
        addGatheredResource: () => {
          gained++
          return 1
        },
        sendVillagerToDeliveryIfFull: () => false,
      },
      './UnitGatherVisualDebug': { logGatherVisualState: () => {} },
      './UnitBuildVisuals': { shouldSyncBuildHealthDisplay: () => false },
    },
  })
  const actions = new UnitResourceActions(unit)
  return {
    actions,
    unit,
    release: () => {
      unit.sprite.onFrameChange?.(0)
      unit.sprite.onFrameChange?.(6)
    },
    counts: () => ({ gained, spent, rerouted, stopped }),
  }
}

test('work effects are blocked at impact for mining, hand gathering, chopping, farming and building', () => {
  for (const hero of [true, false]) {
    for (const action of ['minestone', 'forageberry', 'chopwood', 'farm', 'build']) {
      const target = { ...resource(), totalHitPoints: 20 }
      const h = workHarness(action, target, hero)
      if (action === 'chopwood') h.actions.handleChopWoodAction()
      else if (action === 'farm') h.actions.handleFarmAction()
      else if (action === 'build') h.actions.handleBuildAction()
      else h.actions.startGathering('stone', null)
      target.x = 150
      h.release()
      assert.deepEqual(h.counts(), { gained: 0, spent: 0, rerouted: hero ? 0 : 1, stopped: hero ? 1 : 0 })
      assert.equal(target.quantity, 20)
      assert.equal(target.hitPoints, 10)
    }
  }
})

test('a valid hand contact on a carcass still awards resources', () => {
  const target = { ...resource(20), family: 'animal', isDead: true }
  const h = workHarness('takemeat', target)
  h.actions.startGathering('meat', null)
  h.release()
  assert.equal(h.counts().gained, 1)
  assert.equal(target.quantity, 19)
})

function animalApproachHarness(blocked = false) {
  const grid = Array.from({ length: 9 }, (_, i) =>
    Array.from({ length: 9 }, (_, j) => ({
      i,
      j,
      x: (i - j) * 32,
      y: (i + j) * 16,
      z: 0,
      category: 'Land',
      solid: false,
      has: null,
      place(entity) {
        this.has = entity
        this.solid = true
      },
    }))
  )
  const map = { grid, updateInstanceBucket: () => {} }
  let tick
  let attacks = 0
  const animal = {
    ...actor(),
    x: 0,
    y: 128,
    i: 4,
    j: 4,
    family: 'animal',
    speed: 2,
    context: { map },
    sprite: {
      playing: false,
      play() {
        this.playing = true
      },
    },
    currentCell: grid[4][4],
    path: [],
    getActionCondition: () => true,
    setDest(target) {
      this.dest = target
    },
    startInterval(callback) {
      tick = callback
    },
    stopInterval() {
      tick = null
    },
    getAction: () => attacks++,
    setTextures: () => {},
    applyReliefLift: () => {},
    sendTo: () => {},
  }
  grid[4][4].has = animal
  grid[4][4].solid = true
  const target = { ...actor(), x: 64, y: 128, i: 5, j: 3 }
  if (blocked) grid[4][4].border = true
  const { tryStartAnimalContactApproach } = loadTsModule('app/classes/animal/AnimalContactApproach.ts', {
    mocks: {
      '../../lib/contact/contactGeometry': geometry,
      '../../lib/mapSpaces': { getEntitySpaceMapLike: () => map, sameMapSpace: () => true },
      '../../lib/maths': {
        degreeToDirection: degree => Math.round(degree / 90),
        getGroundReliefLevel: () => 0,
        getInstanceZIndex: entity => entity.y,
        isometricToCartesian: (x, y) => [Math.round(x / 64 + y / 32), Math.round(y / 32 - x / 64)],
      },
      '../../lib/grid/visibility': { updateInstanceVisibility: () => {} },
      '../../lib/units/unitEnergy': { getEnergyMoveSpeedMultiplier: () => 1, updateUnitEnergy: () => {} },
    },
  })
  return {
    animal,
    target,
    start: () => tryStartAnimalContactApproach(animal, target, 'attack'),
    run: () => {
      for (let i = 0; tick && i < 150; i++) tick()
    },
    attacks: () => attacks,
  }
}

test('animal final approach reaches geometric contact without entering its target cell', () => {
  const h = animalApproachHarness()
  assert.equal(h.start(), true)
  h.run()
  assert.equal(h.attacks(), 1)
  assert.equal(geometry.isContactTouching(h.animal, h.target), true)
  assert.equal(h.animal.i, 4)
  assert.equal(h.animal.j, 4)
})

test('animal final approach stops at blocked terrain', () => {
  const h = animalApproachHarness(true)
  assert.equal(h.start(), false)
  assert.equal(h.animal.x, 0)
  assert.equal(h.attacks(), 0)
})

test('animal impact checks contact after windup and does not turn to hit a target behind it', () => {
  let callbacks
  let hits = 0
  const { AnimalCombat } = loadTsModule('app/classes/animal/AnimalCombat.ts', {
    mocks: {
      '../../lib/contact/contactGeometry': geometry,
      '../../lib': {
        SLASH_IMPACT_FRAME: 5,
        applyCombatHit: () => {
          hits++
          return { killed: false }
        },
      },
      '../../lib/combat/combatAttackLoop': {
        runAttackLoopOnFrame: (_animal, value) => {
          callbacks = value
        },
      },
      '../../lib/combat/combatBehavior': { markCombatAttack: () => {} },
      '../../lib/buildings/passageCells': {},
      '../../lib/mapSpaces': {},
      '../../lib/combat/combatFeedback': {},
      './locomotion': {},
    },
  })
  const animal = { ...actor(), family: 'animal', context: {}, sprite: {}, getActionCondition: () => true }
  const target = { ...actor(), x: 30, hitPoints: 20 }
  animal.dest = target
  new AnimalCombat(animal).getAction('attack')
  callbacks.syncMovingTargetDirection()
  assert.equal(callbacks.trackTargetOnRelease, false)
  target.x = -40
  callbacks.onReadyToAttack(target)
  assert.equal(hits, 0)
  target.x = 30
  callbacks.onReadyToAttack(target)
  assert.equal(hits, 1)
})

test('a resource inventory does not make an equipped NPC fight bare handed', () => {
  const { getUnitMeleeWeapon } = loadTsModule('app/lib/combat/unitMelee.ts', {
    mocks: {
      '../equipment/equipmentStats': {
        hasHeroInventoryEquipment: unit => unit.type === 'Hero',
        getEntityMeleeWeapon: unit => unit.equipment?.[0],
        getUnitCombatRange: () => undefined,
      },
    },
  })
  assert.equal(
    getUnitMeleeWeapon({
      type: 'Villager',
      work: 'attacker',
      equipment: ['axe_iron'],
      inventory: { resources: { wood: 5 } },
    }),
    'axe_iron'
  )
  assert.equal(
    getUnitMeleeWeapon({ type: 'Hero', work: 'attacker', inventory: { activeWeapons: { melee: 'sword_iron' } } }),
    undefined
  )
})

test('NPCs adjust their position for hands and tools using the same action contact check', () => {
  const { tryStartUnitContactApproach } = loadTsModule('app/classes/unit/movement/UnitContactApproach.ts', {
    mocks: {
      '../../../lib/actions/contactActions': contacts,
      '../../../lib/contact/contactGeometry': geometry,
      '../../../lib/mapSpaces': { sameMapSpace: () => true },
    },
  })
  for (const action of ['forageberry', 'minestone', 'chopwood']) {
    const target = resource(80)
    let tick
    let started = 0
    const unit = {
      ...actor(),
      speed: 2,
      action,
      dest: target,
      getActionCondition: () => true,
      moveDirect(dx, dy, step) {
        this.x += dx * step
        this.y += dy * step
        return true
      },
      setDest(target) {
        this.dest = target
      },
      startInterval(callback) {
        tick = callback
      },
      stopInterval() {
        tick = null
      },
      getAction: () => started++,
    }
    assert.equal(tryStartUnitContactApproach(unit, target, action), true)
    for (let count = 0; tick && count < 150; count++) tick()
    assert.equal(started, 1)
    assert.equal(contacts.isActionTouchingTarget(unit, target, action), true)
  }
})

test('NPC approach, work animation and impact share real geometry for hands and tools', () => {
  const { tryStartUnitContactApproach } = loadTsModule('app/classes/unit/movement/UnitContactApproach.ts', {
    mocks: { '../../../lib/actions/contactActions': contacts, '../../../lib/mapSpaces': { sameMapSpace: () => true } },
  })
  for (const action of ['forageberry', 'minestone', 'chopwood']) {
    const target = resource(80)
    const h = workHarness(action, target)
    let tick
    let sequence = 0
    Object.assign(h.unit, {
      speed: 2,
      moveDirect(dx, dy, step) {
        this.x += dx * step
        this.y += dy * step
        return true
      },
      setDest(target) {
        this.dest = target
      },
      startInterval(callback) {
        tick = callback
        this.interval = ++sequence
      },
      stopInterval() {
        tick = null
        this.interval = null
      },
      getAction() {
        if (action === 'chopwood') h.actions.handleChopWoodAction()
        else h.actions.startGathering(action === 'minestone' ? 'stone' : 'berry', null)
      },
    })
    assert.equal(tryStartUnitContactApproach(h.unit, target, action), true)
    for (let count = 0; tick && count < 150; count++) tick()
    assert.ok(h.unit.x > 0)
    assert.equal(typeof h.unit.sprite.onFrameChange, 'function')
    h.unit.sprite.onFrameChange(4)
    assert.equal(h.counts().spent, 0)
    h.unit.sprite.onFrameChange(6) // Rendering skipped the exact impact frame.
    assert.equal(h.counts().spent, 1)
    h.unit.sprite.onFrameChange?.(7)
    assert.equal(h.counts().spent, 1)
    if (action === 'chopwood') assert.ok(target.hitPoints < 10)
    else assert.equal(target.quantity, 19)
  }
})

test('stale work frames cannot harvest a replacement target or apply effects after death', () => {
  for (const interruption of ['target', 'action', 'death', 'depletion']) {
    const target = resource(40)
    const h = workHarness('forageberry', target)
    h.actions.startGathering('berry', null)
    const staleFrame = h.unit.sprite.onFrameChange
    if (interruption === 'target') h.unit.dest = resource(40)
    if (interruption === 'action') h.unit.action = 'attack'
    if (interruption === 'death') h.unit.isDead = true
    if (interruption === 'depletion') {
      target.quantity = 0
      h.unit.getActionCondition = () => false
    }
    staleFrame(6)
    assert.equal(h.counts().gained, 0)
    assert.equal(h.counts().spent, 0)
  }
})

function attachAnimalCombat(h) {
  let hits = 0
  const { AnimalCombat } = loadTsModule('app/classes/animal/AnimalCombat.ts', {
    mocks: {
      '../../lib/contact/contactGeometry': geometry,
      '../../lib/contact/contactDebug': { showContactDebug: () => {} },
      '../../lib/combat/combatAttackLoop': attackLoop,
      '../../lib': {
        SLASH_IMPACT_FRAME: 5,
        applyCombatHit: () => {
          hits++
          return { killed: false }
        },
      },
      '../../lib/combat/combatBehavior': { markCombatAttack: () => {} },
      '../../lib/buildings/passageCells': {},
      '../../lib/mapSpaces': {},
      '../../lib/combat/combatFeedback': {},
      './locomotion': {},
    },
  })
  h.target.hitPoints = 20
  h.animal.sprite.gotoAndPlay = () => {}
  h.animal.syncShadow = () => {}
  h.animal.isAnimalAtDest = (_action, target) => geometry.canReachContact(h.animal, target)
  const combat = new AnimalCombat(h.animal)
  h.animal.getAction = action => combat.getAction(action)
  return () => hits
}

test('boar attacks use the five-frame attack sheet after walking, running or idle, then pursue an escaped target', () => {
  for (const previousFrameCount of [6, 5, 4]) {
    const h = animalApproachHarness()
    const hits = attachAnimalCombat(h)
    h.target.x = 30
    h.animal.sprite.textures = Array(previousFrameCount).fill('previous')
    h.animal.setTextures = sheet => {
      if (sheet === 'actionSheet') h.animal.sprite.textures = Array(5).fill('attack')
    }
    let pursuits = 0
    h.animal.sendTo = (target, action, options) => {
      assert.equal(target, h.target)
      assert.equal(action, 'attack')
      assert.equal(options.forceRepath, true)
      pursuits++
    }
    assert.equal(h.start(), true)
    assert.equal(h.animal.sprite.textures.length, 5)
    for (let cycle = 0; cycle < 3; cycle++) {
      for (let frame = 0; frame < 4; frame++) h.animal.sprite.onFrameChange(frame)
      assert.equal(hits(), cycle)
      h.animal.sprite.onFrameChange(4)
      assert.equal(hits(), cycle + 1)
    }
    h.target.x += 200
    for (let frame = 0; frame < 5; frame++) h.animal.sprite.onFrameChange(frame)
    assert.equal(hits(), 3)
    assert.equal(pursuits, 1)
  }
})

test('short work animations still reach their impact and repeat gathering', () => {
  const target = resource(40)
  const h = workHarness('forageberry', target)
  h.unit.setTextures = () => {
    h.unit.sprite.textures = Array(4).fill('work')
  }
  h.actions.startGathering('berry', null)
  for (let cycle = 0; cycle < 3; cycle++) {
    for (let frame = 0; frame < 4; frame++) h.unit.sprite.onFrameChange(frame)
  }
  assert.equal(h.counts().gained, 3)
  assert.equal(target.quantity, 17)
})

test('animal approach, real animation loop and impact obey obstacles, target movement and cancellation', () => {
  for (const scenario of ['hit', 'blocked', 'escaped', 'behind', 'order', 'death']) {
    const h = animalApproachHarness(scenario === 'blocked')
    const hits = attachAnimalCombat(h)
    assert.equal(h.start(), scenario !== 'blocked')
    h.run()
    if (scenario === 'blocked') {
      assert.equal(hits(), 0)
      continue
    }
    const frame = h.animal.sprite.onFrameChange
    assert.equal(typeof frame, 'function')
    frame(4)
    assert.equal(hits(), 0)
    if (scenario === 'escaped') h.target.x += 100
    if (scenario === 'behind') h.target.x = h.animal.x - 25
    if (scenario === 'order') h.animal.dest = { ...h.target }
    if (scenario === 'death') h.animal.isDead = true
    frame(6)
    frame(7)
    assert.equal(hits(), scenario === 'hit' ? 1 : 0, scenario)
  }
})

test('NPC sword approach reaches contact before the real attack loop, and interrupted windup cannot hit', () => {
  let hits = 0
  const { UnitCombat } = loadTsModule('app/classes/unit/UnitCombat.ts', {
    mocks: {
      '../../lib/contact/contactGeometry': geometry,
      '../../lib/contact/contactDebug': { showContactDebug: () => {} },
      '../../lib/combat/combatAttackLoop': attackLoop,
      '../../lib/combat/unitMelee': { usesMeleeAttack: () => true, getUnitMeleeWeapon: unit => unit.equipment?.[0] },
      '../../lib': {
        SLASH_IMPACT_FRAME: 5,
        playAudibleSoundCue: () => {},
        applyCombatHit: () => {
          hits++
          return { killed: false }
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
      '../../lib/units/unitVisualTransition': {
        setUnitVisualSheet: unit => {
          unit.sprite.currentFrame = 0
        },
      },
      '../../lib/combat/combatFeedback': {},
      '../../lib/units/unitControl': {},
      '../Projectile': {},
    },
  })
  const { tryStartUnitContactApproach } = loadTsModule('app/classes/unit/movement/UnitContactApproach.ts', {
    mocks: { '../../../lib/actions/contactActions': contacts, '../../../lib/mapSpaces': { sameMapSpace: () => true } },
  })
  for (const scenario of ['hit', 'blocked', 'order', 'escaped']) {
    hits = 0
    let tick
    const target = { ...actor(), x: 64, hitPoints: 20 }
    const unit = {
      ...actor(),
      speed: 2,
      sprite: {},
      dest: target,
      action: 'attack',
      getActionCondition: () => true,
      isUnitAtDest: (action, target) => contacts.canReachActionTarget(unit, target, action),
      setDest(target) {
        this.dest = target
      },
      startInterval(callback) {
        tick = callback
      },
      stopInterval() {
        tick = null
      },
      moveDirect(dx, dy, step) {
        if (scenario === 'blocked') return false
        this.x += dx * step
        this.y += dy * step
        return true
      },
      getAction() {
        new UnitCombat(this).handleAttackAction()
      },
    }
    assert.equal(tryStartUnitContactApproach(unit, target, 'attack'), scenario !== 'blocked')
    for (let count = 0; tick && count < 150; count++) tick()
    if (scenario === 'blocked') {
      assert.equal(hits, 0)
      continue
    }
    const frame = unit.sprite.onFrameChange
    assert.equal(typeof frame, 'function')
    frame(4)
    assert.equal(hits, 0)
    if (scenario === 'order') unit.action = 'forageberry'
    if (scenario === 'escaped') target.x += 100
    frame(6)
    frame(7)
    assert.equal(hits, scenario === 'hit' ? 1 : 0, scenario)
  }
})
