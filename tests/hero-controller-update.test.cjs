const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function loadHeroControllerUpdate({ heroToolsOverride = {}, sprintOverride = {} } = {}) {
  const heroTools = {
    aimHeroDefenseAt: () => false,
    aimHeroPowerChargeAt: () => false,
    beginHeroDefense: () => false,
    canHeroDefendWithTool: () => false,
    isHeroPowerChargeActiveForTool: () => false,
    updateHeroDefense: () => {},
    updateHeroPowerCharge: () => {},
    ...heroToolsOverride,
  }
  return loadTsModule('app/controllers/HeroControllerUpdate.ts', {
    mocks: {
      '../constants': {
        HERO_ACTION_MOVE_SPEED_FACTOR: 0,
        HERO_MELEE_CHARGE_MOVE_SPEED_FACTOR: 0.55,
        HERO_STEALTH_SPEED_FACTOR: 0.55,
        SHEET_TYPES: { action: 'actionSheet', standing: 'standingSheet', walking: 'walkingSheet' },
        STEP_TIME: 100,
      },
      '../lib/hero/heroTools': heroTools,
      '../lib/units/visuals/unitCrouchPose': { applyUnitCrouchPose: () => {} },
      '../lib/npc/npcInteraction': {
        updateNpcFollow: () => {},
      },
      '../lib/units/movement/unitSprint': {
        getSprintMoveFactor: () => 1,
        recordSprintMovement() {},
        stopUnitSprint() {},
        toggleHeroSprint() {},
        ...sprintOverride,
      },
      '../lib/units/unitEnergy': {
        getEnergyMoveSpeedMultiplier: () => 1,
        updateUnitEnergy: unit => {
          unit.energyUpdated = true
        },
      },
      '../lib/units/movement/unitLocomotion': {
        composeMoveSpeedFactor: (...factors) => factors.reduce((value, factor) => value * factor, 1),
        getUnitWalkSpeedFactor: () => 1,
        isUnitWalkSpeedFactor: factor => factor < 1,
      },
      '../lib/units/visuals/unitWalkingAnimation': {
        applyUnitWalkingAnimationSpeed: (unit, factor) => {
          unit.walkAnimationUpdated = factor
        },
      },
      './HeroControllerSupport': {
        TARGET_FRAME_MS: 16.6667,
        debugHeroMove: () => {},
        getKeyboardMoveVector: keys => ({
          dx: keys.has('heroRight') ? 1 : 0,
          dy: 0,
        }),
        getVectorFromDegree: () => ({ dx: 1, dy: 0 }),
      },
    },
  })
}

function createController(hero) {
  const calls = []
  return {
    calls,
    controller: {
      commCharging: true,
      controls: {
        context: {
          menu: {
            updateHeroStatus: unit => calls.push(['updateHeroStatus', unit.label]),
          },
          paused: false,
        },
        getCellUnderCursor: () => null,
        getGamepadMoveVector: () => ({ dx: 0, dy: 0 }),
        getWorldPointUnderCursor: () => ({ x: 0, y: 0 }),
        isHeroStealthMode: () => false,
        shiftKeyActive: false,
      },
      defenseHeld: true,
      equippedItem: 'interact',
      heroUnit: hero,
      interactInputOwner: 'mouse',
      keysPressed: new Set(['heroRight']),
      mouseHeld: true,
      pendingGoToNpcs: null,
      primaryClickPoint: { x: 5, y: 5 },
      wasMoving: true,
      attackTowardPoint: () => {
        calls.push(['attackTowardPoint'])
        return false
      },
      facePoint: () => calls.push(['facePoint']),
      updateCommIndicator: () => calls.push(['updateCommIndicator']),
      updateCriticalHealthEffects: () => calls.push(['updateCriticalHealthEffects']),
      updateOcclusionFade: () => calls.push(['updateOcclusionFade']),
      updateProximityInteractionPrompt: () => calls.push(['updateProximityInteractionPrompt']),
    },
  }
}

