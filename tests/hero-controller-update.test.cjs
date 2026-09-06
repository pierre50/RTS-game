const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function loadHeroControllerUpdate({ heroToolsOverride = {} } = {}) {
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
      '../lib/hero/heroCursor': { updateHeroCursor: () => {} },
      '../lib/units/unitCrouchPose': { applyUnitCrouchPose: () => {} },
      '../lib/npc/npcGoToCursor': { resolveNpcGoToCursorState: () => null },
      '../lib/npc/npcInteraction': {
        resolveHoverTarget: () => null,
        updateNpcFollow: () => {},
      },
      '../lib/units/unitEnergy': {
        getEnergyMoveSpeedMultiplier: () => 1,
        updateUnitEnergy: unit => {
          unit.energyUpdated = true
        },
      },
      '../lib/units/unitHealth': {
        updateUnitHealthRegen: unit => {
          unit.healthUpdated = true
        },
      },
      '../lib/units/unitLocomotion': {
        composeMoveSpeedFactor: (...factors) => factors.reduce((value, factor) => value * factor, 1),
        getUnitWalkSpeedFactor: () => 1,
        isUnitWalkSpeedFactor: factor => factor < 1,
      },
      '../lib/units/unitWalkingAnimation': {
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
        getLockedMoveSpeedFactor: () => 1,
        getVectorFromDegree: () => ({ dx: 1, dy: 0 }),
        isHeroDirectionLockActive: () => false,
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
      shiftMoveLockedDegree: null,
      wasMoving: true,
      attackTowardPoint: () => {
        calls.push(['attackTowardPoint'])
        return false
      },
      facePoint: () => calls.push(['facePoint']),
      getShiftMoveLockedAimPoint: () => null,
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
  assert.equal(hero.healthUpdated, undefined)
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
