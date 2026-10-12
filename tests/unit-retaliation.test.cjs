const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function setup() {
  const options = {
    moduleCache: new Map(),
    mocks: {
      '../../lib': {
        evaluateCombatMorale: () => 'fight',
        cancelPendingAggression() {},
        getActionCondition: (_unit, target) => !target.friendly,
      },
      '../../lib/units/unitHealth': { notifyHeroHealthChanged() {} },
      '../../lib/units/unitSuspension': { wakeUnitSimulation() {} },
      '../../lib/units/unitControl': { canAutoReactToAttack: () => true },
      '../../lib/combat/combatBehavior': { shouldSuppressAggroDuringCombatRecovery: () => false },
      '../../lib/units/playerTargetKnowledge': {
        playerSeesTarget: () => false,
        observeTarget() {},
        knownTarget() {},
      },
      '../../lib/units/insightDetection': { instanceIsInInsightRange: () => false },
      '../../lib/combat/combatFeedback': { cancelPendingAggression() {} },
      '../../lib/buildings/passageCells': { canUnitUseCellAsIdleDestination: () => true },
      '../spacePortal/SpacePortalSystem': { clearUnitSpacePortalRoute() {} },
      './UnitActions': {},
      '../../lib/hero/heroTools': {},
      '../../lib/combat/combatAttackLoop': { clearCombatAttackRecovery() {} },
      '../../services/rest/UnitSleepVisuals': {},
      './UnitBanditDebug': {},
      './UnitDirectMovement': {},
      './UnitMovementHelpers': {},
      './UnitMovementRouting': {},
      './UnitPathMovement': {},
      './UnitAffectNewDest': {},
    },
  }
  const load = path => loadTsModule(path, options)
  const { handleUnitIsAttacked } = load('app/classes/unit/UnitStateHandlers.ts')
  const { checkActionCondition } = load('app/classes/unit/UnitCommandConditions.ts')
  const pursuit = load('app/lib/units/combat/targetPursuit.ts')
  const retaliation = load('app/lib/units/unitRetaliation.ts')
  const { UnitMovement } = load('app/classes/unit/movement/UnitMovement.ts')
  const { CampLeashController } = load('app/services/patrol/CampLeashController.ts')
  const grid = Array.from({ length: 60 }, (_, i) => Array.from({ length: 60 }, (_, j) => ({ i, j })))
  const context = { scheduler: { elapsedMs: 0 }, map: { grid, spaces: new Map() } }
  const unit = {
    type: 'BanditSword',
    family: 'unit',
    i: 10,
    j: 10,
    owner: {},
    context,
    campPatrolAnchor: { i: 10, j: 10 },
    getActionCondition(target, action) {
      return checkActionCondition(this, target, action)
    },
    sendTo(target, action) {
      this.dest = target
      this.action = action
    },
    sendToEvt(target, action) {
      this.dest = target
      this.action = action
    },
    stop() {
      assert.fail('Retaliation must not stop because the attacker is unseen')
    },
  }
  const attacker = { family: 'unit', type: 'Hero', i: 10, j: 20 }
  return {
    unit,
    attacker,
    context,
    handleUnitIsAttacked,
    pursuit,
    retaliation,
    UnitMovement,
    controller: new CampLeashController(context),
  }
}

test('an unseen arrow attacker becomes a valid combat target only for its victim', () => {
  const { unit, attacker, handleUnitIsAttacked, pursuit, retaliation } = setup()
  assert.equal(unit.getActionCondition(attacker, 'attack'), false)
  handleUnitIsAttacked(unit, attacker)
  assert.equal(unit.dest, attacker)
  assert.equal(unit.action, 'attack')
  assert.equal(unit.getActionCondition(attacker, 'attack'), true)
  assert.equal(pursuit.routeToRememberedTarget(unit, attacker, 'attack'), false)
  assert.equal(pursuit.updateTargetPursuit(unit), false)
  assert.equal(retaliation.isUnitRetaliationTarget({ ...unit }, attacker), false)
  assert.equal(unit.getActionCondition({ ...attacker }, 'attack'), false)
  assert.equal(unit.getActionCondition(attacker, 'hunt'), false)
  attacker.friendly = true
  assert.equal(unit.getActionCondition(attacker, 'attack'), false)
})

test('retaliation survives the lost-sight timeout but still obeys the camp leash', () => {
  const { unit, attacker, context, handleUnitIsAttacked, controller, retaliation } = setup()
  handleUnitIsAttacked(unit, attacker)
  controller.update(unit)
  context.scheduler.elapsedMs = 5000
  controller.update(unit)
  assert.equal(unit.campBehavior.phase, 'pursue')
  assert.equal(unit.dest, attacker)
  unit.i = 50
  attacker.i = 51
  controller.update(unit)
  assert.equal(unit.campBehavior.phase, 'return')
  assert.equal(retaliation.isUnitRetaliationTarget(unit, attacker), false)
})

test('retaliation cannot cross spaces, track dead targets or bypass the initial chase limit', () => {
  const { unit, attacker, handleUnitIsAttacked, retaliation } = setup()
  attacker.j = 50
  handleUnitIsAttacked(unit, attacker)
  assert.equal(unit.dest, undefined)
  attacker.j = 20
  handleUnitIsAttacked(unit, attacker)
  attacker.spaceId = 'other'
  assert.equal(retaliation.isUnitRetaliationTarget(unit, attacker), false)
  attacker.spaceId = 'outside'
  attacker.isDead = true
  assert.equal(unit.getActionCondition(attacker, 'attack'), false)
  attacker.isDead = false
  retaliation.clearUnitAttacker(unit)
  assert.equal(unit.getActionCondition(attacker, 'attack'), false)
})

test('a retaliating bandit repaths when its unseen attacker moves', () => {
  const { unit, attacker, handleUnitIsAttacked, retaliation, UnitMovement } = setup()
  handleUnitIsAttacked(unit, attacker)
  unit.realDest = { i: attacker.i, j: attacker.j }
  assert.equal(UnitMovement.prototype.destHasMoved.call({ unit }), false)
  attacker.j += 1
  assert.equal(UnitMovement.prototype.destHasMoved.call({ unit }), true)
  retaliation.clearUnitAttacker(unit)
  assert.equal(UnitMovement.prototype.destHasMoved.call({ unit }), false)
})
