const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

// Real building types: pulled in (not hand-duplicated) so building-interior code paths reached
// transitively through the real (unmocked) passageCells/interiors/buildingOccupancy chain — via
// createReservedPassageCellLookup and isBuildingInteriorSupported below — see real building types
// instead of crashing on a stripped-down '../../constants' stub built for UnitRestLifecycle itself.
const { BUILDING_TYPES } = loadTsModule('app/constants/entities.ts')

function fixture({ deferWake = false } = {}) {
  const calls = []
  const fades = []
  const wakeCallbacks = []
  const mocks = {
    '../../constants': {
      ACTION_TYPES: { delivery: 'delivery' },
      UNIT_TYPES: { villager: 'Villager' },
      SHEET_TYPES: { standing: 'standing' },
      FADE_DURATION_MS: 200,
      BUILDING_TYPES,
    },
    '../../lib': {
      cartesianToIsometric: (i, j) => [i * 10, j * 10],
      getGroundReliefLevel: () => 0,
      getInstanceZIndex: unit => unit.i + unit.j,
      updateInstanceVisibility: () => {},
    },
    '../../lib/mapSpaces': {
      getMapSpace: () => null,
      getEntityCell: () => null,
      getEntitySpaceMapLike: (_unit, map) => map,
      moveEntityToMapSpace: () => {},
    },
    '../../lib/units/villagerTaskRecovery': {
      resumeVillagerStoredTask: (_unit, task) => {
        calls.push(['resume', task])
        return Boolean(task)
      },
      resumeStrictVillagerAutonomy: () => {
        calls.push(['autonomy'])
        return true
      },
    },
    '../../lib/resources/resourceDelivery': { unitHasDeliverableResources: unit => Boolean(unit.carrying) },
    '../../lib/units/villagerSchedule': {
      shouldVillagerBeAsleep: () => true,
      shouldVillagerWork: () => true,
      getMinutesUntilVillagerWorkStarts: () => 0,
    },
    '../../lib/entities/entityFade': {
      cancelFade: () => {},
      fadeIn: () => {},
      fadeOut: (_unit, _duration, callback) => fades.push(callback),
    },
    '../../lib/entities/overheadIndicator': {
      clearUnitOverheadIndicator: () => {},
      setUnitOverheadIndicator: () => {},
    },
    '../../lib/buildings/interiors': { isBuildingInteriorSupported: building => Boolean(building.supported) },
    '../../lib/buildings/passageCells': {
      createReservedPassageCellLookup: () => ({ has: () => false, size: 0 }),
    },
    '../BuildingInteriorSpaceSystem': {
      ensureRuntimeBuildingInteriorSpace: () => null,
      moveUnitToBuildingInteriorSleep: () => false,
      getBuildingInteriorSpaceForUnit: unit => (unit.spaceId ? {} : null),
    },
    './UnitRestRules': {
      REST_MAX_RETRIES: 3,
      canStartSleepRest: () => true,
      canSleepWithoutRestSite: () => true,
      getNearestRestSite: unit => unit.restSite ?? null,
      getRestTransitionCell: () => null,
      getRestTransitionDurationMs: () => 100,
      getShelterEntryCell: (_unit, shelter) => shelter.entryCell ?? null,
      isUsableShelter: shelter => Boolean(shelter && !shelter.isDestroyed),
    },
    './UnitSleepVisuals': {
      cancelSleepingWakeVisual: () => {},
      clearSleepingVisualState: () => {},
      playSleepingOutsideVisual: () => {},
      setSleepingOutsideFinalVisual: () => calls.push(['lieDown']),
      setDetachedShadowsVisible: () => {},
      playSleepingWakeVisual: (_unit, done) => {
        calls.push(['wake'])
        if (deferWake) wakeCallbacks.push(done)
        else done?.()
      },
    },
  }
  const lifecycle = loadTsModule('app/services/rest/UnitRestLifecycle.ts', { mocks })
  const stateHelpers = loadTsModule('app/services/rest/UnitRestState.ts', { mocks })
  const unit = {
    label: 'unit',
    type: 'Villager',
    i: 1,
    j: 1,
    alpha: 1,
    visible: true,
    context: { scheduler: { elapsedMs: 123 }, map: { removeFromInstanceBucket: () => calls.push(['hide']) } },
    owner: {},
    shelterState: null,
    sendToEvt: (cell, action, options) => calls.push(['send', cell, action, options]),
  }
  return { lifecycle, stateHelpers, unit, calls, fades, wakeCallbacks }
}

