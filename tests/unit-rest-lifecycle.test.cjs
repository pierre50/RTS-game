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
      ACTION_TYPES: { delivery: 'delivery', attack: 'attack' },
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
      sameCellMapSpace: () => true,
      getEntitySpaceId: unit => unit.spaceId ?? 'outside',
      getMapSpace: () => null,
      getEntityCell: () => null,
      getEntitySpaceMapLike: (_unit, map) => map,
      moveEntityToMapSpace: () => {},
    },
    '../../lib/units/autonomy/villagerTaskRecovery': {
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
    '../../lib/units/village/villagerSchedule': {
      hasDailyRestSchedule: () => true,
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
    '../spacePortal/SpacePortalSystem': {
      clearUnitSpacePortalRoute: unit => {
        unit.spacePortalState = null
      },
      routeUnitThroughSpacePortal: () => false,
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

test('rest state retains the original work across delivery and rest fallback', () => {
  const { stateHelpers, lifecycle, unit } = fixture()
  const resource = { label: 'tree' }
  Object.assign(unit, { dest: resource, action: 'chopwood', work: 'woodcutter', autonomousJob: 'wood' })
  stateHelpers.rememberRestState(unit, sleepingState({ status: 'delivering' }))
  unit.dest = { label: 'chest' }
  unit.action = 'delivery'
  lifecycle.waitOutsideForSleep(unit)
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

test('combat resumes immediately after leaving a shelter even with rest transitions enabled', () => {
  const { lifecycle, unit, calls } = fixture()
  unit.context.restTransitionsEnabled = true
  const task = { action: 'attack', dest: { label: 'enemy' }, work: 'attacker' }
  assert.equal(lifecycle.startUnitWakeTransitionFromTask(unit, task), true)
  assert.equal(unit.shelterState, null)
  assert.deepEqual(calls, [['resume', task]])
})
