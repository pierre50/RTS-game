const test = require('node:test')
const assert = require('node:assert/strict')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function fixture() {
  const owner = { units: [], buildings: [] }
  const grid = id =>
    Array.from({ length: 16 }, (_, i) =>
      Array.from({ length: 16 }, (_, j) => ({
        i,
        j,
        x: (i - j) * 32,
        y: (i + j) * 16,
        z: 0,
        spaceId: id,
        solid: false,
        has: null,
        category: 'Ground',
        place(unit) {
          this.has = unit
        },
      }))
    )
  const outside = { id: 'outside', grid: grid('outside'), kind: 'outside', portals: [], size: 15 }
  const map = { ...outside, spaces: new Map([['outside', outside]]), revealEverything: true }
  const context = { map, players: [owner], scheduler: { elapsedMs: 0 }, controls: {} }
  const spaceId = entity => entity?.spaceId || 'outside'
  const space = entity => map.spaces.get(spaceId(entity))
  const portals = []
  const cache = new Map()
  const mocks = {
    '../../lib': {
      cartesianToIsometric: (i, j) => [(i - j) * 32, (i + j) * 16],
      getInstanceZIndex: unit => unit.i + unit.j,
      updateInstanceVisibility() {},
    },
    '../../lib/mapSpaces': {
      getEntitySpaceId: spaceId,
      sameMapSpace: (a, b) => spaceId(a) === spaceId(b),
      sameCellMapSpace: (a, b) => spaceId(a) === spaceId(b),
      getMapSpace: (_map, id) => map.spaces.get(id || 'outside'),
      getEntitySpaceGrid: entity => space(entity)?.grid,
      getEntitySpaceMapLike: entity => space(entity),
      getEntityCell: entity => space(entity)?.grid[entity.i]?.[entity.j],
      moveEntityToMapSpace: (_map, unit, dest, cell) => {
        Object.assign(unit, { spaceId: dest.id, i: cell.i, j: cell.j, x: cell.x, y: cell.y, currentCell: cell })
        cell.place(unit)
        cell.solid = true
      },
    },
    '../../lib/grid/movement': {
      getInstancePath: (unit, i, j) => {
        const cell = space(unit)?.grid[i]?.[j]
        return !cell || cell.unreachable || (cell.solid && cell.has !== unit)
          ? []
          : Array.from({ length: Math.max(Math.abs(unit.i - i), Math.abs(unit.j - j)) }, () => cell)
      },
    },
    '../../lib/buildings/passageCells': {
      createReservedPassageCellLookup: () => ({ has: cell => !!cell?.passage }),
      canUnitUseCellAsIdleDestination: (unit, cell) => !!cell && !cell.solid && !cell.has && !cell.passage,
    },
    '../../lib/buildings/interiors': { isBuildingInteriorSupported: b => ['House', 'TownCenter'].includes(b.type) },
    '../../lib/buildings/interiorAccess': { canUnitEnterBuildingInterior: (_unit, b) => !b.buildingUpgrade },
    '../BuildingInteriorSpaceSystem': {
      ensureRuntimeBuildingInteriorSpace: () => null,
      getBuildingInteriorSpaceForUnit: u => (space(u)?.kind === 'interior' ? space(u) : null),
    },
    '../../../engine/services/BuildingInteriorSpaceLookup': {
      isBuildingInteriorRuntimeSpace: s => s?.kind === 'interior',
    },
    '../../lib/units/villagerSchedule': {
      isSoldierUnit: () => false,
      hasDailyRestSchedule: () => true,
      shouldVillagerBeAsleep: unit => !unit.evening,
      getMinutesUntilVillagerBed: unit => unit.minutesUntilBed ?? 60,
      shouldVillagerWork: () => true,
      getMinutesUntilVillagerWorkStarts: () => 0,
    },
    '../spacePortal/SpacePortalSystem': {
      clearUnitSpacePortalRoute: unit => {
        unit.spacePortalState = null
      },
      routeUnitThroughSpacePortal: (_context, unit, portal, options) => {
        portals.push({ unit, portal, options })
        unit.spacePortalState = { portalId: portal.id }
        return true
      },
    },
    '../../lib/entities/entityFade': { cancelFade() {}, fadeIn() {} },
    '../../lib/entities/overheadIndicator': { clearUnitOverheadIndicator() {}, setUnitOverheadIndicator() {} },
    '../../lib/units/villagerTaskRecovery': {
      resumeVillagerStoredTask: () => false,
      resumeStrictVillagerAutonomy: () => false,
    },
    '../../lib/resources/resourceDelivery': { unitHasDeliverableResources: () => false },
    './UnitSleepVisuals': {
      keepSleepingOutsideVisual() {},
      cancelSleepingWakeVisual() {},
      clearSleepingVisualState: u => {
        u.sleepVisualState = null
      },
      playSleepingOutsideVisual: u => {
        u.sleepVisualState = 'sleeping'
      },
      setSleepingOutsideFinalVisual: u => {
        u.sleepVisualState = 'sleeping'
      },
      setDetachedShadowsVisible() {},
      playSleepingWakeVisual: (_u, done) => done?.(),
    },
  }
  const load = path => loadTsModule(path, { mocks, moduleCache: cache })
  const sites = load('app/services/rest/UnitRestShelter.ts')
  mocks['./UnitRestRules'] = {
    REST_MAX_RETRIES: 3,
    REST_ORDER_GRACE_MS: 2500,
    isSleepTime: () => true,
    shouldRest: () => true,
    canStartSleepRest: () => true,
    canSleepWithoutRestSite: () => true,
    getNearestRestSite: (u, excluded) =>
      sites.getNearestFurnitureRestSite(u, excluded) ?? sites.getCurrentOutsideRestSite(u),
    getRestTransitionCell: () => null,
    getRestTransitionDurationMs: () => 0,
  }
  const lifecycle = load('app/services/rest/UnitRestLifecycle.ts')
  const unit = (label, id = 'outside') => {
    const cell = map.spaces.get(id).grid[2][2]
    const u = {
      label,
      owner,
      context,
      type: 'Villager',
      i: 2,
      j: 2,
      x: cell.x,
      y: cell.y,
      spaceId: id,
      currentCell: cell,
      speed: 1,
      sendToEvt(dest) {
        this.dest = dest
        this.path = [dest]
      },
      setTextures() {},
      sprite: { stop() {} },
      applyReliefLift(level) {
        this.relief = level
      },
      stopInterval() {},
      stopTimeout() {},
    }
    owner.units.push(u)
    return u
  }
  const building = (type, i = 6, j = 6, id = 'outside') => {
    const b = {
      type,
      family: 'building',
      i,
      j,
      size: type === 'CampBedroll' ? 2 : 1,
      label: `${type}-${owner.buildings.length}`,
      owner,
      context,
      spaceId: id,
      isBuilt: true,
    }
    owner.buildings.push(b)
    if (type === 'CampBedroll') {
      const surface = load('app/lib/terrain/furnitureSurface.ts')
      for (let x = i; x < i + 2; x++)
        for (let y = j; y < j + 2; y++) {
          const cell = map.spaces.get(id).grid[x][y]
          cell.has = b
          surface.registerFurnitureSurface(cell, b)
        }
    }
    return b
  }
  const interior = id => {
    const house = building('House', 8, 8)
    const room = { id, grid: grid(id), kind: 'interior', building: house, size: 15, renderer: {} }
    const entry = {
      id: `${id}:entry`,
      sourceSpaceId: 'outside',
      sourceCell: outside.grid[8][7],
      targetSpaceId: id,
      targetCell: room.grid[1][1],
    }
    const exit = {
      id: `${id}:exit`,
      sourceSpaceId: id,
      sourceCell: room.grid[1][1],
      targetSpaceId: 'outside',
      targetCell: outside.grid[8][7],
    }
    room.portals = [entry, exit]
    map.spaces.set(id, room)
    return room
  }
  const transfer = () => {
    const { unit: u, portal: p, options: o } = portals.shift()
    if (!o.shouldContinue()) return false
    Object.assign(u, {
      spaceId: p.targetSpaceId,
      i: p.targetCell.i,
      j: p.targetCell.j,
      currentCell: p.targetCell,
      spacePortalState: null,
    })
    o.onTransferred()
    return true
  }
  return { owner, map, unit, building, interior, sites, lifecycle, portals, transfer, load }
}