test('dead hero runtime update does not restart movement or action visuals', () => {
  const { updateHeroControllerRuntime } = loadHeroControllerUpdate()
  const textureCalls = []
  const hero = {
    currentSheet: 'dyingSheet',
    isDead: true,
    isDestroyed: false,
    isDirectMoving: true,
    label: 'hero',
    setTextures: sheet => textureCalls.push(sheet),
    sprite: {
      play: () => textureCalls.push('play'),
      stop: () => textureCalls.push('stop'),
    },
    syncMountedHorseSpriteCalls: 0,
    syncMountedHorseSprite() {
      this.syncMountedHorseSpriteCalls += 1
    },
  }
  const { calls, controller } = createController(hero)

  updateHeroControllerRuntime(controller, 1)

  assert.deepEqual(textureCalls, [])
  assert.deepEqual(calls, [])
  assert.equal(hero.energyUpdated, undefined)
  assert.equal(hero.isDirectMoving, false)
  assert.equal(hero.syncMountedHorseSpriteCalls, 1)
  assert.equal(controller.wasMoving, false)
  assert.equal(controller.mouseHeld, false)
  assert.equal(controller.defenseHeld, false)
  assert.equal(controller.primaryClickPoint, null)
  assert.equal(controller.interactInputOwner, null)
})

test('exhausted held defense gives movement visuals back to walking', () => {
  const textureCalls = []
  const { updateHeroControllerRuntime } = loadHeroControllerUpdate({
    heroToolsOverride: {
      canHeroDefendWithTool: tool => tool === 'sword',
      beginHeroDefense: () => {
        throw new Error('defense should wait for a new key press after exhaustion')
      },
      updateHeroDefense: hero => {
        hero.heroDefenseActive = false
        hero.heroDefenseEnergyExhausted = true
        hero.actionLocked = false
      },
    },
  })
  const hero = {
    actionLocked: true,
    currentSheet: 'actionSheet',
    degree: 0,
    energy: 0,
    heroDefenseActive: true,
    heroDefenseEnergyExhausted: false,
    isDead: false,
    isDestroyed: false,
    label: 'hero',
    mountedOnHorse: false,
    setTextures(sheet) {
      this.currentSheet = sheet
      textureCalls.push(sheet)
    },
    speed: 10,
    sprite: {
      playing: false,
      play: () => textureCalls.push('play'),
      stop: () => textureCalls.push('stop'),
    },
    syncMountedHorseSprite() {},
    moveDirect(dx, _dy, distance) {
      this.x = (this.x ?? 0) + dx * distance
      return true
    },
    x: 0,
    y: 0,
  }
  const { controller } = createController(hero)
  controller.equippedItem = 'sword'
  controller.defenseHeld = true
  controller.keysPressed = new Set(['heroRight'])

  updateHeroControllerRuntime(controller, 1)

  assert.deepEqual(textureCalls, ['walkingSheet', 'play'])
  assert.equal(hero.currentSheet, 'walkingSheet')
  assert.equal(hero.walkAnimationUpdated, 1)
  assert.equal(hero.heroDefenseEnergyExhausted, true)
  assert.equal(controller.wasMoving, true)
})

test('exhausted held defense without movement returns to standing until key release', () => {
  const textureCalls = []
  const { updateHeroControllerRuntime } = loadHeroControllerUpdate({
    heroToolsOverride: {
      canHeroDefendWithTool: tool => tool === 'sword',
      beginHeroDefense: () => {
        throw new Error('held defense should not restart after exhaustion')
      },
      updateHeroDefense: hero => {
        hero.heroDefenseActive = false
        hero.heroDefenseEnergyExhausted = true
        hero.actionLocked = false
      },
    },
  })
  const hero = {
    actionLocked: true,
    currentSheet: 'actionSheet',
    degree: 0,
    energy: 0,
    heroDefenseActive: true,
    heroDefenseEnergyExhausted: false,
    isDead: false,
    isDestroyed: false,
    label: 'hero',
    mountedOnHorse: false,
    setTextures(sheet) {
      this.currentSheet = sheet
      textureCalls.push(sheet)
    },
    speed: 10,
    sprite: {
      playing: false,
      play: () => textureCalls.push('play'),
      stop: () => textureCalls.push('stop'),
    },
    syncMountedHorseSprite() {},
    x: 0,
    y: 0,
  }
  const { controller } = createController(hero)
  controller.equippedItem = 'sword'
  controller.defenseHeld = true
  controller.keysPressed = new Set()
  controller.wasMoving = false

  updateHeroControllerRuntime(controller, 1)

  assert.deepEqual(textureCalls, ['standingSheet', 'stop'])
  assert.equal(hero.currentSheet, 'standingSheet')
  assert.equal(hero.heroDefenseEnergyExhausted, true)
  assert.equal(controller.wasMoving, false)
})

