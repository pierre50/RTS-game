const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')

function loadModule(relativePath, mocks) {
  const filename = path.join(__dirname, '..', relativePath)
  const source = fs.readFileSync(filename, 'utf8')
  const { code } = babel.transformSync(source, {
    filename,
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }], '@babel/preset-typescript'],
  })
  const module = { exports: {} }
  const localRequire = request => {
    if (Object.hasOwn(mocks, request)) return mocks[request]
    return require(request)
  }
  new Function('module', 'exports', 'require', code)(module, module.exports, localRequire)
  return module.exports
}

const constants = {
  BUILDING_TYPES: { house: 'House', townCenter: 'TownCenter' },
  SHEET_TYPES: { dying: 'dyingSheet', standing: 'standingSheet' },
  UNIT_TYPES: { villager: 'Villager' },
}

function loadShelterSystem(calls) {
  return loadModule('app/services/VillagerShelterSystem.ts', {
    '../constants': constants,
    '../lib': {
      cartesianToIsometric: (i, j) => [i * 10, j * 10],
      getFreeLandCellAroundInstance: (building, _grid, pick) => {
        const cells = building.entryCells ?? []
        return cells.length ? pick(cells) : null
      },
      getGroundReliefLevel: () => 0,
      getInstanceZIndex: unit => unit.i + unit.j,
      resumeVillagerAutonomy: unit => {
        calls.push(['resumeAutonomy', unit.label])
        return Boolean(unit.autonomousJob)
      },
      updateInstanceVisibility: unit => calls.push(['updateVisibility', unit.label]),
    },
    '../lib/overheadIndicator': {
      clearUnitOverheadIndicator: unit => calls.push(['clearIndicator', unit.label]),
      setUnitOverheadIndicator: (unit, type) => calls.push(['indicator', unit.label, type]),
    },
    '../lib/entityFade': {
      fadeOut: (entity, _duration, onComplete) => {
        entity.alpha = 0
        onComplete?.()
      },
      fadeIn: entity => {
        entity.alpha = 1
      },
    },
    '../lib/unitControl': {
      isHeroControlled: unit => unit.controlMode === 'hero',
    },
  }).VillagerShelterSystem
}

function createScheduler() {
  return {
    elapsedMs: 0,
    nextId: 1,
    tasks: new Map(),
    add(callback, interval, name) {
      const id = this.nextId++
      this.tasks.set(id, { callback, interval, name })
      return id
    },
    remove(id) {
      this.tasks.delete(id)
    },
  }
}

function createCell(i, j) {
  return {
    i,
    j,
    x: i * 10,
    y: j * 10,
    z: 0,
    solid: false,
    has: null,
    place(unit) {
      this.has = unit
    },
  }
}

function createContext(hour, players, calls) {
  const scheduler = createScheduler()
  const grid = Array.from({ length: 20 }, (_, i) => Array.from({ length: 20 }, (_, j) => createCell(i, j)))
  return {
    dayNight: { state: { hour } },
    players,
    scheduler,
    map: {
      grid,
      addChild: unit => calls.push(['addChild', unit.label]),
      addToInstanceBucket: unit => calls.push(['addBucket', unit.label]),
      removeFromInstanceBucket: unit => calls.push(['removeBucket', unit.label]),
      updateInstanceBucket: (unit, oldI, oldJ) => calls.push(['updateBucket', unit.label, oldI, oldJ]),
    },
  }
}

function createVillager(owner, extra = {}) {
  const cell = createCell(extra.i ?? 0, extra.j ?? 0)
  const unit = {
    label: extra.label ?? 'villager-1',
    type: constants.UNIT_TYPES.villager,
    owner,
    i: cell.i,
    j: cell.j,
    x: cell.x,
    y: cell.y,
    z: 0,
    currentCell: cell,
    isDead: false,
    isDestroyed: false,
    controlMode: 'standard',
    autonomousJob: extra.autonomousJob ?? null,
    work: extra.work ?? null,
    action: extra.action ?? null,
    dest: extra.dest ?? null,
    path: [],
    sprite: {
      gotoAndStop(frame) {
        this.frame = frame
      },
      stop() {
        this.stopped = true
      },
    },
    shadow: { visible: true },
    syncShadow() {
      this.shadow.visible = true
    },
    setTextures(sheet) {
      this.currentSheet = sheet
    },
    sendToEvt(dest, action) {
      this.dest = dest
      this.action = action
      this.path = dest ? [{ i: dest.i, j: dest.j }] : []
    },
    stopInterval() {
      this.intervalStopped = true
    },
    stopTimeout() {
      this.timeoutStopped = true
    },
    applyReliefLift(level) {
      this.reliefLift = level
    },
    ...extra,
  }
  cell.place(unit)
  owner.units.push(unit)
  return unit
}

test('villagers sleep outside with dying sheet and zZzZ when no shelter exists', () => {
  const calls = []
  const owner = { units: [], buildings: [] }
  const villager = createVillager(owner)
  const context = createContext(23, [owner], calls)
  villager.context = context
  const VillagerShelterSystem = loadShelterSystem(calls)

  new VillagerShelterSystem(context)

  assert.equal(villager.shelterState.status, 'outside')
  assert.equal(villager.currentSheet, constants.SHEET_TYPES.dying)
  assert.equal(villager.actionLocked, true)
  assert.deepEqual(calls.find(call => call[0] === 'indicator'), ['indicator', 'villager-1', 'sleep'])
})

