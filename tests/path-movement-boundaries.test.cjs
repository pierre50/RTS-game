const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
function fixture() {
  const calls = []
  const rules = {
    pursue: false,
    contact: false,
    retry: false,
    range: false,
    blocked: false,
    recover: false,
    move: true,
    mode: 'step',
    moved: false,
    arrived: false,
    passage: false,
    passageIntent: false,
    speed: 1,
  }
  const mark =
    name =>
    (...args) =>
      calls.push([name, ...args])
  const { moveUnitToPath } = loadTsModule('app/classes/unit/movement/UnitPathMovement.ts', {
    mocks: {
      '../../../lib/units/pathProgress': {
        runPathStep: (_unit, step, repath, stop) => ({ step, repath, stop })[rules.mode](),
      },
      '../../../lib/grid/visibility': { updateInstanceRenderVisibility: mark('visible') },
      '../../../lib/units/targetPursuit': { updateTargetPursuit: () => rules.pursue },
      './UnitContactApproach': { tryStartUnitContactApproach: () => rules.contact },
      '../../../lib': {
        canUpdateMinimap: () => true,
        cartesianToIsometric: (i, j) => [i, j],
        degreeToDirection: degree => degree,
        getInstanceDegree: () => 90,
        getInstanceZIndex: () => 4,
        instancesDistance: () => 1,
        moveTowardPoint: (u, x, y) => {
          if (rules.move) {
            u.x = x
            u.y = y
          }
        },
        playMovementSurfaceAudio() {},
        updateInstanceVisibility() {},
      },
      './UnitMovementDebug': { debugCombatMove: mark('debug') },
      './UnitMovementHelpers': {
        cellOccupantIsDest: (cell, dest) => cell.has === dest,
        clearCellForUnit() {},
        getRequestedMoveSpeedFactor: () => 1,
        getPathMoveSpeed: () => rules.speed,
        isCellBlockedForUnit: () => rules.blocked,
        isDestroyedEntity: dest => dest.isDestroyed,
        isMovingUnitEntity: entity => entity.family === 'unit',
        isRecoveringAttack: () => rules.recover,
        isUnitCellOccupant: (unit, cell) => cell.has === unit,
        placeUnitOnCell() {},
        pauseCombatRecoveryMove: mark('pause'),
        startActionIfAlreadyInRange: () => rules.range,
        updateCautiousAnimalApproachSpeed() {},
      },
      '../../../lib/units/visuals/unitWalkingAnimation': { applyUnitWalkingAnimationSpeed() {} },
      '../../../lib/units/visuals/unitCrouchPose': { applyUnitCrouchPose() {}, resetUnitCrouchPose: mark('reset') },
      '../../../lib/units/unitLocomotion': { isUnitWalkSpeedFactor: () => false },
      '../../../lib/buildings/passageCells': {
        routeUnitAwayFromPassageCell: () => rules.passage,
        unitHasActivePassageStopIntent: () => rules.passageIntent,
      },
      '../../../lib/mapSpaces': { getEntitySpaceMapLike: unit => unit.context?.map, isOutsideSpaceId: () => true },
      '../../../lib/terrain/reliefSurface': { syncEntityRelief() {} },
      '../../../lib/terrain/reliefMovement': { getReliefMovementDistance: (_m, _u, _p, speed) => speed },
    },
  })
  const cell = { i: 1, j: 0, x: 1, y: 0, z: 0 },
    dest = { i: 3, j: 0, family: 'resource', x: 3, y: 0 }
  const unit = {
    label: 'unit',
    i: 0,
    j: 0,
    x: 0,
    y: 0,
    path: [cell],
    dest,
    context: {
      map: { grid: [[], [cell]], updateInstanceBucket() {} },
      menu: { isMiniMapActive: () => false, updatePlayerMiniMap: mark('minimap') },
    },
    sprite: { playing: false, play: mark('play'), stop: mark('spriteStop') },
    currentSheet: 'walkingSheet',
    action: null,
    affectNewDest: mark('replace'),
    sendToEvt: mark('send'),
    stop: mark('stop'),
    stopInterval: mark('stopInterval'),
    getAction: mark('action'),
    destHasMoved: () => rules.moved,
    isUnitAtDest: () => rules.arrived,
  }
  return { unit, cell, dest, rules, calls, step: () => moveUnitToPath(unit, () => rules.retry) }
}
test('path watchdog repaths the original task and stops when recovery is exhausted', () => {
  const { unit, dest, rules, calls, step } = fixture()
  rules.mode = 'repath'
  step()
  assert.deepEqual(calls.pop(), [
    'send',
    dest,
    null,
    { forceRepath: true, preserveAutonomy: true, allowPassageStop: false },
  ])
  unit.action = 'train'
  step()
  assert.equal(calls.pop()[3].allowPassageStop, true)
  unit.dest = null
  step()
  assert.equal(calls.length, 0)
  rules.mode = 'stop'
  step()
  assert.deepEqual(calls, [['stop']])
})
test('path step clears invalid paths and refuses missing or destroyed destinations', () => {
  for (const mode of ['pursue', 'map', 'path', 'cell', 'dest', 'destroyed', 'sprite', 'contact']) {
    const { unit, rules, calls, step } = fixture()
    if (mode === 'pursue') rules.pursue = true
    if (mode === 'map') delete unit.context
    if (mode === 'path') unit.path = []
    if (mode === 'cell') unit.path = [{ i: 99, j: 99 }]
    if (mode === 'dest') unit.dest = null
    if (mode === 'destroyed') unit.dest.isDestroyed = true
    if (mode === 'sprite') delete unit.sprite
    if (mode === 'contact') rules.contact = true
    step()
    assert.equal(
      calls.some(([event]) => event === 'play'),
      false
    )
    if (['cell', 'dest', 'destroyed'].includes(mode)) assert.ok(calls.some(([event]) => event === 'replace'))
    if (mode === 'cell') assert.deepEqual(unit.path, [])
  }
})
test('path movement waits for a nearby moving unit and repaths a blocked cell', () => {
  const { unit, cell, rules, calls, step } = fixture()
  cell.has = { family: 'unit', label: 'other', hasPath: () => true, sprite: { playing: true } }
  step()
  assert.ok(calls.some(([event]) => event === 'spriteStop'))
  assert.equal(unit.i, 0)
  cell.has = unit
  cell.solid = true
  rules.blocked = true
  calls.length = 0
  step()
  assert.ok(calls.some(([event]) => event === 'send'))
  rules.recover = true
  calls.length = 0
  step()
  assert.deepEqual(calls.at(-1), ['pause', unit])
  rules.recover = false
  rules.range = true
  cell.has = unit.dest
  calls.length = 0
  step()
  assert.equal(
    calls.some(([event]) => event === 'send'),
    false
  )
})
test('arrival handles moved targets, immediate actions, recovery and reserved passages', () => {
  for (const mode of ['moved', 'arrived', 'recover', 'passage', 'retry', 'replace']) {
    const { unit, cell, rules, calls, step } = fixture()
    if (mode !== 'replace') rules[mode] = true
    step()
    assert.equal(unit.currentCell, cell)
    assert.equal(unit.i, 1)
    if (mode === 'moved') assert.ok(calls.some(([event]) => event === 'send'))
    if (mode === 'arrived') assert.ok(calls.some(([event, action]) => event === 'action' && action === ''))
    if (mode === 'recover') assert.ok(calls.some(([event]) => event === 'pause'))
    assert.equal(
      calls.some(([event]) => event === 'replace'),
      mode === 'replace'
    )
  }
})
test('path movement reports lack of position progress without a minimap refresh', () => {
  const { unit, rules, calls, step } = fixture()
  rules.speed = 0.1
  rules.move = false
  step()
  assert.equal(unit.x, 0)
  assert.equal(unit.path.length, 1)
  assert.ok(calls.some(([event, , reason]) => event === 'debug' && reason === 'no-position-progress'))
  assert.equal(
    calls.some(([event]) => event === 'minimap'),
    false
  )
})
