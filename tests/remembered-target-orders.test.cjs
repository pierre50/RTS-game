const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function scene() {
  let visible = false
  const cell = { i: 4, j: 0, has: null, corpses: [] }
  const target = { label: 'remembered', type: 'Stone', family: 'resource', i: 4, j: 0, quantity: 50 }
  const unit = {
    type: 'Villager',
    i: 0,
    j: 0,
    owner: { units: [], buildings: [] },
    context: { map: { grid: [] } },
    action: null,
    dest: null,
    path: [],
    getActionCondition: () => true,
    sendToEvt(dest, action) {
      this.dest = dest
      this.action = action
      this.path = [cell]
    },
  }
  unit.context.map.grid[4] = [cell]
  const fallbacks = []
  const knowledge = {
    playerSeesTarget: () => visible,
    observeTarget: () => {},
    knownTarget: () => ({ i: 4, j: 0, spaceId: 'outside' }),
  }
  const options = {
    moduleCache: new Map(),
    mocks: {
      './playerTargetKnowledge': knowledge,
      '../../lib/units/playerTargetKnowledge': knowledge,
      '../mapSpaces': { getEntitySpaceMapLike: unit => unit.context.map, sameMapSpace: () => true },
      '../../lib': {
        setVillagerAutonomy: (unit, job) => {
          unit.autonomousJob = job
        },
        getAutonomyJobForWork: () => 'stone',
      },
      './UnitResourceDeliveryCommands': {
        applyWorkForAction: (unit, work) => {
          unit.work = work
        },
      },
      '../grid/movement': { getInstanceClosestFreeCellPath: () => [cell] },
      './villagerAutonomy': {
        assignVillagerAutonomy: (...args) => {
          fallbacks.push(args)
          return false
        },
      },
    },
  }
  const pursuit = loadTsModule('app/lib/units/targetPursuit.ts', options)
  const { UnitCommands } = loadTsModule('app/classes/unit/UnitCommands.ts', options)
  const commands = new UnitCommands(unit)
  const targeting = loadTsModule('app/lib/units/villagerAutonomyTargeting.ts', options)
  const recovery = loadTsModule('app/lib/units/villagerTaskRecovery.ts', options)
  return {
    unit,
    target,
    cell,
    pursuit,
    commands,
    targeting,
    recovery,
    fallbacks,
    reveal: () => {
      visible = true
    },
  }
}

for (const [job, type, action, work] of [
  ['stone', 'Stone', 'minestone', 'stoneminer'],
  ['gold', 'Gold', 'minegold', 'goldminer'],
  ['wood', 'Tree', 'chopwood', 'woodcutter'],
  ['food', 'Berrybush', 'forageberry', 'forager'],
  ['food', 'Deer', 'hunt', 'hunter'],
]) {
  test(`${action} accepts a remembered-cell order and starts work after detection`, () => {
    const { unit, target, cell, pursuit, commands, targeting, reveal } = scene()
    target.type = type
    if (type === 'Deer') target.family = 'animal'
    const candidate = { target, action, work, send: dest => commands.commonSendTo(dest, work, action, false, true) }
    assert.equal(targeting.tryVillagerJobCandidates(unit, job, [candidate], { targetWorkerLoad: () => 0 }), true)
    assert.equal(unit.dest, cell)
    assert.equal(unit.action, null)
    assert.equal(pursuit.isPursuingRememberedTarget(unit, target, action), true)
    reveal()
    assert.equal(pursuit.updateTargetPursuit(unit), true)
    assert.equal(unit.dest, target)
    assert.equal(unit.action, action)
  })
}

test('task recovery keeps a remembered stone order instead of falling back to exploration', () => {
  const { unit, target, cell, commands, recovery, fallbacks } = scene()
  unit.sendToStone = dest => commands.commonSendTo(dest, 'stoneminer', 'minestone', false, true)
  assert.equal(
    recovery.resumeVillagerJobIntent(unit, {
      dest: target,
      action: 'minestone',
      work: 'stoneminer',
      autonomousJob: 'stone',
    }),
    true
  )
  assert.equal(unit.dest, cell)
  assert.deepEqual(fallbacks, [])
})

test('attack follows only the remembered position and a new order invalidates that pursuit', () => {
  const { unit, target, cell, commands, pursuit } = scene()
  target.family = 'unit'
  target.i = 20
  assert.equal(commands.commonSendTo(target, 'attacker', 'attack', false, true), true)
  assert.equal(unit.dest, cell)
  assert.equal(pursuit.isPursuingRememberedTarget(unit, target, 'attack'), true)
  assert.equal(pursuit.isPursuingRememberedTarget(unit, target, 'hunt'), false)
  unit.dest = { i: 2, j: 2 }
  assert.equal(pursuit.isPursuingRememberedTarget(unit, target, 'attack'), false)
  assert.equal(pursuit.updateTargetPursuit(unit), false)
})

test('a failed movement command is not accepted as a remembered-target pursuit', () => {
  const { unit, target, pursuit, commands, targeting } = scene()
  unit.sendToEvt = () => false
  assert.equal(
    targeting.tryVillagerJobCandidates(
      unit,
      'stone',
      [
        {
          target,
          action: 'minestone',
          work: 'stoneminer',
          send: dest => commands.commonSendTo(dest, 'stoneminer', 'minestone', false, true),
        },
      ],
      { targetWorkerLoad: () => 0 }
    ),
    false
  )
  assert.equal(pursuit.isPursuingRememberedTarget(unit, target, 'minestone'), false)
})
