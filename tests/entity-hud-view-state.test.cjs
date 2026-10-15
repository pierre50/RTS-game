const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

const constants = {
  FAMILY_TYPES: { unit: 'unit', animal: 'animal', building: 'building' },
  LABEL_TYPES: { healthBar: 'healthBar', energyBar: 'energyBar', powerBar: 'powerBar' },
  HEALTH_BAR_BORDER_COLOR: 1,
  HEALTH_BAR_TRACK_GRADIENT_TOP: 2,
  HEALTH_BAR_TRACK_GRADIENT_BOTTOM: 3,
  HEALTH_BAR_FILL_GRADIENT_TOP: 4,
  HEALTH_BAR_FILL_GRADIENT_BOTTOM: 5,
  ENERGY_BAR_BORDER_COLOR: 6,
  ENERGY_BAR_TRACK_GRADIENT_TOP: 7,
  ENERGY_BAR_TRACK_GRADIENT_BOTTOM: 8,
  ENERGY_BAR_FILL_GRADIENT_TOP: 9,
  ENERGY_BAR_FILL_GRADIENT_BOTTOM: 10,
  COLOR_GOLD: 11,
}

test('HUD state gives renderers visibility and ratios without Pixi objects', () => {
  const { healthBarState, energyBarState, heroPowerBarState } = loadTsModule('app/rendering/EntityHudBars.ts', {
    mocks: { '../constants': constants, '../lib/chief': { heroCanCommand: hero => Boolean(hero?.isChief) } },
  })
  const host = {
    label: 'unit-1',
    family: 'unit',
    owner: { isPlayed: true, team: 1 },
    context: { controls: { heroUnit: { label: 'hero', isChief: true, owner: { team: 1 } } } },
    selected: true,
    isDead: false,
    isDestroyed: false,
    hitPoints: 5,
    totalHitPoints: 10,
    energy: 3,
    totalEnergy: 12,
    shouldKeepHealthBarVisible: () => true,
    shouldKeepEnergyBarVisible: () => true,
  }
  assert.deepEqual(healthBarState(host), { visible: true, ratio: 0.5 })
  assert.deepEqual(energyBarState(host), { visible: true, ratio: 0.25 })
  assert.deepEqual(heroPowerBarState(host, 1.5), { visible: true, ratio: 1 })
  host.context.controls.heroUnit.isChief = false
  assert.deepEqual(healthBarState(host), { visible: false, ratio: 0, removeImmediately: true })
  host.family = 'animal'
  host.isDead = true
  assert.deepEqual(healthBarState(host), { visible: true, ratio: 0 })
  host.family = 'building'
  assert.deepEqual(healthBarState(host), { visible: false, ratio: 0 })
})

test('Pixi HUD attaches bars to an entity view instead of container proxies', () => {
  class Graphics {
    constructor() { this.position = { y: 0 } }
    rect() { return this }
    fill() { return this }
  }
  class FillGradient {}
  const displayObject = {
    children: [],
    getChildByLabel(label) { return this.children.find(child => child.label === label) ?? null },
    addChild(child) { this.children.push(child); child.parent = this; return child },
    removeChild(child) { this.children.splice(this.children.indexOf(child), 1); child.parent = null; return child },
  }
  const host = {
    label: 'unit-1',
    family: 'unit',
    selected: true,
    isDead: false,
    isDestroyed: false,
    hitPoints: 5,
    totalHitPoints: 10,
    sprite: { height: 40, anchor: { y: 1 } },
    displayObject,
    getChildByLabel() { assert.fail('entity must not query its Pixi children') },
    addChild() { assert.fail('entity must not add Pixi children') },
    removeChild() { assert.fail('entity must not remove Pixi children') },
    shouldKeepHealthBarVisible: () => true,
    shouldKeepEnergyBarVisible: () => false,
  }
  const { drawInstanceHealthBar, removeInstanceHudBar } = loadTsModule('app/rendering/pixi/PixiEntityHudBars.ts', {
    mocks: {
      'pixi.js': { Graphics, FillGradient },
      '../../constants': constants,
      '../../lib/entities/entityHudPosition': { getEntityHudTopY: () => -30 },
      '../../lib/entities/hudFade': { HUD_FADE_MS: 100, HUD_FADE_STEP_MS: 10 },
      '../../lib/chief': { heroCanCommand: () => true },
    },
  })
  drawInstanceHealthBar(host)
  assert.equal(displayObject.children.length, 1)
  assert.equal(displayObject.children[0].label, 'healthBar')
  removeInstanceHudBar(host, 'healthBar')
  assert.equal(displayObject.children.length, 0)
})
