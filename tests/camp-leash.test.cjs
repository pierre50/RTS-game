const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const rules = loadTsModule('app/lib/units/campBehavior.ts')
const { CampLeashController } = loadTsModule('app/services/patrol/CampLeashController.ts', {
  mocks: {
    '../../lib/units/insightDetection': { instanceIsInInsightRange: (_unit, target) => target.visible !== false },
    '../../lib/units/playerTargetKnowledge': { playerSeesTarget: (_owner, target) => target.visible !== false },
    '../../lib/combat/combatFeedback': { cancelPendingAggression() {} },
    '../../lib/buildings/passageCells': { canUnitUseCellAsIdleDestination: () => true },
    '../spacePortal/SpacePortalSystem': {
      clearUnitSpacePortalRoute(unit) {
        unit.spacePortalState = null
      },
      routeUnitThroughSpacePortal(_context, unit, portal) {
        unit.returnPortal = portal
        unit.spacePortalState = { taskId: 1 }
      },
    },
  },
})
function setup() {
  const grid = Array.from({ length: 65 }, (_, i) => Array.from({ length: 65 }, (_, j) => ({ i, j })))
  const context = { scheduler: { elapsedMs: 0 }, map: { grid, spaces: new Map() } }
  const unit = {
    i: 15,
    j: 10,
    owner: {},
    context,
    sight: 50,
    campPatrolAnchor: { i: 10, j: 10 },
    path: [],
    sendToEvt(cell) {
      this.dest = cell
      this.action = null
      this.path = [cell]
      this.orders = (this.orders ?? 0) + 1
    },
  }
  const target = { i: 18, j: 10, family: 'unit', visible: true }
  unit.action = 'attack'
  unit.dest = target
  return { unit, target, context, controller: new CampLeashController(context) }
}
test('camp pursuit uses separate target and home limits and does not constrain player units', () => {
  const { unit, target } = setup()
  assert.equal(rules.canCampPursue(unit, target), true)
  target.i = 36
  assert.equal(rules.canCampPursue(unit, target), false)
  unit.i = 41
  target.i = 42
  assert.equal(rules.canCampPursue(unit, target), false)
  unit.owner.isPlayed = true
  assert.equal(rules.canCampPursue(unit, target), true)
})
test('leash cancels combat, returns by path and rearms only near the camp', () => {
  const { unit, target, context, controller } = setup()
  controller.update(unit)
  assert.equal(unit.campBehavior.phase, 'pursue')
  unit.i = 41
  target.i = 42
  assert.equal(controller.update(unit), true)
  assert.equal(unit.campBehavior.phase, 'return')
  assert.equal(unit.action, null)
  assert.equal(unit.orders, 1)
  assert.equal(rules.canCampPursue(unit, target), false)
  context.scheduler.elapsedMs = 500
  controller.update(unit)
  assert.equal(unit.orders, 1)
  context.scheduler.elapsedMs = 3000
  controller.update(unit)
  assert.equal(unit.orders, 1)
  unit.i = 12
  unit.j = 10
  controller.update(unit)
  assert.equal(unit.campBehavior.phase, 'guard')
})
test('lost targets receive a bounded search without tracking hidden coordinates', () => {
  const { unit, target, context, controller } = setup()
  controller.update(unit)
  target.visible = false
  target.i = 999
  context.scheduler.elapsedMs = 500
  controller.update(unit)
  assert.equal(unit.campBehavior.phase, 'pursue')
  assert.equal(unit.dest.i, 18, 'search uses the last visible cell')
  context.scheduler.elapsedMs = 3499
  controller.update(unit)
  assert.equal(unit.campBehavior.phase, 'pursue')
  context.scheduler.elapsedMs = 3500
  controller.update(unit)
  assert.equal(unit.campBehavior.phase, 'return')
})
test('guards return through a cave exit and retain their return state after serialization', () => {
  const { unit, context, controller } = setup()
  const portal = { targetSpaceId: 'outside', targetCell: { i: 12, j: 10 } }
  context.map.spaces.set('cave', { portals: [portal], building: { cave: { id: 'lair' } } })
  unit.campBehavior = { phase: 'return', caveId: 'lair' }
  unit.spaceId = 'cave'
  unit.action = null
  unit.dest = null
  unit.campBehavior = JSON.parse(JSON.stringify(unit.campBehavior))
  controller.update(unit)
  assert.equal(unit.returnPortal, portal)
  assert.equal(unit.campBehavior.phase, 'return')
  assert.equal(rules.campSpaceAllowed(unit, 'cave'), true)
  assert.equal(rules.campSpaceAllowed(unit, 'unrelated-house'), false)
})
test('blocked home paths retry at most every two seconds', () => {
  const { unit, context, controller } = setup()
  unit.i = 50
  unit.sendToEvt = function () {
    this.orders = (this.orders ?? 0) + 1
  }
  controller.update(unit)
  const count = unit.orders
  context.scheduler.elapsedMs = 1999
  controller.update(unit)
  assert.equal(unit.orders, count)
  context.scheduler.elapsedMs = 2000
  controller.update(unit)
  assert.equal(unit.orders, count * 2)
})

test('blocked returns try one different home candidate per retry instead of four at once', () => {
  const { unit, context, controller } = setup()
  unit.i = 42
  unit.action = null
  unit.dest = null
  unit.campBehavior = { phase: 'return' }
  const tried = []
  unit.sendToEvt = cell => tried.push(`${cell.i}:${cell.j}`)
  controller.update(unit)
  assert.equal(tried.length, 1)
  context.scheduler.elapsedMs = 2000
  controller.update(unit)
  assert.equal(tried.length, 2)
  assert.notEqual(tried[0], tried[1])
})

test('village supply trips can leave the home perimeter, but combat and arbitrary walks remain leashed', () => {
  const { unit, controller } = setup()
  delete unit.campPatrolAnchor
  Object.assign(unit, {
    type: 'Villager',
    i: 60,
    j: 10,
    villageHome: { id: 'village', i: 10, j: 10, spaceId: 'outside' },
    autonomousJob: 'wood',
    action: 'chopwood',
    dest: { i: 61, j: 10, family: 'resource', type: 'Tree', quantity: 20 },
  })
  assert.equal(controller.update(unit), false)
  assert.equal(unit.orders ?? 0, 0)
  const target = unit.dest
  unit.dest = { i: 61, j: 10, has: target }
  unit.action = null
  assert.equal(controller.update(unit), false, 'remembered-resource approach stays authorized')
  unit.dest = { i: 11, j: 10, family: 'building' }
  unit.action = 'delivery'
  assert.equal(controller.update(unit), false, 'the return leg must keep its cargo destination')
  unit.dest = { i: 61, j: 10, family: 'unit' }
  unit.action = 'attack'
  assert.equal(controller.update(unit), true)
  assert.equal(unit.campBehavior.phase, 'return')
})