test('interior beds on a wall border remain usable but water and hidden cells do not', () => {
  const f = fixture()
  const room = f.interior('room')
  const unit = f.unit('sleeper', 'room')
  const bed = f.building('CampBedroll', 6, 6, 'room')
  const cell = room.grid[6][6]
  cell.border = true
  assert.equal(f.sites.getRestTargetSite(unit, bed)?.targetCell, cell)
  cell.waterBorder = true
  assert.equal(f.sites.getRestTargetSite(unit, bed), null)
  cell.waterBorder = false
  cell.terrainHidden = true
  assert.equal(f.sites.getRestTargetSite(unit, bed), null)
  const outdoorBed = f.building('CampBedroll', 8, 8)
  f.map.grid[8][8].border = true
  assert.equal(f.sites.getRestTargetSite(unit, outdoorBed), null)
})

test('priority is free bed, fire, then current position; houses alone offer no sleep target', () => {
  const f = fixture(),
    u = f.unit('one')
  f.building('House')
  assert.equal(f.sites.getNearestFurnitureRestSite(u), null)
  const fire = f.building('FireCamp', 4, 4)
  assert.equal(f.sites.getNearestFurnitureRestSite(u).restTarget, fire)
  const bed = f.building('CampBedroll', 10, 10)
  assert.equal(f.sites.getNearestFurnitureRestSite(u).restTarget, bed)
  const other = f.unit('two')
  other.shelterState = { status: 'movingToRest', restTarget: bed }
  assert.equal(f.sites.getNearestFurnitureRestSite(u).restTarget, fire)
  fire.isDestroyed = true
  assert.equal(f.sites.getNearestFurnitureRestSite(u), null)
  assert.equal(f.sites.getCurrentOutsideRestSite(u).targetCell, u.currentCell)
})