function sleepingState(patch = {}) {
  return { status: 'outside', reason: 'sleep', location: 'outside', shelter: null, targetCell: null, ...patch }
}

test('rest cell cleanup tolerates missing cells and never clears another occupant without an identifier', () => {
  const { stateHelpers } = fixture()
  assert.doesNotThrow(() => stateHelpers.clearUnitCell({}))
  const other = {}
  const cell = { has: other, solid: true }
  stateHelpers.clearUnitCell({ currentCell: cell })
  assert.equal(cell.has, other)
  assert.equal(cell.solid, true)
  stateHelpers.clearUnitCell({ label: 'same', currentCell: { has: { label: 'different' }, solid: true } })
  const matching = { has: { label: 'same' }, solid: true }
  stateHelpers.clearUnitCell({ label: 'same', currentCell: matching })
  assert.equal(matching.has, null)
  assert.equal(matching.solid, false)
  const unit = { currentCell: cell }
  cell.has = unit
  stateHelpers.clearUnitCell(unit)
  assert.equal(cell.has, null)
})

test('rest state retains the original work across delivery, shelter entry and outside fallback', () => {
  const { stateHelpers, lifecycle, unit } = fixture()
  const resource = { label: 'tree' }
  Object.assign(unit, { dest: resource, action: 'chopwood', work: 'woodcutter', autonomousJob: 'wood' })
  stateHelpers.rememberRestState(unit, sleepingState({ status: 'delivering' }))
  unit.dest = { label: 'chest' }
  unit.action = 'delivery'
  lifecycle.enterShelterInstant(unit, { supported: true })
  assert.equal(unit.shelterState.status, 'outside')
  assert.equal(unit.shelterState.previousDest, resource)
  assert.equal(unit.shelterState.previousAction, 'chopwood')
  assert.equal(unit.shelterState.previousWork, 'woodcutter')
  assert.equal(unit.shelterState.previousAutonomousJob, 'wood')
})

test('wake return tasks prefer a delivery return task and normalize an absent destination', () => {
  const { lifecycle, unit } = fixture()
  assert.equal(lifecycle.getRestReturnTask(unit), null)
  unit.shelterState = sleepingState()
  assert.equal(lifecycle.getRestReturnTask(unit), null)
  unit.shelterState.previousWork = 'woodcutter'
  assert.deepEqual(lifecycle.getRestReturnTask(unit), {
    dest: null,
    action: null,
    work: 'woodcutter',
    autonomousJob: null,
  })
  const task = { dest: { label: 'tree' }, action: 'chopwood' }
  unit.resourceDeliveryState = { returnTask: task }
  unit.shelterState.previousAction = 'delivery'
  assert.equal(lifecycle.getRestReturnTask(unit), task)
  unit.shelterState.previousAction = 'farm'
  assert.equal(lifecycle.getRestReturnTask(unit).action, 'farm')
})

test('an explicit wake order preserves the suspended task without resuming it', () => {
  const { lifecycle, unit, calls, wakeCallbacks } = fixture({ deferWake: true })
  const state = sleepingState({ previousAction: 'farm' })
  unit.shelterState = state
  unit.sleepVisualState = 'sleeping'
  lifecycle.wakeUnit(unit, { mode: 'order', onComplete: () => calls.push(['complete']) })
  assert.equal(unit.suspendedRestState, state)
  assert.equal(unit.shelterState, null)
  assert.equal(unit.actionLocked, false)
  assert.deepEqual(calls, [['wake']])
  wakeCallbacks[0]()
  assert.deepEqual(calls, [['wake'], ['complete']])
  lifecycle.wakeUnit(unit)
  assert.equal(calls.length, 2)
})

for (const status of ['inside', 'outside']) {
  test(`standing ${status} evening occupants react immediately without lying down or waking`, () => {
    const { lifecycle, unit, calls } = fixture({ deferWake: true })
    const state = sleepingState({ status, shelter: {}, previousAction: 'farm' })
    unit.spaceId = 'interior'
    unit.shelterState = state
    unit.sleepVisualState = null
    unit.actionLocked = true
    unit.setTextures = sheet => calls.push(['sheet', sheet])

    lifecycle.wakeUnit(unit, { mode: 'order', onComplete: () => calls.push(['react']) })

    assert.deepEqual(calls, [['sheet', 'standing'], ['react']])
    assert.equal(unit.suspendedRestState, state)
    assert.equal(unit.shelterState, null)
    assert.equal(unit.actionLocked, false)
    assert.equal(unit.visible, true)
  })
}

