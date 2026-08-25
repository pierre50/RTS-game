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
  const combatBehaviorCalls = []
  const mocks = {
    '../constants': {
      ACTION_TYPES: {
        attack: 'attack',
        build: 'build',
        chopwood: 'chopwood',
        convert: 'convert',
        farm: 'farm',
        flee: 'flee',
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
    './combatBehavior': {
      enterCombatRecovery: (unit, target) => {
        combatBehaviorCalls.push(['enter', unit, target])
        unit.combatMode = 'recover'
        unit.action = null
      },
      exitCombatRecovery: unit => {
        combatBehaviorCalls.push(['exit', unit])
        unit.combatMode = null
      },
      isCombatRecoveryReadyToReengage: unit => (unit.energy ?? 0) >= (unit.totalEnergy ?? 0),
      updateCombatRecoveryMovement: unit => combatBehaviorCalls.push(['update', unit]),
    },
    '../config/gameDifficultyBalance': {
      getGameDifficultyCombatBalance: difficulty => {
        const balances = {
          easy: { enemyAttackEnergyCostMultiplier: 2 },
          medium: { enemyAttackEnergyCostMultiplier: 1 },
          hard: { enemyAttackEnergyCostMultiplier: 0.8 },
        }
        return balances[difficulty] ?? balances.medium
      },
    },
    './lang': { t: key => key },
    './miningActions': { getMiningActions: () => ['minestone', 'minegold'] },
    './unitControl': { isHeroControlled: unit => unit.controlMode === 'arpg' },
  }
  const localRequire = request => (Object.hasOwn(mocks, request) ? mocks[request] : require(request))
  new Function('module', 'exports', 'require', code)(module, module.exports, localRequire)
  module.exports.__fatigueFeedbackCalls = fatigueFeedbackCalls
  module.exports.__combatBehaviorCalls = combatBehaviorCalls
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
  assert.equal(getActionEnergyCost(unit, 'flee'), 0.25)
  assert.equal(getActionEnergyCost(unit, 'forageberry'), 0.75)
  assert.equal(getActionEnergyCost(unit, 'takemeat'), 0.5)

  assert.equal(spendEnergyForAction(unit, 'takemeat'), true)
  assert.equal(unit.energy, 9.5)
  assert.equal(spendEnergyForAction(unit, 'minegold'), true)
  assert.equal(unit.energy, 6.5)
})

test('easy difficulty makes enemy attacks cost more energy against played units', () => {
  const { getActionEnergyCost, spendEnergyForAction } = loadUnitEnergy()
  const playedOwner = { label: 'player', isPlayed: true, isEnemy: targetOwner => targetOwner?.label === 'enemy' }
  const enemyOwner = { label: 'enemy', isEnemy: targetOwner => targetOwner?.label === 'player' }
  const target = { family: 'unit', owner: playedOwner }
  const enemy = {
    action: 'attack',
    context: { map: { difficulty: 'easy' } },
    dest: target,
    energy: 10,
    owner: enemyOwner,
    totalEnergy: 10,
  }
  const playerUnit = {
    action: 'attack',
    context: { map: { difficulty: 'easy' } },
    dest: { family: 'unit', owner: enemyOwner },
    energy: 10,
    owner: playedOwner,
    totalEnergy: 10,
  }

  assert.equal(getActionEnergyCost(enemy, 'attack'), 4)
  assert.equal(spendEnergyForAction(enemy, 'attack'), true)
  assert.equal(enemy.energy, 6)
  assert.equal(getActionEnergyCost(playerUnit, 'attack'), 2)
})

test('generic energy wait can resume an animal through sendTo fallback', () => {
  const { resumeEnergyWaitIfReady, waitForEnergy } = loadUnitEnergy()
  const calls = []
  const target = { family: 'unit', isDestroyed: false, isDead: false }
  const animal = {
    action: 'attack',
    context: { scheduler: { elapsedMs: 0 } },
    dest: target,
    energy: 0,
    totalEnergy: 2,
    energyRegenRate: 20,
    energyRegenDelay: 0,
    sendTo: (resumeTarget, action, options) => calls.push(['sendTo', resumeTarget, action, options]),
    setTextures: sheet => calls.push(['setTextures', sheet]),
    sprite: { stop: () => calls.push(['sprite.stop']) },
    startInterval: () => calls.push(['startInterval']),
    stopInterval: () => calls.push(['stopInterval']),
  }

  assert.equal(waitForEnergy(animal, 'flee', target), false)
  animal.context.scheduler.elapsedMs = 100
  assert.equal(resumeEnergyWaitIfReady(animal), true)

  assert.deepEqual(calls.at(-1), ['sendTo', target, 'flee', { forceRepath: true }])
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
  assert.deepEqual(calls.slice(0, 4), [
    ['stopInterval'],
    ['setTextures', 'standingSheet'],
    ['sprite.stop'],
    ['startInterval'],
  ])

  unit.context.scheduler.elapsedMs = 100
  assert.equal(resumeEnergyWaitIfReady(unit), true)
  assert.equal(unit.waitingForEnergyAction, null)
  assert.deepEqual(calls.at(-1), ['sendToEvt', target, 'chopwood'])
})

test('cancelling an energy wait clears the scheduled resume', () => {
  const { __combatBehaviorCalls, cancelEnergyWait } = loadUnitEnergy()
  const calls = []
  const target = { family: 'resource', isDestroyed: false, isDead: false }
  const unit = {
    combatMode: 'recover',
    context: { scheduler: { remove: id => calls.push(['remove', id]) } },
    energyWaitTaskId: 7,
    waitingForEnergyAction: 'chopwood',
    waitingForEnergyTarget: target,
  }

  cancelEnergyWait(unit)

  assert.equal(unit.waitingForEnergyAction, null)
  assert.equal(unit.waitingForEnergyTarget, null)
  assert.equal(unit.energyWaitTaskId, null)
  assert.deepEqual(calls, [['remove', 7]])
  assert.deepEqual(__combatBehaviorCalls, [['exit', unit]])
})

