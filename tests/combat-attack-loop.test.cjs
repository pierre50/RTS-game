const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')

function loadCombatAttackLoop(unitEnergyOverrides = {}) {
  const filename = path.join(__dirname, '../app/lib/combatAttackLoop.ts')
  const source = fs.readFileSync(filename, 'utf8')
  const { code } = babel.transformSync(source, {
    filename,
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }], '@babel/preset-typescript'],
  })
  const module = { exports: {} }
  const mocks = {
    './graphics': {
      onSpriteLoopAtFrame: (sprite, _frame, callback) => {
        sprite.onFrameChange = callback
      },
    },
    './maths': { instancesDistance: () => 1 },
    './unitEnergy': {
      hasEnergyForAction: () => true,
      spendOrWaitForEnergy: () => true,
      waitForEnergy: () => false,
      ...unitEnergyOverrides,
    },
  }
  const localRequire = request => (Object.hasOwn(mocks, request) ? mocks[request] : require(request))
  new Function('module', 'exports', 'require', code)(module, module.exports, localRequire)
  return module.exports
}

function makeAttackLoopSubject() {
  const target = {
    family: 'unit',
    hitPoints: 10,
    i: 1,
    isDead: false,
    isDestroyed: false,
    j: 0,
    label: 'target',
  }
  const attacker = {
    action: 'attack',
    dest: target,
    energy: 1,
    family: 'unit',
    i: 0,
    j: 0,
    getActionCondition: checkedTarget => checkedTarget === target,
    isUnitAtDest: () => true,
    sprite: {
      loop: false,
      onComplete: null,
      onFrameChange: null,
      onLoop: null,
    },
  }
  return { attacker, target }
}

test('attack loop waits for energy before preparing attack animation', () => {
  const calls = []
  const { attacker, target } = makeAttackLoopSubject()
  const { runAttackLoopOnFrame } = loadCombatAttackLoop({
    hasEnergyForAction: (unit, action) => {
      calls.push(['hasEnergy', unit, action])
      return false
    },
    waitForEnergy: (unit, action, waitedTarget) => {
      calls.push(['waitForEnergy', unit, action, waitedTarget])
      return false
    },
    spendOrWaitForEnergy: () => {
      calls.push(['spendOrWaitForEnergy'])
      return true
    },
  })

  runAttackLoopOnFrame(attacker, {
    releaseFrame: 1,
    prepareAttackSheet: () => calls.push(['prepareAttackSheet']),
    onOutOfRange: () => calls.push(['outOfRange']),
    onTargetUnavailable: () => calls.push(['targetUnavailable']),
    onReadyToAttack: () => calls.push(['readyToAttack']),
  })

  assert.deepEqual(calls, [
    ['hasEnergy', attacker, 'attack'],
    ['waitForEnergy', attacker, 'attack', target],
  ])
  assert.equal(attacker.sprite.onFrameChange, null)
})

test('attack loop spends energy on the release frame after preparing animation', () => {
  const calls = []
  const { attacker, target } = makeAttackLoopSubject()
  const { runAttackLoopOnFrame } = loadCombatAttackLoop({
    hasEnergyForAction: (unit, action) => {
      calls.push(['hasEnergy', unit, action])
      return true
    },
    spendOrWaitForEnergy: (unit, action, waitedTarget) => {
      calls.push(['spendOrWaitForEnergy', unit, action, waitedTarget])
      return true
    },
  })

  runAttackLoopOnFrame(attacker, {
    releaseFrame: 1,
    prepareAttackSheet: () => calls.push(['prepareAttackSheet']),
    onOutOfRange: () => calls.push(['outOfRange']),
    onTargetUnavailable: () => calls.push(['targetUnavailable']),
    onReadyToAttack: readyTarget => calls.push(['readyToAttack', readyTarget]),
  })
  attacker.sprite.onFrameChange()

  assert.deepEqual(calls, [
    ['hasEnergy', attacker, 'attack'],
    ['prepareAttackSheet'],
    ['hasEnergy', attacker, 'attack'],
    ['spendOrWaitForEnergy', attacker, 'attack', target],
    ['readyToAttack', target],
  ])
})