test('villagers move to nearest house entry and disappear inside on arrival', () => {
  const calls = []
  const owner = { units: [], buildings: [] }
  const entry = createCell(4, 5)
  const house = { label: 'house', type: constants.BUILDING_TYPES.house, owner, isBuilt: true, i: 5, j: 5, entryCells: [entry] }
  owner.buildings.push(house)
  const villager = createVillager(owner, { i: 0, j: 0 })
  const context = createContext(23, [owner], calls)
  villager.context = context
  const VillagerShelterSystem = loadShelterSystem(calls)
  const system = new VillagerShelterSystem(context)

  assert.equal(villager.shelterState.status, 'movingToShelter')
  assert.equal(villager.dest, entry)

  villager.i = entry.i
  villager.j = entry.j
  villager.currentCell = entry
  system.updateShelteringUnit(villager)

  assert.equal(villager.shelterState.status, 'inside')
  assert.equal(villager.alpha, 0)
  assert.equal(villager.visible, false)
  assert.equal(villager.shadow.visible, false)
  assert.deepEqual(calls.find(call => call[0] === 'removeBucket'), ['removeBucket', 'villager-1'])
})

test('villagers wake in the morning and resume their previous autonomous job', () => {
  const calls = []
  const owner = { units: [], buildings: [] }
  const entry = createCell(4, 5)
  const house = { label: 'house', type: constants.BUILDING_TYPES.house, owner, isBuilt: true, i: 5, j: 5, entryCells: [entry] }
  owner.buildings.push(house)
  const villager = createVillager(owner, { autonomousJob: 'wood' })
  villager.shelterState = {
    status: 'inside',
    location: 'shelter',
    shelter: house,
    previousAutonomousJob: 'wood',
    previousWork: 'woodcutter',
    previousAction: 'chopwood',
    previousDest: null,
  }
  const context = createContext(6, [owner], calls)
  villager.context = context
  const VillagerShelterSystem = loadShelterSystem(calls)

  new VillagerShelterSystem(context)

  assert.equal(villager.shelterState, null)
  assert.equal(villager.alpha, 1)
  assert.equal(villager.shadow.visible, true)
  assert.equal(villager.currentSheet, constants.SHEET_TYPES.standing)
  assert.equal(villager.i, entry.i)
  assert.equal(villager.j, entry.j)
  assert.deepEqual(calls.find(call => call[0] === 'resumeAutonomy'), ['resumeAutonomy', 'villager-1'])
})

test('violent attacks send villagers to the town center before a closer house', () => {
  const calls = []
  const owner = {
    units: [],
    buildings: [],
    isEnemy(other) {
      return other?.label === 'enemy'
    },
  }
  const houseEntry = createCell(2, 2)
  const townCenterEntry = createCell(8, 8)
  owner.buildings.push(
    { label: 'house', type: constants.BUILDING_TYPES.house, owner, isBuilt: true, i: 2, j: 2, entryCells: [houseEntry] },
    {
      label: 'tc',
      type: constants.BUILDING_TYPES.townCenter,
      owner,
      isBuilt: true,
      i: 8,
      j: 8,
      entryCells: [townCenterEntry],
    }
  )
  const villager = createVillager(owner, { i: 0, j: 0 })
  const context = createContext(12, [owner], calls)
  villager.context = context
  const VillagerShelterSystem = loadShelterSystem(calls)
  const system = new VillagerShelterSystem(context)

  const sheltered = system.handleVillagerDangerShelter(villager, {
    family: 'unit',
    owner: { label: 'enemy' },
    isDead: false,
    isDestroyed: false,
  })

  assert.equal(sheltered, true)
  assert.equal(villager.shelterState.reason, 'danger')
  assert.equal(villager.dest, townCenterEntry)
})

test('critical shelters eject hidden villagers', () => {
  const calls = []
  const owner = { units: [], buildings: [] }
  const entry = createCell(4, 5)
  const house = {
    label: 'house',
    type: constants.BUILDING_TYPES.house,
    owner,
    isBuilt: true,
    isDead: false,
    isDestroyed: false,
    hitPoints: 2,
    totalHitPoints: 20,
    i: 5,
    j: 5,
    entryCells: [entry],
  }
  owner.buildings.push(house)
  const villager = createVillager(owner)
  const context = createContext(12, [owner], calls)
  villager.context = context
  villager.shelterState = { status: 'inside', reason: 'sleep', location: 'shelter', shelter: house }
  villager.alpha = 0
  villager.visible = false
  const VillagerShelterSystem = loadShelterSystem(calls)
  const system = new VillagerShelterSystem(context)

  system.evacuateVillagersIfShelterUnsafe(house)

  assert.equal(villager.shelterState, null)
  assert.equal(villager.alpha, 1)
  assert.equal(villager.i, entry.i)
  assert.equal(villager.j, entry.j)
})
