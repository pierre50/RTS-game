const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')

function loadUnitEnergy() {
  const filename = path.join(__dirname, '../app/lib/unitEnergy.ts')
  const source = fs.readFileSync(filename, 'utf8')
  const { code } = babel.transformSync(source, {
    filename,
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }], '@babel/preset-typescript'],
  })
  const module = { exports: {} }
  const fatigueFeedbackCalls = []
  const mocks = {
    '../constants': {
      ACTION_TYPES: {
        attack: 'attack',
        build: 'build',
        chopwood: 'chopwood',
        convert: 'convert',
        farm: 'farm',
        fishing: 'fishing',
        forageberry: 'forageberry',
        heal: 'heal',
        hunt: 'hunt',
        minegold: 'minegold',
        minestone: 'minestone',
        takemeat: 'takemeat',
      },
      SHEET_TYPES: { standing: 'standingSheet' },
      STEP_TIME: 100,
    },
    './combatFeedback': { showFatigueFeedback: unit => fatigueFeedbackCalls.push(unit) },
    './lang': { t: key => key },
    './unitControl': { isHeroControlled: unit => unit.controlMode === 'arpg' },
  }
  const localRequire = request => (Object.hasOwn(mocks, request) ? mocks[request] : require(request))
  new Function('module', 'exports', 'require', code)(module, module.exports, localRequire)
  module.exports.__fatigueFeedbackCalls = fatigueFeedbackCalls
  return module.exports
}

test('spending energy records cost and regen respects delay', () => {
  const { spendEnergyForAction, updateUnitEnergy } = loadUnitEnergy()
  const unit = {
    context: { scheduler: { elapsedMs: 1000 } },
    energy: 3,
    totalEnergy: 10,
    energyRegenRate: 2,
    energyRegenDelay: 500,
  }

  assert.equal(spendEnergyForAction(unit, 'attack'), true)
  assert.equal(unit.energy, 1)
  assert.equal(unit.lastEnergySpentAt, 1000)

  unit.context.scheduler.elapsedMs = 1200
  updateUnitEnergy(unit, 1000)
  assert.equal(unit.energy, 1)

  unit.context.scheduler.elapsedMs = 1600
  updateUnitEnergy(unit, 1000)
  assert.equal(unit.energy, 3)
})

test('work energy costs reflect action effort', () => {
  const { getActionEnergyCost, spendEnergyForAction } = loadUnitEnergy()
  const unit = { energy: 10, totalEnergy: 10 }

  assert.equal(getActionEnergyCost(unit, 'minegold'), 3)
  assert.equal(getActionEnergyCost(unit, 'minestone'), 3)
  assert.equal(getActionEnergyCost(unit, 'chopwood'), 2)
  assert.equal(getActionEnergyCost(unit, 'build'), 2)
  assert.equal(getActionEnergyCost(unit, 'fishing'), 1)
  assert.equal(getActionEnergyCost(unit, 'forageberry'), 0.75)
  assert.equal(getActionEnergyCost(unit, 'takemeat'), 0.5)

  assert.equal(spendEnergyForAction(unit, 'takemeat'), true)
  assert.equal(unit.energy, 9.5)
  assert.equal(spendEnergyForAction(unit, 'minegold'), true)
  assert.equal(unit.energy, 6.5)
})

test('npc waits for full energy before resuming an action', () => {
  const { __fatigueFeedbackCalls, resumeEnergyWaitIfReady, waitForEnergy } = loadUnitEnergy()
  const calls = []
  const target = { family: 'resource', isDestroyed: false, isDead: false }
  const unit = {
    action: 'chopwood',
    context: { scheduler: { elapsedMs: 0 } },
    dest: target,
    energy: 0,
    totalEnergy: 2,
    energyRegenRate: 20,
    energyRegenDelay: 0,
    sendToEvt: (resumeTarget, action) => calls.push(['sendToEvt', resumeTarget, action]),
    setTextures: sheet => calls.push(['setTextures', sheet]),
    sprite: { stop: () => calls.push(['sprite.stop']) },
    startInterval: () => calls.push(['startInterval']),
    stopInterval: () => calls.push(['stopInterval']),
  }

  assert.equal(waitForEnergy(unit, 'chopwood', target), false)
  assert.equal(unit.waitingForEnergyAction, 'chopwood')
  assert.deepEqual(__fatigueFeedbackCalls, [unit])
  assert.deepEqual(calls.slice(0, 4), [['stopInterval'], ['setTextures', 'standingSheet'], ['sprite.stop'], ['startInterval']])

  unit.context.scheduler.elapsedMs = 100
  assert.equal(resumeEnergyWaitIfReady(unit), true)
  assert.equal(unit.waitingForEnergyAction, null)
  assert.deepEqual(calls.at(-1), ['sendToEvt', target, 'chopwood'])
})

test('hero shows fatigue feedback but does not auto-resume when energy is missing', () => {
  const { __fatigueFeedbackCalls, waitForEnergy } = loadUnitEnergy()
  const messages = []
  const calls = []
  const unit = {
    controlMode: 'arpg',
    context: {
      menu: { showMessage: (message, level) => messages.push([message, level]) },
      scheduler: { elapsedMs: 0 },
    },
    energy: 0,
    totalEnergy: 2,
    startInterval: () => calls.push(['startInterval']),
  }

  assert.equal(waitForEnergy(unit, 'attack'), false)
  assert.equal(unit.waitingForEnergyAction, undefined)
  assert.deepEqual(calls, [])
  assert.deepEqual(__fatigueFeedbackCalls, [unit])
  assert.deepEqual(messages, [['heroNotEnoughEnergy', 'warning']])
})

test('hero energy changes refresh the hero HUD immediately', () => {
  const { spendEnergyForAction, updateUnitEnergy } = loadUnitEnergy()
  const calls = []
  const unit = {
    energy: 10,
    totalEnergy: 10,
    energyRegenRate: 2,
    energyRegenDelay: 0,
    context: {
      controls: {},
      menu: { updateHeroStatus: hero => calls.push(hero.energy) },
      scheduler: { elapsedMs: 1000 },
    },
  }
  unit.context.controls.heroUnit = unit

  assert.equal(spendEnergyForAction(unit, 'takemeat'), true)
  assert.equal(unit.energy, 9.5)
  assert.deepEqual(calls, [9.5])

  unit.context.scheduler.elapsedMs = 1100
  updateUnitEnergy(unit, 100)
  assert.equal(unit.energy, 9.7)
  assert.deepEqual(calls, [9.5, 9.7])
})
