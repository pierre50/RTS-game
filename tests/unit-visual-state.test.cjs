const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function loadUnitVisualState({ shadowsEnabled = true, activeMapSpace = true } = {}) {
  return loadTsModule('app/classes/unit/UnitVisualState.ts', {
    mocks: {
      'pixi.js': {
        AnimatedSprite: class {},
      },
      '../../constants': {
        LABEL_TYPES: { healthBar: 'healthBar', powerBar: 'powerBar', shadow: 'shadow' },
        RELIEF_LIFT_SMOOTHING: 1,
        SHEET_TYPES: { dying: 'dyingSheet', standing: 'standingSheet' },
      },
      '../../lib': {
        bindAnimatedSpriteToTicker: () => {},
        changeSpriteTexturesColorDirectly: textures => textures,
        getReliefLiftPixels: level => level,
        setSpriteFiltersPreservingDamageFeedback: () => {},
      },
      '../../lib/audio/settings': { getShadowsEnabled: () => shadowsEnabled },
      '../../lib/mapSpaces': {
        getEntityMapPoint: () => ({ x: 0, y: 0 }),
        isEntityInActiveMapSpace: () => activeMapSpace,
      },
    },
  })
}

function createSprite({ frame = 0, playing = false, textureCount = 3 } = {}) {
  return {
    animationSpeed: 0.2,
    anchor: {
      x: 0.5,
      y: 1,
      set(x, y) {
        this.x = x
        this.y = y
      },
    },
    currentFrame: frame,
    loop: false,
    playing,
    position: { x: 0, y: 0 },
    scale: { x: 1, y: 1 },
    textures: Array.from({ length: textureCount }, (_, index) => `frame-${index}`),
    gotoAndPlay(nextFrame) {
      this.currentFrame = nextFrame
      this.playing = true
    },
    gotoAndStop(nextFrame) {
      this.currentFrame = nextFrame
      this.playing = false
    },
    play() {
      this.playing = true
    },
  }
}

function createShadow() {
  return {
    anchor: {
      x: 0,
      y: 0,
      set(x, y) {
        this.x = x
        this.y = y
      },
    },
    position: {
      set(x, y) {
        this.x = x
        this.y = y
      },
    },
    scale: { x: 1, y: 1 },
    visible: true,
    gotoAndPlay(frame) {
      this.currentFrame = frame
      this.playing = true
    },
    gotoAndStop(frame) {
      this.currentFrame = frame
      this.playing = false
    },
  }
}

test('sleeping final-frame units do not revive their shadow during visual refreshes', () => {
  const { syncUnitShadow, syncUnitVisualSettings } = loadUnitVisualState()
  const unit = {
    currentSheet: 'dyingSheet',
    isDestroyed: false,
    reliefLift: 0,
    shadow: createShadow(),
    shelterState: { status: 'outside', reason: 'sleep', location: 'outside' },
    sleepVisualState: 'sleeping',
    sprite: createSprite({ frame: 2, playing: false, textureCount: 3 }),
    visible: true,
  }

  unit.shadow.visible = false
  syncUnitVisualSettings(unit)
  assert.equal(unit.shadow.visible, false)

  syncUnitShadow(unit, unit.shadow, unit.sprite)
  assert.equal(unit.shadow.visible, false)
})

test('sleeping hurt animation keeps the shadow until the final stopped frame', () => {
  const { syncUnitShadow } = loadUnitVisualState()
  const unit = {
    currentSheet: 'dyingSheet',
    isDestroyed: false,
    reliefLift: 0,
    shadow: createShadow(),
    shelterState: { status: 'outside', reason: 'sleep', location: 'outside' },
    sleepVisualState: 'sleeping',
    sprite: createSprite({ frame: 1, playing: true, textureCount: 3 }),
    visible: true,
  }

  syncUnitShadow(unit, unit.shadow, unit.sprite)

  assert.equal(unit.shadow.visible, true)
})

test('resuming from pause leaves a frozen sleeping sprite untouched even with a stale loop flag', () => {
  const { resumeUnitVisuals } = loadUnitVisualState()
  const sprite = createSprite({ frame: 2, playing: false, textureCount: 3 })
  // Left over from the unit's last walk (Unit.setPath forces loop = true) — this is exactly the
  // stale state that made a resumed sleeper replay the hurt sheet forever via PIXI's own ticker.
  sprite.loop = true
  const unit = {
    currentSheet: 'dyingSheet',
    shelterState: { status: 'outside', reason: 'sleep', location: 'outside' },
    sleepVisualState: 'sleeping',
    sprite,
  }

  const handled = resumeUnitVisuals(unit)

  assert.equal(handled, true)
  assert.equal(sprite.playing, false)
})

test('true dying units are not treated as sleeping just because they use the dying sheet', () => {
  const { syncUnitShadow, syncUnitVisualSettings } = loadUnitVisualState()
  const unit = {
    currentSheet: 'dyingSheet',
    isDestroyed: false,
    reliefLift: 0,
    shadow: createShadow(),
    shelterState: { status: 'outside', reason: 'sleep', location: 'outside' },
    sleepVisualState: null,
    sprite: createSprite({ frame: 2, playing: false, textureCount: 3 }),
    visible: true,
  }

  unit.shadow.visible = false
  syncUnitVisualSettings(unit)
  assert.equal(unit.shadow.visible, true)

  syncUnitShadow(unit, unit.shadow, unit.sprite)
  assert.equal(unit.shadow.visible, true)
})
