const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function scene() {
  const options = { moduleCache: new Map() }
  const alerts = loadTsModule('app/lib/units/unitCombatAlert.ts', options)
  const knowledge = loadTsModule('app/lib/units/unitRetaliation.ts', options)
  const suspension = loadTsModule('app/lib/units/unitSuspension.ts', options)
  const owner = { label: 'camp', units: [] }
  const context = { players: [owner] }
  const target = { family: 'unit', type: 'Hero', i: 0, j: 3, owner: { label: 'enemy' } }
  function soldier(i, extra = {}) {
    const unit = {
      family: 'unit',
      type: 'BanditSword',
      i,
      j: 0,
      sight: 4,
      hitPoints: 20,
      owner,
      context,
      orders: 0,
      getActionCondition(enemy) {
        return enemy.owner !== this.owner && knowledge.isUnitRetaliationTarget(this, enemy)
      },
      sendToEvt(enemy, action) {
        this.orders++
        this.dest = enemy
        this.action = action
        alerts.alertUnitCombatAllies(this)
      },
      ...extra,
    }
    unit.owner.units.push(unit)
    return unit
  }
  const leader = soldier(0)
  function engage() {
    leader.dest = target
    leader.action = 'attack'
    alerts.alertUnitCombatAllies(leader)
  }
  return { alerts, knowledge, suspension, owner, context, target, soldier, leader, engage }
}

test('combat propagates along a chain of visible allies without recursion or repeated orders', () => {
  const { soldier, engage, leader, target, alerts } = scene()
  const units = [soldier(4), soldier(8), soldier(12)]
  const isolated = soldier(20)
  engage()
  for (const unit of units) {
    assert.equal(unit.dest, target)
    assert.equal(unit.orders, 1)
  }
  assert.equal(isolated.orders, 0)
  assert.equal(leader.orders, 0)
  alerts.alertUnitCombatAllies(leader)
  assert.deepEqual(
    units.map(unit => unit.orders),
    [1, 1, 1]
  )
})

test('the receiving soldier must see its ally, and already engaged units keep their target', () => {
  const { soldier, leader, engage } = scene()
  leader.sight = 50
  const shortSight = soldier(5, { sight: 1 })
  const oldTarget = { i: 1, j: 1 }
  const fighting = soldier(2, { action: 'attack', dest: oldTarget })
  engage()
  assert.equal(shortSight.orders, 0)
  assert.equal(fighting.orders, 0)
  assert.equal(fighting.dest, oldTarget)
})

test('military allies assist but neutral units, civilians and controlled heroes do not', () => {
  const { soldier, owner, context, engage, target } = scene()
  owner.team = 1
  const alliedOwner = { label: 'allied', team: 1, units: [] }
  const neutralOwner = { label: 'neutral', team: 2, units: [] }
  context.players.push(alliedOwner, neutralOwner)
  const ally = soldier(2, { type: 'Fantassin', owner: alliedOwner })
  const archer = soldier(3, { type: 'Bowman' })
  const excluded = [
    soldier(1, { owner: neutralOwner }),
    soldier(1, { type: 'Villager' }),
    soldier(1, { controlMode: 'hero' }),
    soldier(1, { isDead: true }),
    soldier(1, { spaceId: 'cave' }),
    soldier(1, { combatMode: 'flee' }),
    soldier(1, { actionLocked: true }),
  ]
  engage()
  assert.equal(ally.dest, target)
  assert.equal(archer.dest, target)
  assert.ok(excluded.every(unit => unit.orders === 0))
})

test('camp limits and invalid or failed attack orders stop the alert chain', () => {
  const { soldier, engage } = scene()
  const returning = soldier(2, { campPatrolAnchor: { i: 2, j: 0 }, campBehavior: { phase: 'return' } })
  const outside = soldier(2, { campPatrolAnchor: { i: 50, j: 0 } })
  const invalid = soldier(2, { getActionCondition: () => false })
  const failed = soldier(4, {
    sendToEvt() {
      this.orders++
    },
  })
  const behind = soldier(8)
  engage()
  assert.ok([returning, outside, invalid, behind].every(unit => unit.orders === 0))
  assert.equal(failed.orders, 1)
})

test('a new combat episode can alert again, while road travellers stay suspended', () => {
  const { soldier, engage, leader, alerts, suspension } = scene()
  const road = soldier(1)
  suspension.setUnitSuspension(road, { reason: 'road-travel', wake() {} })
  engage()
  const newcomer = soldier(2)
  engage()
  assert.equal(newcomer.orders, 0)
  alerts.clearUnitCombatAlert(leader)
  engage()
  assert.equal(newcomer.orders, 1)
  assert.equal(road.orders, 0)
})