test('npc attack fatigue resumes after retreat movement stops the unit interval', () => {
  const { __combatBehaviorCalls, __fatigueFeedbackCalls, waitForEnergy } = loadUnitEnergy()
  const calls = []
  const schedulerTasks = new Map()
  const target = { family: 'unit', isDestroyed: false, isDead: false, solid: true, i: 0, j: 0, x: 0, y: 0 }
  const retreatCell = { solid: false, border: false, i: 2, j: 0, x: 96, y: 0 }
  const unit = {
    action: 'attack',
    context: {
      map: { grid: [[target], [retreatCell]] },
      scheduler: {
        elapsedMs: 0,
        add(callback, _time, name) {
          const id = schedulerTasks.size + 1
          schedulerTasks.set(id, { callback, name })
          calls.push(['scheduler.add', name])
          return id
        },
        remove(id) {
          schedulerTasks.delete(id)
          calls.push(['scheduler.remove', id])
        },
      },
    },
    dest: target,
    energy: 0,
    totalEnergy: 2,
    energyRegenRate: 20,
    energyRegenDelay: 0,
    i: 0,
    j: 0,
    x: 0,
    y: 0,
    sendTo: destination => {
      calls.push(['sendTo', destination])
      unit.stopInterval()
    },
    sendToEvt: (resumeTarget, action, options) => calls.push(['sendToEvt', resumeTarget, action, options]),
    startInterval: () => calls.push(['startInterval']),
    stopInterval: () => calls.push(['stopInterval']),
  }

  assert.equal(waitForEnergy(unit, 'attack', target), false)
  assert.equal(unit.waitingForEnergyAction, 'attack')
  assert.deepEqual(__fatigueFeedbackCalls, [unit])
  assert.equal(schedulerTasks.size, 1)
  assert.deepEqual(calls, [['stopInterval'], ['scheduler.add', 'unit.energyWait']])
  assert.deepEqual(__combatBehaviorCalls[0], ['enter', unit, target])

  unit.context.scheduler.elapsedMs = 100
  schedulerTasks.get(1).callback()
  assert.equal(unit.waitingForEnergyAction, null)
  assert.equal(unit.energyWaitTaskId, null)
  assert.deepEqual(__combatBehaviorCalls.at(-1), ['exit', unit])
  assert.deepEqual(calls.at(-1), ['sendToEvt', target, 'attack', { forceRepath: true }])
})

test('npc attack fatigue keeps repositioning while waiting for full energy', () => {
  const { __combatBehaviorCalls, waitForEnergy } = loadUnitEnergy()
  const calls = []
  const schedulerTasks = new Map()
  const target = { family: 'unit', isDestroyed: false, isDead: false, solid: true, i: 0, j: 0, x: 0, y: 0 }
  const recoveryCell = { solid: false, border: false, i: 1, j: 1, x: 72, y: 72 }
  const unit = {
    action: 'attack',
    context: {
      map: {
        grid: [
          [target, { solid: false, border: false, i: 0, j: 1, x: 0, y: 96 }],
          [{ solid: false, border: false, i: 1, j: 0, x: 96, y: 0 }, recoveryCell],
        ],
      },
      scheduler: {
        elapsedMs: 0,
        add(callback, _time, name) {
          const id = schedulerTasks.size + 1
          schedulerTasks.set(id, { callback, name })
          calls.push(['scheduler.add', name])
          return id
        },
        remove(id) {
          schedulerTasks.delete(id)
        },
      },
    },
    dest: target,
    energy: 0,
    totalEnergy: 1,
    energyRegenRate: 5,
    energyRegenDelay: 0,
    i: 0,
    j: 0,
    x: 0,
    y: 0,
    path: [],
    sendTo: destination => calls.push(['sendTo', destination]),
    sendToEvt: (resumeTarget, action, options) => calls.push(['sendToEvt', resumeTarget, action, options]),
    stopInterval: () => calls.push(['stopInterval']),
  }

  assert.equal(waitForEnergy(unit, 'attack', target), false)
  assert.deepEqual(__combatBehaviorCalls[0], ['enter', unit, target])

  unit.context.scheduler.elapsedMs = 800
  schedulerTasks.get(1).callback()
  assert.equal(unit.waitingForEnergyAction, 'attack')
  assert.deepEqual(__combatBehaviorCalls.at(-1), ['update', unit])

  unit.context.scheduler.elapsedMs = 1600
  schedulerTasks.get(1).callback()
  assert.equal(unit.waitingForEnergyAction, null)
  assert.deepEqual(calls.at(-1), ['sendToEvt', target, 'attack', { forceRepath: true }])
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

test('low energy progressively slows movement except while mounted', () => {
  const { getEnergyMoveSpeedMultiplier } = loadUnitEnergy()

  assert.equal(getEnergyMoveSpeedMultiplier({ energy: 10, totalEnergy: 10 }), 1)
  assert.equal(getEnergyMoveSpeedMultiplier({ energy: 5, totalEnergy: 10 }), 1)
  assert.equal(getEnergyMoveSpeedMultiplier({ energy: 0, totalEnergy: 10 }), 0.55)
  assert.equal(getEnergyMoveSpeedMultiplier({ energy: 2, totalEnergy: 10 }), 0.73)
  assert.equal(getEnergyMoveSpeedMultiplier({ energy: 0, mountedOnHorse: true, totalEnergy: 10 }), 1)
})