for (const restTransitionsEnabled of [false, true]) {
  test(`standing occupants resume without a wake animation with transitions ${restTransitionsEnabled}`, () => {
    const { lifecycle, unit, calls } = fixture({ deferWake: true })
    unit.context.restTransitionsEnabled = restTransitionsEnabled
    unit.shelterState = sleepingState({ previousAction: 'farm' })
    lifecycle.wakeUnit(unit)

    assert.equal(
      calls.some(call => call[0] === 'wake' || call[0] === 'lieDown'),
      false
    )
    if (restTransitionsEnabled) {
      assert.equal(unit.shelterState.status, 'wakingUp')
      assert.equal(calls.length, 0)
    } else {
      assert.equal(unit.shelterState, null)
      assert.equal(calls[0][0], 'resume')
      assert.equal(calls[0][1].action, 'farm')
    }
  })
}

test('blocked shelter exits defer waking unless forced or already inside an interior for an order', () => {
  const { lifecycle, unit, calls } = fixture()
  const state = sleepingState({ status: 'inside', shelter: {} })
  unit.shelterState = state
  unit.sleepVisualState = 'sleeping'
  lifecycle.wakeUnit(unit)
  assert.equal(unit.shelterState, state)
  assert.deepEqual(calls, [])
  unit.spaceId = 'interior'
  lifecycle.wakeUnit(unit, { mode: 'order' })
  assert.equal(unit.shelterState, null)
  assert.deepEqual(calls, [['wake']])
  delete unit.spaceId
  unit.shelterState = sleepingState({ status: 'inside', shelter: { isDestroyed: true } })
  lifecycle.wakeUnitInstant(unit)
  assert.ok(unit.shelterState)
  lifecycle.wakeUnitInstant(unit, { force: true, mode: 'order' })
  assert.equal(unit.shelterState, null)
})

test('instant waking places the unit at the available exit and resumes its stored task', () => {
  const { lifecycle, unit, calls } = fixture()
  const cell = {
    i: 4,
    j: 5,
    z: 2,
    place: occupant => {
      cell.has = occupant
    },
  }
  unit.shelterState = sleepingState({ status: 'inside', shelter: { entryCell: cell }, previousAction: 'farm' })
  lifecycle.wakeUnitInstant(unit)
  assert.equal(unit.currentCell, cell)
  assert.equal(cell.has, unit)
  assert.equal(cell.solid, true)
  assert.equal(unit.x, 40)
  assert.equal(unit.y, 50)
  assert.equal(unit.shelterState, null)
  assert.equal(calls.filter(c => c[0] === 'resume').length, 1)
})

test('a stale shelter fade cannot hide a unit that has already woken', () => {
  const { lifecycle, unit, fades, calls } = fixture()
  lifecycle.enterShelter(unit, {})
  assert.equal(fades.length, 1)
  lifecycle.wakeUnitInstant(unit, { force: true, mode: 'order' })
  fades[0]()
  assert.equal(unit.visible, true)
  assert.equal(unit.alpha, 1)
  assert.equal(
    calls.some(c => c[0] === 'hide'),
    false
  )
})

test('shelter retry updates its target and timestamp but stops at the retry limit', () => {
  const { lifecycle, unit, calls } = fixture()
  const cell = { i: 2, j: 3 }
  const state = sleepingState({ shelter: { entryCell: cell } })
  assert.equal(lifecycle.retryShelterPath(unit, state), true)
  assert.equal(state.targetCell, cell)
  assert.equal(state.startedAtMs, 123)
  assert.equal(state.retryCount, 1)
  state.retryCount = 3
  assert.equal(lifecycle.retryShelterPath(unit, state), false)
  state.retryCount = 0
  state.shelter.entryCell = null
  assert.equal(lifecycle.retryShelterPath(unit, state), false)
  state.shelter.isDestroyed = true
  assert.equal(lifecycle.retryShelterPath(unit, state), false)
  assert.equal(calls.filter(c => c[0] === 'send').length, 1)
})
