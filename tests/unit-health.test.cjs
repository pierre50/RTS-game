const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')

function loadUnitHealth() {
  const filename = path.join(__dirname, '../app/lib/unitHealth.ts')
  const source = fs.readFileSync(filename, 'utf8')
  const { code } = babel.transformSync(source, {
    filename,
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }], '@babel/preset-typescript'],
  })
  const module = { exports: {} }
  const healingFeedbackCalls = []
  const mocks = {
    '../constants': { STEP_TIME: 100 },
    './combatFeedback': { showHealingFeedback: unit => healingFeedbackCalls.push(unit) },
    './unitControl': { isHeroControlled: unit => unit.controlMode === 'hero' },
  }
  const localRequire = request => (Object.hasOwn(mocks, request) ? mocks[request] : require(request))
  new Function('module', 'exports', 'require', code)(module, module.exports, localRequire)
  module.exports.__healingFeedbackCalls = healingFeedbackCalls
  return module.exports
}

test('hero health regen respects delay and refreshes the HUD progressively', () => {
  const { __healingFeedbackCalls, markUnitHealthDamaged, updateUnitHealthRegen } = loadUnitHealth()
  const calls = []
  const unit = {
    controlMode: 'hero',
    hitPoints: 7,
    totalHitPoints: 10,
    healthRegenRate: 2,
    healthRegenDelay: 500,
    context: {
      controls: {},
      menu: { updateHeroStatus: hero => calls.push(hero.hitPoints) },
      scheduler: { elapsedMs: 1000 },
    },
  }
  unit.context.controls.heroUnit = unit

  markUnitHealthDamaged(unit)
  assert.deepEqual(calls, [7])

  unit.context.scheduler.elapsedMs = 1200
  updateUnitHealthRegen(unit, 1000)
  assert.equal(unit.hitPoints, 7)
  assert.deepEqual(calls, [7])
  assert.deepEqual(__healingFeedbackCalls, [])

  unit.context.scheduler.elapsedMs = 1600
  updateUnitHealthRegen(unit, 100)
  assert.equal(unit.hitPoints, 7.2)
  assert.deepEqual(calls, [7, 7.2])
  assert.deepEqual(__healingFeedbackCalls, [unit])
})

test('non hero units do not receive passive health regen by default', () => {
  const { updateUnitHealthRegen } = loadUnitHealth()
  const unit = {
    controlMode: 'rts',
    hitPoints: 7,
    totalHitPoints: 10,
    context: { scheduler: { elapsedMs: 1000 } },
  }

  updateUnitHealthRegen(unit, 1000)

  assert.equal(unit.hitPoints, 7)
  assert.equal(unit.healthRegenRate, undefined)
})