test('attack loop applies configured recovery before rearming the next swing', () => {
  const calls = []
  const scheduled = []
  const { attacker, target } = makeAttackLoopSubject()
  attacker.attackRecoveryMs = 1000
  attacker.context = {
    scheduler: {
      addOneShot: (callback, time, name) => {
        calls.push(['addOneShot', time, name])
        scheduled.push(callback)
        return 17
      },
      remove: taskId => calls.push(['remove', taskId]),
    },
  }
  const { runAttackLoopOnFrame } = loadCombatAttackLoop()

  runAttackLoopOnFrame(attacker, {
    releaseFrame: 1,
    prepareAttackSheet: () => calls.push(['prepareAttackSheet']),
    prepareRecoverySheet: () => calls.push(['prepareRecoverySheet']),
    onOutOfRange: () => calls.push(['outOfRange']),
    onTargetUnavailable: () => calls.push(['targetUnavailable']),
    onReadyToAttack: readyTarget => calls.push(['readyToAttack', readyTarget]),
  })
  const firstFrameCallback = attacker.sprite.onFrameChange
  firstFrameCallback(1)

  assert.equal(attacker.actionLocked, true)
  assert.equal(attacker.attackRecoveryTaskId, 17)
  assert.equal(attacker.sprite.onFrameChange, undefined)
  assert.equal(typeof attacker.sprite.onLoop, 'function')
  assert.deepEqual(calls, [
    ['prepareAttackSheet'],
    ['readyToAttack', target],
    ['addOneShot', 1000, 'combat.attackRecovery'],
  ])

  scheduled[0]()

  assert.equal(attacker.actionLocked, true)
  assert.equal(attacker.attackRecoveryTaskId, 17)
  assert.deepEqual(calls, [
    ['prepareAttackSheet'],
    ['readyToAttack', target],
    ['addOneShot', 1000, 'combat.attackRecovery'],
  ])

  attacker.sprite.onLoop()

  assert.equal(attacker.actionLocked, false)
  assert.equal(attacker.attackRecoveryTaskId, null)
  assert.equal(typeof attacker.sprite.onFrameChange, 'function')
  assert.equal(attacker.sprite.onLoop, undefined)
  assert.notEqual(attacker.sprite.onFrameChange, firstFrameCallback)
  assert.deepEqual(calls, [
    ['prepareAttackSheet'],
    ['readyToAttack', target],
    ['addOneShot', 1000, 'combat.attackRecovery'],
    ['prepareRecoverySheet'],
    ['prepareAttackSheet'],
  ])
})

test('attack loop skips recovery when the attack callback finishes the action', () => {
  const calls = []
  const { attacker } = makeAttackLoopSubject()
  attacker.attackRecoveryMs = 1000
  attacker.context = {
    scheduler: {
      addOneShot: () => {
        calls.push(['addOneShot'])
        return 1
      },
      remove: () => {},
    },
  }
  const { runAttackLoopOnFrame } = loadCombatAttackLoop()

  runAttackLoopOnFrame(attacker, {
    releaseFrame: 1,
    prepareAttackSheet: () => calls.push(['prepareAttackSheet']),
    onOutOfRange: () => calls.push(['outOfRange']),
    onTargetUnavailable: () => calls.push(['targetUnavailable']),
    onReadyToAttack: () => {
      calls.push(['readyToAttack'])
      return false
    },
  })
  attacker.sprite.onFrameChange(1)

  assert.equal(attacker.actionLocked, undefined)
  assert.equal(attacker.attackRecoveryTaskId, undefined)
  assert.deepEqual(calls, [['prepareAttackSheet'], ['readyToAttack']])
})

test('clearing attack recovery removes the pending scheduler task', () => {
  const calls = []
  const unit = {
    attackRecoveryTaskId: 23,
    context: {
      scheduler: {
        remove: taskId => calls.push(['remove', taskId]),
      },
    },
    sprite: {
      onLoop: () => calls.push(['staleLoop']),
    },
  }
  const { clearCombatAttackRecovery } = loadCombatAttackLoop()

  clearCombatAttackRecovery(unit)

  assert.equal(unit.attackRecoveryTaskId, null)
  assert.equal(unit.sprite.onLoop, undefined)
  assert.deepEqual(calls, [['remove', 23]])
})