test('departure reserves one entire bed; wake and death release it', () => {
  const f = fixture(),
    a = f.unit('a'),
    b = f.unit('b'),
    bed = f.building('CampBedroll')
  assert.equal(f.lifecycle.sendUnitToRest(a, 'sleep'), true)
  assert.equal(a.shelterState.restTarget, bed)
  assert.equal(f.sites.getNearestFurnitureRestSite(b), null)
  f.lifecycle.wakeUnitInstant(a, { mode: 'order' })
  assert.equal(f.sites.getNearestFurnitureRestSite(b).restTarget, bed)
  f.lifecycle.sendUnitToRest(a, 'sleep')
  a.isDead = true
  assert.equal(f.sites.getNearestFurnitureRestSite(b).restTarget, bed)
})

test('bed in another interior is reserved before both door crossings and then approached', () => {
  const f = fixture()
  f.interior('room-a')
  f.interior('room-b')
  const bed = f.building('CampBedroll', 6, 6, 'room-b'),
    u = f.unit('u', 'room-a')
  f.lifecycle.sendUnitToRest(u, 'sleep')
  assert.equal(u.shelterState.restTarget, bed)
  assert.equal(f.portals[0].portal.id, 'room-a:exit')
  f.transfer()
  assert.equal(f.portals[0].portal.id, 'room-b:entry')
  f.transfer()
  assert.equal(u.dest, f.map.spaces.get('room-b').grid[6][6])
  assert.equal(u.shelterState.restTarget, bed)
})

test('beds outdoors and indoor fires can both be reached across a door', () => {
  const f = fixture()
  f.interior('room')
  const u = f.unit('u', 'room'),
    bed = f.building('CampBedroll')
  assert.equal(f.sites.getNearestFurnitureRestSite(u).restTarget, bed)
  bed.isDestroyed = true
  const fire = f.building('FireCamp', 6, 6, 'room')
  u.spaceId = 'outside'
  u.currentCell = f.map.grid[2][2]
  f.lifecycle.sendUnitToRest(u, 'sleep')
  assert.equal(u.shelterState.restTarget, fire)
  assert.equal(f.portals[0].portal.id, 'room:entry')
})

