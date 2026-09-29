const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

const { handleUnitIsAttacked } = loadTsModule('app/classes/unit/UnitStateHandlers.ts', {
  mocks: {
    '../../lib/units/unitSuspension': { wakeUnitSimulation: () => {} },
    '../../lib/units/campBehavior': { canCampPursue: () => true },
    '../../lib': {
      evaluateCombatMorale: () => 'fight',
      cancelPendingAggression: () => {},
    },
    '../../lib/units/unitHealth': { notifyHeroHealthChanged: () => {} },
    '../../lib/combat/combatBehavior': { shouldSuppressAggroDuringCombatRecovery: () => false },
    '../../lib/units/unitControl': { canAutoReactToAttack: () => true },
    './UnitActions': {},
    '../../lib/hero/heroTools': {},
    '../../lib/combat/combatAttackLoop': {},
    '../../lib/buildings/passageCells': {},
    '../../services/rest/UnitSleepVisuals': {},
    './UnitBanditDebug': {},
  },
})

for (const family of ['animal', 'unit']) {
  test(`a villager interrupts resource work with combat when attacked by an ${family}`, () => {
    const attacker = { label: 'threat', family }
    const tree = { label: 'tree' }
    const calls = []
    const unit = {
      type: 'Villager',
      context: {},
      owner: {},
      dest: tree,
      action: 'chopwood',
      collectiveTask: 'wood',
      getActionCondition: () => true,
      sendToAttack: target => calls.push(['attack', target]),
      sendToHunt: () => assert.fail('Defense must not become an autonomous hunting job'),
    }
    handleUnitIsAttacked(unit, attacker)
    assert.deepEqual(calls, [['attack', attacker]])
    assert.equal(unit.previousDest, tree)
  })
}
