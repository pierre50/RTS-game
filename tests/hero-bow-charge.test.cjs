const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')

function loadHeroTools() {
  const filename = path.join(__dirname, '../app/lib/heroTools.ts')
  const source = fs.readFileSync(filename, 'utf8')
  const { code } = babel.transformSync(source, {
    filename,
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }], '@babel/preset-typescript'],
  })
  const module = { exports: {} }
  class Projectile {
    constructor(options) {
      Object.assign(this, options)
    }
  }
  const mocks = {
    'pixi.js': { Assets: { cache: { get: id => ({ id, textures: [], data: {} }) } } },
    '../constants': {
      ACTION_TYPES: { delivery: 'delivery', attack: 'attack' },
      BUILDING_TYPES: { dock: 'Dock', townCenter: 'TownCenter' },
      CELL_HEIGHT: 32,
      CELL_WIDTH: 64,
      FAMILY_TYPES: { animal: 'animal', building: 'building', unit: 'unit' },
      SHEET_TYPES: { action: 'actionSheet', standing: 'standingSheet', walking: 'walkingSheet' },
      SOUND_CUES: { hero: { meleeWhiff: 'meleeWhiff' } },
      WORK_TYPES: {
        attacker: 'attacker',
        builder: 'builder',
        fisher: 'fisher',
        hunter: 'hunter',
        goldminer: 'goldminer',
        stoneminer: 'stoneminer',
        woodcutter: 'woodcutter',
      },
    },
    './combat': { getActionCondition: () => false, getHitPointsWithDamage: () => 0 },
    './grid/visibility': { findInstancesInSight: () => [] },
    './grid/queries': { getClosestInstanceWithPath: () => null },
    './graphics': {
      SHOOT_RELEASE_FRAME: 5,
      SLASH_IMPACT_FRAME: 1,
      onSpriteLoopAtFrame: (sprite, frame, cb) => {
        sprite.onFrameChange = currentFrame => {
          if (currentFrame >= frame) cb()
        }
      },
    },
    './maths': {
      degreeToDirection: degree => (degree < 180 ? 'north' : 'south'),
      getInstanceDegree: (_hero, x) => x,
      getReliefOffset: () => 0,
    },
    './sound': { playAudibleSoundCue: () => {} },
    './combatFeedback': { showDamageFeedback: () => {} },
    './unitExperience': {
      getCombatXpBonus: () => 0,
      grantUnitXp: () => {},
      XP_CATEGORIES: { melee: 'melee' },
      XP_KILL_BONUS: 0,
    },
    '../classes/Projectile': { Projectile },
  }
  const localRequire = request => (Object.hasOwn(mocks, request) ? mocks[request] : require(request))
  new Function('module', 'exports', 'require', code)(module, module.exports, localRequire)
  return module.exports
}

function makeSprite() {
  return {
    currentFrame: 0,
    textures: Array.from({ length: 13 }, (_, index) => ({ index })),
    loop: false,
    playing: false,
    onComplete: null,
    onFrameChange: null,
    playCalls: 0,
    stopCalls: 0,
    play() {
      this.playing = true
      this.playCalls++
    },
    stop() {
      this.playing = false
      this.stopCalls++
    },
    gotoAndPlay(frame) {
      this.currentFrame = frame
      this.play()
    },
    gotoAndStop(frame) {
      this.currentFrame = frame
      this.stop()
    },
  }
}

function makeHero() {
  const projectiles = []
  const hero = {
    actionLocked: false,
    context: { map: { addChild: projectile => projectiles.push(projectile) } },
    currentSheet: 'standingSheet',
    degree: 0,
    height: 0,
    hitPoints: 10,
    isDead: false,
    isDestroyed: false,
    label: 'hero',
    owner: { isPlayed: true },
    sprite: makeSprite(),
    width: 0,
    x: 0,
    y: 0,
    drawRatios: [],
    drawHeroPowerBar(ratio) {
      this.drawRatios.push(ratio)
    },
    removeHeroPowerBar() {
      this.powerBarRemoved = true
    },
    setTextures(sheet) {
      this.currentSheet = sheet
      this.sprite.play()
    },
    syncAppearanceLayers() {},
    syncShadow() {},
  }
  return { hero, projectiles }
}

test('bow charge plays the action animation once while power keeps charging', () => {
  const { aimHeroBowChargeAt, triggerToolAttackAt, updateHeroBowCharge } = loadHeroTools()
  const { hero } = makeHero()
  let now = 1000
  const originalPerformance = global.performance
  global.performance = { now: () => now }

  try {
    assert.equal(triggerToolAttackAt(hero, 'bow', { x: 10, y: 20 }), true)
    assert.equal(hero.sprite.loop, false)
    assert.equal(hero.sprite.onComplete, undefined)

    hero.sprite.playing = false
    hero.sprite.currentFrame = 4
    hero.sprite.onFrameChange(4)
    now += 100
    updateHeroBowCharge(hero)

    assert.equal(hero.sprite.loop, false)
    assert.equal(hero.sprite.playing, false)
    assert.equal(hero.sprite.currentFrame, 4)
    assert.equal(hero.heroBowChargeVisualLocked, true)
    assert.ok(hero.drawRatios.at(-1) < 1)

    aimHeroBowChargeAt(hero, { x: 220, y: 20 })
    assert.equal(hero.sprite.loop, false)
    assert.equal(hero.sprite.playing, false)
    assert.equal(hero.sprite.currentFrame, 4)
  } finally {
    global.performance = originalPerformance
  }
})

test('bow release freezes power at mouse-up while waiting for release frame', () => {
  const { releaseHeroBowCharge, triggerToolAttackAt, updateHeroBowCharge } = loadHeroTools()
  const { hero, projectiles } = makeHero()
  let now = 2000
  const originalPerformance = global.performance
  global.performance = { now: () => now }

  try {
    triggerToolAttackAt(hero, 'bow', { x: 10, y: 20 })
    hero.sprite.currentFrame = 1
    now += 70
    assert.equal(releaseHeroBowCharge(hero), true)
    const releasePower = hero.heroBowReleasePower
    assert.ok(releasePower > 0 && releasePower < 0.2)

    now += 600
    updateHeroBowCharge(hero)
    assert.equal(hero.heroBowReleasePower, releasePower)
    assert.equal(hero.drawRatios.at(-1), releasePower)
    assert.equal(projectiles.length, 0)

    hero.sprite.currentFrame = 5
    hero.sprite.onFrameChange?.(5)

    assert.equal(projectiles.length, 1)
    assert.equal(projectiles[0].maxDistance, Math.hypot(64, 32) * 4 * 0.2)
  } finally {
    global.performance = originalPerformance
  }
})