test('unreachable, enemy, unfinished and too-distant-before-bed targets are rejected', () => {
  const f = fixture(),
    u = f.unit('u'),
    bed = f.building('CampBedroll')
  const cell = f.map.grid[6][6]
  cell.unreachable = true
  assert.equal(f.sites.getRestTargetSite(u, bed), null)
  cell.unreachable = false
  bed.owner = {}
  assert.equal(f.sites.getRestTargetSite(u, bed), null)
  bed.owner = u.owner
  bed.isBuilt = false
  assert.equal(f.sites.getRestTargetSite(u, bed), null)
  bed.isBuilt = true
  u.evening = true
  u.minutesUntilBed = 0.0001
  assert.equal(f.sites.getRestTargetSite(u, bed), null)
})

test('time jumps put the sleeper on the mattress and keep furniture occupancy and reservation', () => {
  const f = fixture()
  f.interior('room')
  const u = f.unit('u'),
    bed = f.building('CampBedroll', 6, 6, 'room')
  assert.equal(f.lifecycle.settleUnitRestForTimeJump(u, true), true)
  assert.equal(u.spaceId, 'room')
  assert.equal(u.sleepVisualState, 'sleeping')
  assert.equal(u.shelterState.restTarget, bed)
  assert.equal(f.map.spaces.get('room').grid[6][6].has, bed)
  assert.deepEqual({ x: u.x, y: u.y }, f.load('app/lib/terrain/furnitureSurface.ts').getBedRestPoint(bed))
  assert.equal(u.relief, 0.5)
})

test('wake cancels a pending door trip so its callback cannot reclaim the bed', () => {
  const f = fixture()
  f.interior('room')
  const u = f.unit('u')
  f.building('CampBedroll', 6, 6, 'room')
  f.lifecycle.sendUnitToRest(u, 'sleep')
  f.lifecycle.wakeUnitInstant(u, { mode: 'order' })
  assert.equal(u.shelterState, null)
  assert.equal(f.transfer(), false)
})

test('normal arrival sleeps on the reserved mattress, never at matching coordinates in another space', () => {
  const f = fixture()
  f.interior('room')
  const bed = f.building('CampBedroll', 6, 6, 'room'),
    u = f.unit('u')
  const { updateMovingRestUnit } = f.load('app/services/rest/UnitRestStateTransitions.ts')
  f.lifecycle.sendUnitToRest(u, 'sleep')
  Object.assign(u, { i: 6, j: 6, spacePortalState: null })
  updateMovingRestUnit(u)
  assert.equal(u.sleepVisualState, null)
  f.transfer()
  Object.assign(u, { i: 6, j: 6, currentCell: f.map.spaces.get('room').grid[6][6], path: [] })
  updateMovingRestUnit(u)
  assert.equal(u.sleepVisualState, 'sleeping')
  assert.equal(u.shelterState.restTarget, bed)
  assert.deepEqual({ x: u.x, y: u.y }, f.load('app/lib/terrain/furnitureSurface.ts').getBedRestPoint(bed))
})

test('destroyed and persistently unreachable beds release reservations and fall back to a fire', () => {
  for (const destroyed of [false, true]) {
    const f = fixture(),
      u = f.unit('u'),
      bed = f.building('CampBedroll'),
      fire = f.building('FireCamp', 4, 4)
    const { updateMovingRestUnit } = f.load('app/services/rest/UnitRestStateTransitions.ts')
    f.lifecycle.sendUnitToRest(u, 'sleep')
    if (destroyed) bed.isDestroyed = true
    else {
      u.path = []
      u.dest = null
      u.context.scheduler.elapsedMs = 3000
      u.shelterState.retryCount = 3
    }
    updateMovingRestUnit(u)
    assert.equal(u.shelterState.restTarget, fire)
    assert.equal(u.shelterState.status, 'movingToRest')
    assert.notEqual(u.sleepVisualState, 'sleeping')
  }
})