test('newly started held defense keeps the block visual instead of immediately switching to walk', () => {
  const textureCalls = []
  const { updateHeroControllerRuntime } = loadHeroControllerUpdate({
    heroToolsOverride: {
      beginHeroDefense: hero => {
        hero.actionLocked = true
        hero.heroDefenseActive = true
        hero.currentSheet = 'actionSheet'
        textureCalls.push('actionSheet')
        return true
      },
      canHeroDefendWithTool: tool => tool === 'sword',
    },
  })
  const hero = {
    actionLocked: false,
    currentSheet: 'standingSheet',
    degree: 0,
    isDead: false,
    isDestroyed: false,
    label: 'hero',
    mountedOnHorse: false,
    setTextures(sheet) {
      this.currentSheet = sheet
      textureCalls.push(sheet)
    },
    speed: 10,
    sprite: {
      playing: false,
      play: () => textureCalls.push('play'),
      stop: () => textureCalls.push('stop'),
    },
    syncMountedHorseSprite() {},
    moveDirect(dx, _dy, distance) {
      this.x = (this.x ?? 0) + dx * distance
      return true
    },
    x: 0,
    y: 0,
  }
  const { controller } = createController(hero)
  controller.equippedItem = 'sword'
  controller.defenseHeld = true
  controller.keysPressed = new Set(['heroRight'])

  updateHeroControllerRuntime(controller, 1)

  assert.deepEqual(textureCalls, ['actionSheet'])
  assert.equal(hero.currentSheet, 'actionSheet')
  assert.equal(hero.walkAnimationUpdated, undefined)
  assert.equal(controller.wasMoving, false)
})

test('awake hero stays injured after time passes, even with legacy saved regen settings', () => {
  const { updateHeroControllerRuntime } = loadHeroControllerUpdate()
  const hero = {
    controlMode: 'hero',
    hitPoints: 7,
    totalHitPoints: 10,
    healthRegenRate: 2,
    healthRegenDelay: 0,
    healthRegenMultiplier: 1,
    speed: 10,
    currentSheet: 'standingSheet',
    sprite: { stop() {} },
    setTextures() {},
  }
  const { controller } = createController(hero)
  hero.context = controller.controls.context
  hero.context.controls = { heroUnit: hero }
  hero.context.scheduler = { elapsedMs: 60000 }
  controller.keysPressed.clear()
  controller.mouseHeld = false
  updateHeroControllerRuntime(controller, 60)
  assert.equal(hero.hitPoints, 7)
  assert.equal(hero.energyUpdated, true)
})

test('actual hero movement accelerates and spends energy; blocked movement cannot earn an attack bonus', () => {
  const sprint = loadTsModule('app/lib/units/movement/unitSprint.ts')
  const { updateHeroControllerRuntime } = loadHeroControllerUpdate({ sprintOverride: sprint })
  for (const blocked of [false, true]) {
    const hero = {
      energy: 10,
      totalEnergy: 10,
      speed: 100,
      x: 0,
      y: 0,
      i: 0,
      j: 0,
      currentSheet: 'standingSheet',
      context: { scheduler: { elapsedMs: 0 } },
      sprite: { play() {}, stop() {} },
      setTextures(sheet) {
        this.currentSheet = sheet
      },
      moveDirect(dx, dy, distance) {
        if (!blocked) {
          this.x += dx * distance
          this.y += dy * distance
        }
        return !blocked
      },
    }
    const { controller } = createController(hero)
    controller.equippedItem = 'sword'
    controller.mouseHeld = false
    controller.defenseHeld = false
    controller.interactInputOwner = null
    sprint.toggleHeroSprint(hero)
    for (let frame = 0; frame < 24; frame++) {
      hero.context.scheduler.elapsedMs += 16.6667
      updateHeroControllerRuntime(controller, 1)
    }
    if (blocked) {
      assert.equal(hero.energy, 10)
      assert.equal(sprint.takeSprintAttackMultiplier(hero), 1)
    } else {
      assert.ok(Math.abs(hero.x - 24 * 16.6667 * 1.6) < 1e-5)
      assert.ok(hero.energy < 10)
      assert.equal(hero.walkAnimationUpdated, 1.6)
      assert.equal(sprint.takeSprintAttackMultiplier(hero), 1.35)
    }
  }
})
