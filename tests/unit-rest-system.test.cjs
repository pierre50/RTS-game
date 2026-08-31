const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')
const { requireFromTsFile } = require('./helpers/loadTsModule.cjs')

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
    return requireFromTsFile(request, filename, mocks)
  }
  new Function('module', 'exports', 'require', code)(module, module.exports, localRequire)
  return module.exports
}

const constants = {
  ACTION_TYPES: { attack: 'attack', delivery: 'delivery' },
  BUILDING_TYPES: { fireCamp: 'FireCamp', house: 'House', townCenter: 'TownCenter' },
  FAMILY_TYPES: { animal: 'animal', unit: 'unit' },
  PLAYER_TYPES: { bandits: 'Bandits' },
  SHEET_TYPES: { dying: 'dyingSheet', standing: 'standingSheet' },
  UNIT_TYPES: {
    banditArcher: 'BanditArcher',
    banditChief: 'BanditChief',
    banditSword: 'BanditSword',
    chief: 'Chief',
    hero: 'Hero',
    infantry: 'Fantassin',
    villager: 'Villager',
  },
  WORK_TYPES: { attacker: 'attacker' },
}

function loadUnitRestSystem(calls, fadeOverrides = {}, moduleOverrides = {}) {
  return loadModule('app/services/rest/UnitRestSystem.ts', {
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
    '../lib/entities/overheadIndicator': {
      clearUnitOverheadIndicator: unit => calls.push(['clearIndicator', unit.label]),
      setUnitOverheadIndicator: (unit, type) => calls.push(['indicator', unit.label, type]),
    },
    '../lib/entities/entityFade': {
      cancelFade: fadeOverrides.cancelFade ?? (entity => calls.push(['cancelFade', entity.label])),
      fadeOut:
        fadeOverrides.fadeOut ??
        ((entity, _duration, onComplete) => {
          entity.alpha = 0
          onComplete?.()
        }),
      fadeIn:
        fadeOverrides.fadeIn ??
        (entity => {
          entity.alpha = 1
        }),
    },
    '../lib/units/unitControl': {
      isHeroControlled: unit => unit.controlMode === 'hero',
    },
    '../../lib/combat': {
      evaluateCombatMorale: () => 'fight',
    },
    ...moduleOverrides,
  }).UnitRestSystem
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

function runSchedulerTaskByName(scheduler, name, times = 1) {
  for (let index = 0; index < times; index += 1) {
    const task = [...scheduler.tasks.values()].find(entry => entry.name === name)
    assert.ok(task, `expected scheduler task ${name}`)
    task.callback()
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
    controls: { heroUnit: null },
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

function createUnit(owner, extra = {}) {
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
      textures: ['sleep-0', 'sleep-1', 'sleep-2'],
      loop: true,
      onComplete: null,
      gotoAndStop(frame) {
        this.frame = frame
      },
      gotoAndPlay(frame) {
        this.frame = frame
        this.playedFrom = frame
        this.playing = true
      },
      stop() {
        this.playing = false
        this.stopped = true
      },
    },
    shadow: {
      visible: true,
      stop() {
        this.stopped = true
      },
    },
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
  const villager = createUnit(owner)
  const context = createContext(23, [owner], calls)
  villager.context = context
  const UnitRestSystem = loadUnitRestSystem(calls)

  new UnitRestSystem(context)

  assert.equal(villager.shelterState.status, 'outside')
  assert.equal(villager.currentSheet, constants.SHEET_TYPES.dying)
  assert.equal(villager.sprite.loop, false)
  assert.equal(villager.sprite.playing, true)
  assert.equal(villager.sprite.playedFrom, 0)
  villager.sprite.onComplete()
  assert.equal(villager.sprite.frame, 2)
  assert.equal(villager.shadow.stopped, true)
  assert.equal(villager.alpha, 1)
  assert.equal(villager.visible, true)
  assert.equal(villager.shadow.visible, false)
  assert.equal(villager.actionLocked, true)
  assert.deepEqual(
    calls.find(call => call[0] === 'cancelFade'),
    ['cancelFade', 'villager-1']
  )
  assert.deepEqual(
    calls.find(call => call[0] === 'indicator'),
    ['indicator', 'villager-1', 'sleep']
  )
})

test('sleeping equipped units freeze appearance layers with the hurt sheet', () => {
  const calls = []
  const owner = { units: [], buildings: [] }
  const equipmentLayer = {
    currentFrame: 0,
    loop: true,
    playing: false,
    textures: ['gear-0', 'gear-1', 'gear-2', 'gear-3'],
    gotoAndPlay(frame) {
      this.currentFrame = frame
      this.playing = true
      calls.push(['layerPlay', frame])
    },
    gotoAndStop(frame) {
      this.currentFrame = frame
      this.playing = false
      calls.push(['layerStopFrame', frame])
    },
    stop() {
      this.playing = false
      calls.push(['layerStop'])
    },
  }
  const villager = createUnit(owner, {
    appearanceLayerSprites: new Map([[0, equipmentLayer]]),
  })
  const context = createContext(23, [owner], calls)
  villager.context = context
  const UnitRestSystem = loadUnitRestSystem(calls)

  new UnitRestSystem(context)

  assert.deepEqual(
    calls.find(call => call[0] === 'layerPlay'),
    ['layerPlay', 0]
  )
  assert.equal(equipmentLayer.loop, false)
  assert.equal(equipmentLayer.playing, true)

  villager.sprite.onComplete()

  assert.equal(equipmentLayer.currentFrame, 2)
  assert.equal(equipmentLayer.playing, false)
  assert.deepEqual(calls.filter(call => call[0] === 'layerStopFrame').at(-1), ['layerStopFrame', 2])
})

test('villagers start going to sleep at 18h', () => {
  const calls = []
  const owner = { units: [], buildings: [] }
  const villager = createUnit(owner)
  const context = createContext(18, [owner], calls)
  villager.context = context
  const UnitRestSystem = loadUnitRestSystem(calls)

  new UnitRestSystem(context)

  assert.equal(villager.shelterState.status, 'outside')
  assert.equal(villager.shelterState.reason, 'sleep')
})

test('runtime rest transitions keep shelterless villagers winding down past 19h', () => {
  const calls = []
  const owner = { units: [], buildings: [] }
  const villager = createUnit(owner, { i: 5, j: 5 })
  const context = createContext(18, [owner], calls)
  context.restTransitionsEnabled = true
  villager.context = context
  const UnitRestSystem = loadUnitRestSystem(calls)

  new UnitRestSystem(context)

  assert.equal(villager.shelterState.status, 'windingDown')
  assert.equal(villager.shelterState.reason, 'sleep')
  assert.ok(villager.shelterState.transitionUntilMs >= 75_000)
  assert.notEqual(villager.currentSheet, constants.SHEET_TYPES.dying)

  context.scheduler.elapsedMs = 60_000
  context.dayNight.state.hour = 19
  const transitionCell = villager.shelterState.transitionTargetCell
  villager.i = transitionCell.i
  villager.j = transitionCell.j
  villager.currentCell = transitionCell
  villager.dest = null
  villager.path = []

  const system = new UnitRestSystem(context)
  system.updateRestingUnit(villager)

  assert.equal(villager.shelterState.status, 'windingDown')
  assert.notEqual(villager.currentSheet, constants.SHEET_TYPES.dying)
})

test('villagers stay awake before 18h', () => {
  const calls = []
  const owner = { units: [], buildings: [] }
  const villager = createUnit(owner)
  const context = createContext(17, [owner], calls)
  villager.context = context
  const UnitRestSystem = loadUnitRestSystem(calls)

  new UnitRestSystem(context)

  assert.equal(villager.shelterState, undefined)
})

test('player villagers stay awake at night in an undominated portal world', () => {
  const calls = []
  const owner = { units: [], buildings: [], isPlayed: true }
  const villager = createUnit(owner)
  const context = createContext(23, [owner], calls)
  context.getCurrentWorldId = () => 'hostile-world'
  context.getWorldGraph = () => ({
    rootWorldId: 'home-world',
    nodes: {
      'home-world': { id: 'home-world', children: [], discoveredAt: 0, visitedAt: 0 },
      'hostile-world': {
        id: 'hostile-world',
        children: [],
        discoveredAt: 0,
        encounter: 'village',
        factionIds: ['hostile-faction'],
        parentId: 'home-world',
        visitedAt: 0,
      },
    },
  })
  villager.context = context
  const UnitRestSystem = loadUnitRestSystem(calls)

  const system = new UnitRestSystem(context)
  system.sendUnitToSleep(villager)

  assert.equal(villager.shelterState, undefined)
})

test('local faction villagers can sleep in their dominated portal world', () => {
  const calls = []
  const owner = { units: [], buildings: [], factionId: 'local-faction' }
  const villager = createUnit(owner)
  const context = createContext(23, [owner], calls)
  context.getCurrentWorldId = () => 'local-world'
  context.getWorldGraph = () => ({
    rootWorldId: 'home-world',
    nodes: {
      'home-world': { id: 'home-world', children: [], discoveredAt: 0, visitedAt: 0 },
      'local-world': {
        id: 'local-world',
        children: [],
        discoveredAt: 0,
        encounter: 'village',
        factionIds: ['local-faction'],
        parentId: 'home-world',
        visitedAt: 0,
      },
    },
  })
  villager.context = context
  const UnitRestSystem = loadUnitRestSystem(calls)

  new UnitRestSystem(context)

  assert.equal(villager.shelterState.reason, 'sleep')
})

test('rest tick sends villagers and non-villagers to sleep without tired state', () => {
  const calls = []
  const owner = { units: [], buildings: [] }
  const villager = createUnit(owner, { label: 'villager' })
  const soldier = createUnit(owner, { label: 'soldier', type: constants.UNIT_TYPES.infantry })
  const context = createContext(23, [owner], calls)
  villager.context = context
  soldier.context = context
  const UnitRestSystem = loadUnitRestSystem(calls)
  const system = new UnitRestSystem(context)

  system.sendUnitsToSleep()

  assert.equal(villager.shelterState.reason, 'sleep')
  assert.equal(villager.tired, undefined)
  assert.equal(soldier.shelterState.reason, 'sleep')
  assert.equal(soldier.tired, undefined)
})

test('rest transitions make villagers, chiefs and infantry linger before moving to their rest site', () => {
  const calls = []
  const owner = { units: [], buildings: [] }
  const house = { label: 'house', type: constants.BUILDING_TYPES.house, owner, isBuilt: true, i: 5, j: 5 }
  owner.buildings.push(house)
  const villager = createUnit(owner, { i: 1, j: 1, label: 'villager' })
  const chief = createUnit(owner, { i: 1, j: 2, label: 'chief', type: constants.UNIT_TYPES.chief })
  const soldier = createUnit(owner, { i: 1, j: 3, label: 'soldier', type: constants.UNIT_TYPES.infantry })
  const context = createContext(23, [owner], calls)
  context.restTransitionsEnabled = true
  for (const unit of [villager, chief, soldier]) unit.context = context
  const UnitRestSystem = loadUnitRestSystem(calls)
  const system = new UnitRestSystem(context)

  for (const unit of [villager, chief, soldier]) {
    assert.equal(unit.shelterState.status, 'windingDown')
    assert.equal(unit.shelterState.reason, 'sleep')
    assert.ok(unit.shelterState.transitionTargetCell)
    assert.ok(unit.shelterState.targetCell)
    assert.equal(unit.dest, unit.shelterState.transitionTargetCell)
    assert.notEqual(unit.dest, unit.shelterState.targetCell)

    const transitionCell = unit.shelterState.transitionTargetCell
    unit.i = transitionCell.i
    unit.j = transitionCell.j
    unit.currentCell = transitionCell
    context.scheduler.elapsedMs = unit.shelterState.transitionUntilMs + 1
    system.updateRestingUnit(unit)

    assert.equal(unit.shelterState.status, 'movingToRest')
    assert.equal(unit.dest, unit.shelterState.targetCell)
  }
})

test('military units prefer a visible fire camp before sleeping outside', () => {
  const calls = []
  const owner = { units: [], buildings: [] }
  const soldier = createUnit(owner, { label: 'soldier', type: constants.UNIT_TYPES.infantry, sight: 12 })
  const context = createContext(23, [owner], calls)
  const fireCamp = {
    label: 'fire',
    type: constants.BUILDING_TYPES.fireCamp,
    owner,
    isBuilt: true,
    i: 5,
    j: 5,
    visible: true,
  }
  context.map.grid[5][5].has = fireCamp
  context.map.grid[5][5].solid = true
  owner.buildings.push(fireCamp)
  soldier.context = context
  const UnitRestSystem = loadUnitRestSystem(calls)

  new UnitRestSystem(context)

  assert.equal(soldier.shelterState.status, 'movingToRest')
  assert.equal(soldier.shelterState.location, 'outside')
  assert.equal(soldier.shelterState.shelter, null)
  assert.ok(
    Math.abs(soldier.shelterState.targetCell.i - fireCamp.i) +
      Math.abs(soldier.shelterState.targetCell.j - fireCamp.j) <=
      1
  )
})

test('military units use building shelters when no visible fire camp is available', () => {
  const calls = []
  const owner = { units: [], buildings: [] }
  const house = { label: 'house', type: constants.BUILDING_TYPES.house, owner, isBuilt: true, i: 5, j: 5 }
  owner.buildings.push(house)
  const soldier = createUnit(owner, { i: 0, j: 0, label: 'soldier', type: constants.UNIT_TYPES.infantry })
  const context = createContext(23, [owner], calls)
  soldier.context = context
  const entry = context.map.grid[6][7]
  const UnitRestSystem = loadUnitRestSystem(calls)

  new UnitRestSystem(context)

  assert.equal(soldier.shelterState.status, 'movingToRest')
  assert.equal(soldier.shelterState.location, 'shelter')
  assert.equal(soldier.shelterState.shelter, house)
  assert.equal(soldier.dest, entry)
})

test('military units prefer visible fire camps over building shelters', () => {
  const calls = []
  const owner = { units: [], buildings: [] }
  const house = { label: 'house', type: constants.BUILDING_TYPES.house, owner, isBuilt: true, i: 1, j: 1 }
  const fireCamp = {
    label: 'fire',
    type: constants.BUILDING_TYPES.fireCamp,
    owner,
    isBuilt: true,
    i: 5,
    j: 5,
    visible: true,
  }
  owner.buildings.push(house, fireCamp)
  const soldier = createUnit(owner, { i: 0, j: 0, label: 'soldier', sight: 12, type: constants.UNIT_TYPES.infantry })
  const context = createContext(23, [owner], calls)
  context.map.grid[5][5].has = fireCamp
  context.map.grid[5][5].solid = true
  soldier.context = context
  const UnitRestSystem = loadUnitRestSystem(calls)

  new UnitRestSystem(context)

  assert.equal(soldier.shelterState.status, 'movingToRest')
  assert.equal(soldier.shelterState.location, 'outside')
  assert.equal(soldier.shelterState.shelter, null)
  assert.ok(
    Math.abs(soldier.shelterState.targetCell.i - fireCamp.i) +
      Math.abs(soldier.shelterState.targetCell.j - fireCamp.j) <=
      1
  )
})

test('time jump to night settles military sleepers around a visible fire camp instantly', () => {
  const calls = []
  const owner = { units: [], buildings: [] }
  const soldier = createUnit(owner, { label: 'soldier', type: constants.UNIT_TYPES.infantry, sight: 12 })
  const context = createContext(12, [owner], calls)
  const fireCamp = {
    label: 'fire',
    type: constants.BUILDING_TYPES.fireCamp,
    owner,
    isBuilt: true,
    i: 5,
    j: 5,
    visible: true,
  }
  context.map.grid[5][5].has = fireCamp
  context.map.grid[5][5].solid = true
  owner.buildings.push(fireCamp)
  soldier.context = context
  const UnitRestSystem = loadUnitRestSystem(calls)
  const system = new UnitRestSystem(context)

  context.dayNight.state.hour = 23
  system.synchronizeAfterTimeJump()

  assert.equal(soldier.shelterState.status, 'outside')
  assert.equal(soldier.currentSheet, constants.SHEET_TYPES.dying)
  assert.ok(Math.abs(soldier.i - fireCamp.i) + Math.abs(soldier.j - fireCamp.j) <= 1)
  // The instant "settle" path freezes the sprite without ever animating it, so `loop` (left
  // `true` from the unit's last walk) must be explicitly cleared — otherwise a later pause/resume
  // cycle that calls sprite.play() would have PIXI cycle the hurt sheet forever.
  assert.equal(soldier.sprite.loop, false)
})

test('time jump to night keeps expedition bandits awake away from their camp', () => {
  const calls = []
  const owner = { units: [], buildings: [], name: 'Bandits', type: constants.PLAYER_TYPES.bandits }
  const bandit = createUnit(owner, {
    dest: { i: 2, j: 2, label: 'hero-camp' },
    label: 'bandit-raider',
    path: [{ i: 1, j: 0 }],
    type: constants.UNIT_TYPES.banditSword,
    work: constants.WORK_TYPES.attacker,
  })
  const context = createContext(12, [owner], calls)
  bandit.context = context
  const UnitRestSystem = loadUnitRestSystem(calls)
  const system = new UnitRestSystem(context)

  context.dayNight.state.hour = 23
  system.synchronizeAfterTimeJump()

  assert.equal(bandit.shelterState, undefined)
  assert.equal(bandit.dest.label, 'hero-camp')
  assert.equal(bandit.work, constants.WORK_TYPES.attacker)
})

test('time jump to night keeps hostile military attackers awake during an external attack', () => {
  const calls = []
  const heroOwner = { label: 'player' }
  const attackerOwner = {
    units: [],
    buildings: [],
    isEnemy(other) {
      return other === heroOwner
    },
  }
  const target = { i: 2, j: 2, label: 'hero-camp', owner: heroOwner }
  const soldier = createUnit(attackerOwner, {
    action: constants.ACTION_TYPES.attack,
    dest: target,
    label: 'hostile-soldier',
    path: [{ i: 1, j: 0 }],
    type: constants.UNIT_TYPES.infantry,
    work: constants.WORK_TYPES.attacker,
  })
  const context = createContext(12, [attackerOwner], calls)
  soldier.context = context
  const UnitRestSystem = loadUnitRestSystem(calls)
  const system = new UnitRestSystem(context)

  context.dayNight.state.hour = 23
  system.synchronizeAfterTimeJump()
  system.sendUnitToSleep(soldier)

  assert.equal(soldier.shelterState, undefined)
  assert.equal(soldier.dest, target)
  assert.equal(soldier.action, constants.ACTION_TYPES.attack)
})

test('time jump to night lets camp bandits sleep near their camp anchor', () => {
  const calls = []
  const owner = { units: [], buildings: [], name: 'Bandits', type: constants.PLAYER_TYPES.bandits }
  const anchor = { i: 5, j: 5 }
  const bandit = createUnit(owner, {
    banditCampAnchor: anchor,
    campPatrolAnchor: anchor,
    i: 6,
    j: 5,
    label: 'bandit-guard',
    path: [{ i: 5, j: 5 }],
    type: constants.UNIT_TYPES.banditSword,
    work: constants.WORK_TYPES.attacker,
  })
  const context = createContext(12, [owner], calls)
  bandit.context = context
  const UnitRestSystem = loadUnitRestSystem(calls)
  const system = new UnitRestSystem(context)

  context.dayNight.state.hour = 23
  system.synchronizeAfterTimeJump()

  assert.equal(bandit.shelterState.reason, 'sleep')
  assert.equal(bandit.shelterState.status, 'outside')
  assert.ok(Math.abs(bandit.i - anchor.i) + Math.abs(bandit.j - anchor.j) <= 4)
})

test('sleeping military wake on hero insight and do not immediately sleep again', () => {
  const calls = []
  const heroOwner = { label: 'player' }
  const owner = {
    units: [],
    buildings: [],
    isEnemy(other) {
      return other === heroOwner
    },
  }
  const soldier = createUnit(owner, {
    detect: target => calls.push(['detect', target.label]),
    family: 'unit',
    label: 'guard',
    sight: 8,
    type: constants.UNIT_TYPES.infantry,
  })
  const context = createContext(23, [owner], calls)
  soldier.context = context
  const hero = {
    label: 'hero',
    family: 'unit',
    owner: heroOwner,
    type: constants.UNIT_TYPES.hero,
    controlMode: 'hero',
    i: 18,
    j: 18,
    isDead: false,
    isDestroyed: false,
  }
  context.controls.heroUnit = hero
  const UnitRestSystem = loadUnitRestSystem(calls)
  const system = new UnitRestSystem(context)

  assert.equal(soldier.shelterState.reason, 'sleep')

  hero.i = 1
  hero.j = 0
  system.updateRestAlerts([soldier])

  assert.equal(soldier.shelterState, null)
  assert.ok(soldier.restWakeLockUntilMs > context.scheduler.elapsedMs)

  system.sendUnitsToSleep([soldier])
  assert.equal(soldier.shelterState, null)

  context.scheduler.elapsedMs = soldier.restWakeLockUntilMs + 1
  hero.i = 18
  hero.j = 18
  system.sendUnitsToSleep([soldier])
  assert.equal(soldier.shelterState.reason, 'sleep')
})

test('player military near the hero still go to sleep at night', () => {
  const calls = []
  const owner = { units: [], buildings: [] }
  const soldier = createUnit(owner, {
    detect: target => calls.push(['detect', target.label]),
    family: 'unit',
    i: 1,
    j: 0,
    label: 'guard',
    sight: 8,
    type: constants.UNIT_TYPES.infantry,
  })
  const context = createContext(23, [owner], calls)
  const hero = {
    label: 'hero',
    family: 'unit',
    owner,
    type: constants.UNIT_TYPES.hero,
    controlMode: 'hero',
    i: 0,
    j: 0,
    isDead: false,
    isDestroyed: false,
  }
  context.controls.heroUnit = hero
  soldier.context = context
  const UnitRestSystem = loadUnitRestSystem(calls)

  new UnitRestSystem(context)

  assert.equal(soldier.shelterState.reason, 'sleep')
  assert.equal(soldier.restWakeLockUntilMs, undefined)
  assert.equal(
    calls.some(call => call[0] === 'detect'),
    false
  )
})

test('neutral military near the hero still go to sleep at night', () => {
  const calls = []
  const heroOwner = { label: 'player' }
  const neutralOwner = {
    units: [],
    buildings: [],
    isEnemy() {
      return false
    },
  }
  const soldier = createUnit(neutralOwner, {
    detect: target => calls.push(['detect', target.label]),
    family: 'unit',
    i: 1,
    j: 0,
    label: 'neutral-guard',
    sight: 8,
    type: constants.UNIT_TYPES.infantry,
  })
  const context = createContext(23, [neutralOwner], calls)
  const hero = {
    label: 'hero',
    family: 'unit',
    owner: heroOwner,
    type: constants.UNIT_TYPES.hero,
    controlMode: 'hero',
    i: 0,
    j: 0,
    isDead: false,
    isDestroyed: false,
  }
  context.controls.heroUnit = hero
  soldier.context = context
  const UnitRestSystem = loadUnitRestSystem(calls)

  new UnitRestSystem(context)

  assert.equal(soldier.shelterState.reason, 'sleep')
  assert.equal(soldier.restWakeLockUntilMs, undefined)
  assert.equal(
    calls.some(call => call[0] === 'detect'),
    false
  )
})

test('rest alert wakes nearby sleeping military from the same group', () => {
  const calls = []
  const visibleTargetsBySource = new Map()
  const heroOwner = { label: 'player' }
  const owner = {
    units: [],
    buildings: [],
    isEnemy(other) {
      return other === heroOwner
    },
  }
  const leader = createUnit(owner, {
    family: 'unit',
    label: 'leader',
    sight: 8,
    type: constants.UNIT_TYPES.infantry,
  })
  const ally = createUnit(owner, {
    family: 'unit',
    label: 'ally',
    sight: 8,
    type: constants.UNIT_TYPES.infantry,
  })
  const context = createContext(23, [owner], calls)
  leader.context = context
  ally.context = context
  const hero = {
    label: 'hero',
    family: 'unit',
    owner: heroOwner,
    type: constants.UNIT_TYPES.hero,
    controlMode: 'hero',
    i: 18,
    j: 18,
    isDead: false,
    isDestroyed: false,
  }
  context.controls.heroUnit = hero
  const UnitRestSystem = loadUnitRestSystem(
    calls,
    {},
    {
      '../lib/grid/visibility': {
        findInstancesInSight: (source, condition) =>
          (visibleTargetsBySource.get(source.label) ?? []).filter(target => condition(target)),
      },
    }
  )
  const system = new UnitRestSystem(context)

  hero.i = 1
  hero.j = 0
  visibleTargetsBySource.set('leader', [hero, ally])
  system.updateRestAlerts([leader, ally])

  assert.equal(leader.shelterState, null)
  assert.equal(ally.shelterState, null)
  assert.ok(leader.restWakeLockUntilMs > context.scheduler.elapsedMs)
  assert.ok(ally.restWakeLockUntilMs > context.scheduler.elapsedMs)
})

test('rest tick returns early during quiet daytime', () => {
  const calls = []
  const owner = { units: [], buildings: [] }
  const villager = createUnit(owner)
  const context = createContext(12, [owner], calls)
  villager.context = context
  const UnitRestSystem = loadUnitRestSystem(calls)
  const system = new UnitRestSystem(context)

  system.update()

  assert.equal(villager.shelterState, undefined)
  assert.equal(villager.tired, undefined)
  assert.deepEqual(calls, [])
})

test('villagers move to nearest house entry and disappear inside on arrival', () => {
  const calls = []
  const owner = { units: [], buildings: [] }
  const house = { label: 'house', type: constants.BUILDING_TYPES.house, owner, isBuilt: true, i: 5, j: 5 }
  owner.buildings.push(house)
  const villager = createUnit(owner, { i: 0, j: 0 })
  const context = createContext(23, [owner], calls)
  villager.context = context
  const entry = context.map.grid[6][7]
  const UnitRestSystem = loadUnitRestSystem(calls)
  const system = new UnitRestSystem(context)

  assert.equal(villager.shelterState.status, 'movingToRest')
  assert.equal(villager.dest, entry)

  villager.i = entry.i
  villager.j = entry.j
  villager.currentCell = entry
  system.updateRestingUnit(villager)

  assert.equal(villager.shelterState.status, 'inside')
  assert.equal(villager.alpha, 0)
  assert.equal(villager.visible, false)
  assert.equal(villager.shadow.visible, false)
  assert.deepEqual(
    calls.find(call => call[0] === 'removeBucket'),
    ['removeBucket', 'villager-1']
  )
})

test('active runtime interiors route shelter entry through the space portal', () => {
  const calls = []
  const portalEntries = []
  const owner = { units: [], buildings: [] }
  const house = { label: 'house', type: constants.BUILDING_TYPES.house, owner, isBuilt: true, i: 5, j: 5 }
  owner.buildings.push(house)
  const villager = createUnit(owner, { i: 6, j: 7 })
  const context = createContext(23, [owner], calls)
  const entry = context.map.grid[6][7]
  entry.place(villager)
  villager.context = context
  villager.currentCell = entry
  villager.shelterState = {
    status: 'movingToRest',
    reason: 'sleep',
    location: 'shelter',
    shelter: house,
    targetCell: entry,
    startedAtMs: context.scheduler.elapsedMs,
    retryCount: 0,
  }
  const UnitRestSystem = loadUnitRestSystem(
    calls,
    {},
    {
      '../BuildingInteriorSpaceSystem': {
        getBuildingInteriorSpaceForBuilding: (_ctx, building) => (building === house ? { id: 'space-house' } : null),
        getBuildingInteriorSpaceForUnit: () => null,
        moveUnitToBuildingInteriorSleep: (_ctx, unit, space, options) => {
          portalEntries.push([unit.label, space.id, options])
          return true
        },
        settleUnitAtBuildingInteriorSleepCell: () => {},
      },
    }
  )

  new UnitRestSystem(context)

  assert.deepEqual(portalEntries, [['villager-1', 'space-house', { mode: 'route' }]])
})

test('villagers skip full shelters when going to sleep', () => {
  const calls = []
  const owner = { units: [], buildings: [] }
  const house = { label: 'house', type: constants.BUILDING_TYPES.house, owner, isBuilt: true, i: 5, j: 5 }
  owner.buildings.push(house)
  for (let index = 0; index < 5; index += 1) {
    createUnit(owner, {
      label: `inside-${index}`,
      shelterState: { status: 'inside', reason: 'sleep', location: 'shelter', shelter: house },
    })
  }
  const villager = createUnit(owner, { label: 'extra-villager', i: 0, j: 0 })
  const context = createContext(23, [owner], calls)
  for (const unit of owner.units) unit.context = context
  const entry = context.map.grid[6][7]
  const UnitRestSystem = loadUnitRestSystem(calls)

  new UnitRestSystem(context)

  assert.equal(villager.shelterState.status, 'outside')
  assert.equal(villager.shelterState.location, 'outside')
  assert.notEqual(villager.dest, entry)
})

test('villagers keep shelter order while movement command is still pending', () => {
  const calls = []
  const owner = { units: [], buildings: [] }
  const house = { label: 'house', type: constants.BUILDING_TYPES.house, owner, isBuilt: true, i: 5, j: 5 }
  owner.buildings.push(house)
  const villager = createUnit(owner, {
    sendToEvt(dest, action) {
      this.pendingOrder = { dest, action }
      this.dest = null
      this.path = []
    },
  })
  const context = createContext(23, [owner], calls)
  context.scheduler.elapsedMs = 5000
  villager.context = context
  const entry = context.map.grid[6][7]
  const UnitRestSystem = loadUnitRestSystem(calls)
  const system = new UnitRestSystem(context)

  assert.equal(villager.shelterState.status, 'movingToRest')

  context.scheduler.elapsedMs += 5000
  system.updateRestingUnit(villager)

  assert.equal(villager.shelterState.status, 'movingToRest')
  assert.equal(villager.shelterState.targetCell, entry)
  assert.equal(villager.currentSheet, undefined)
})

test('villagers retry a fresh shelter entry before sleeping outside', () => {
  const calls = []
  const owner = { units: [], buildings: [] }
  const house = {
    label: 'house',
    type: constants.BUILDING_TYPES.house,
    owner,
    isBuilt: true,
    i: 5,
    j: 5,
  }
  owner.buildings.push(house)
  const villager = createUnit(owner, {
    i: 0,
    j: 0,
    sendToEvt(dest, action) {
      this.dest = dest
      this.action = action
      this.path = []
    },
  })
  const context = createContext(23, [owner], calls)
  villager.context = context
  const entry = context.map.grid[6][7]
  const UnitRestSystem = loadUnitRestSystem(calls)
  const system = new UnitRestSystem(context)
  villager.dest = null
  villager.path = []
  context.scheduler.elapsedMs += 3000

  system.updateRestingUnit(villager)

  assert.equal(villager.shelterState.status, 'movingToRest')
  assert.equal(villager.shelterState.retryCount, 1)
  assert.equal(villager.dest, entry)
  assert.notEqual(villager.currentSheet, constants.SHEET_TYPES.dying)
})

test('interior sleepers lie down only after reaching their sleep spot', () => {
  const calls = []
  const owner = { units: [], buildings: [] }
  const villager = createUnit(owner, {
    i: 1,
    j: 1,
    sendToEvt(dest, action) {
      this.dest = dest
      this.action = action
      this.path = dest ? [{ i: dest.i, j: dest.j }] : []
    },
  })
  const context = createContext(23, [owner], calls)
  villager.context = context
  const sleepCell = context.map.grid[4][4]
  villager.shelterState = {
    status: 'movingToRest',
    reason: 'sleep',
    location: 'outside',
    shelter: null,
    targetCell: sleepCell,
    startedAtMs: context.scheduler.elapsedMs,
    retryCount: 0,
  }
  const UnitRestSystem = loadUnitRestSystem(calls)
  const system = new UnitRestSystem(context)

  assert.equal(villager.shelterState.status, 'movingToRest')
  assert.notEqual(villager.currentSheet, constants.SHEET_TYPES.dying)

  villager.i = sleepCell.i
  villager.j = sleepCell.j
  villager.currentCell = sleepCell
  system.updateRestingUnit(villager)

  assert.equal(villager.shelterState.status, 'outside')
  assert.equal(villager.currentSheet, constants.SHEET_TYPES.dying)
  assert.deepEqual(
    calls.find(call => call[0] === 'indicator'),
    ['indicator', 'villager-1', 'sleep']
  )
})

test('runtime interior sleepers settle at their sleep spot without re-entering shelter', () => {
  const calls = []
  const settled = []
  const owner = { units: [], buildings: [] }
  const house = { label: 'house', type: constants.BUILDING_TYPES.house, owner, isBuilt: true, i: 5, j: 5 }
  owner.buildings.push(house)
  const villager = createUnit(owner, { i: 4, j: 4 })
  const context = createContext(23, [owner], calls)
  const sleepCell = context.map.grid[4][4]
  villager.context = context
  villager.currentCell = sleepCell
  villager.spaceId = 'space-house'
  villager.shelterState = {
    status: 'movingToRest',
    reason: 'sleep',
    location: 'shelter',
    shelter: house,
    targetCell: sleepCell,
    startedAtMs: context.scheduler.elapsedMs,
    retryCount: 0,
  }
  const UnitRestSystem = loadUnitRestSystem(
    calls,
    {},
    {
      '../BuildingInteriorSpaceSystem': {
        getBuildingInteriorSpaceForBuilding: () => null,
        getBuildingInteriorSpaceForUnit: unit => (unit === villager ? { building: house, id: 'space-house' } : null),
        moveUnitToBuildingInteriorSleep: () => false,
        settleUnitAtBuildingInteriorSleepCell: (unit, space, cell) => {
          settled.push([unit.label, space.id, cell.i, cell.j])
          unit.shelterState = { status: 'outside', reason: 'sleep', location: 'shelter', shelter: space.building }
        },
      },
    }
  )

  new UnitRestSystem(context)

  assert.deepEqual(settled, [['villager-1', 'space-house', 4, 4]])
  assert.equal(villager.shelterState.status, 'outside')
  assert.deepEqual(
    calls.filter(call => call[0] === 'removeBucket' || call[0] === 'addChild'),
    []
  )
})

test('villagers wake at 8h and resume their previous autonomous job', () => {
  const calls = []
  const owner = { units: [], buildings: [] }
  const house = { label: 'house', type: constants.BUILDING_TYPES.house, owner, isBuilt: true, i: 5, j: 5 }
  owner.buildings.push(house)
  const villager = createUnit(owner, { autonomousJob: 'wood' })
  villager.shelterState = {
    status: 'inside',
    location: 'shelter',
    shelter: house,
    previousAutonomousJob: 'wood',
    previousWork: 'woodcutter',
    previousAction: 'chopwood',
    previousDest: null,
  }
  const context = createContext(8, [owner], calls)
  villager.context = context
  const entry = context.map.grid[6][7]
  const UnitRestSystem = loadUnitRestSystem(calls)

  new UnitRestSystem(context)

  assert.equal(villager.shelterState, null)
  assert.equal(villager.alpha, 1)
  assert.equal(villager.shadow.visible, false)
  assert.equal(villager.currentSheet, constants.SHEET_TYPES.dying)
  assert.equal(villager.sprite.frame, 2)
  assert.equal(villager.i, entry.i)
  assert.equal(villager.j, entry.j)
  assert.equal(
    calls.some(call => call[0] === 'resumeAutonomy'),
    false
  )
  runSchedulerTaskByName(context.scheduler, 'unit.sleepWake')
  assert.equal(villager.shadow.visible, true)
  runSchedulerTaskByName(context.scheduler, 'unit.sleepWake')
  assert.equal(villager.currentSheet, constants.SHEET_TYPES.standing)
  assert.deepEqual(
    calls.find(call => call[0] === 'resumeAutonomy'),
    ['resumeAutonomy', 'villager-1']
  )
})

test('villagers wake at 8h and resume their stored gathering target before generic autonomy', () => {
  const calls = []
  const owner = { units: [], buildings: [] }
  const house = { label: 'house', type: constants.BUILDING_TYPES.house, owner, isBuilt: true, i: 5, j: 5 }
  owner.buildings.push(house)
  const stone = { label: 'stone-pile', i: 9, j: 9, isDestroyed: false }
  const villager = createUnit(owner, {
    autonomousJob: 'stone',
    shelterState: {
      status: 'inside',
      location: 'shelter',
      shelter: house,
      previousAutonomousJob: 'stone',
      previousWork: 'stonecutter',
      previousAction: 'minestone',
      previousDest: stone,
    },
    getActionCondition(target, action) {
      return target === stone && action === 'minestone'
    },
    sendToEvt(dest, action, options) {
      calls.push(['sendToEvt', dest.label, action, options])
      this.dest = dest
      this.action = action
      this.path = dest ? [{ i: dest.i, j: dest.j }] : []
    },
  })
  const context = createContext(8, [owner], calls)
  villager.context = context
  const UnitRestSystem = loadUnitRestSystem(calls)

  new UnitRestSystem(context)
  runSchedulerTaskByName(context.scheduler, 'unit.sleepWake', 2)

  assert.deepEqual(
    calls.find(call => call[0] === 'sendToEvt'),
    ['sendToEvt', 'stone-pile', 'minestone', { forceRepath: true, preserveAutonomy: true }]
  )
  assert.equal(
    calls.some(call => call[0] === 'resumeAutonomy'),
    false
  )
  assert.equal(villager.dest, stone)
  assert.equal(villager.action, 'minestone')
  assert.equal(villager.work, 'stonecutter')
  assert.equal(villager.autonomousJob, 'stone')
})

test('rest wake transitions delay stored work until the morning linger finishes', () => {
  const calls = []
  const owner = { units: [], buildings: [] }
  const house = { label: 'house', type: constants.BUILDING_TYPES.house, owner, isBuilt: true, i: 5, j: 5 }
  owner.buildings.push(house)
  const stone = { label: 'stone-pile', i: 9, j: 9, isDestroyed: false }
  const villager = createUnit(owner, {
    autonomousJob: 'stone',
    shelterState: {
      status: 'inside',
      location: 'shelter',
      shelter: house,
      previousAutonomousJob: 'stone',
      previousWork: 'stonecutter',
      previousAction: 'minestone',
      previousDest: stone,
    },
    getActionCondition(target, action) {
      return target === stone && action === 'minestone'
    },
    sendToEvt(dest, action, options) {
      calls.push(['sendToEvt', dest?.label ?? `${dest.i}:${dest.j}`, action, options])
      this.dest = dest
      this.action = action
      this.path = dest ? [{ i: dest.i, j: dest.j }] : []
    },
  })
  const context = createContext(8, [owner], calls)
  context.restTransitionsEnabled = true
  villager.context = context
  const UnitRestSystem = loadUnitRestSystem(calls)
  const system = new UnitRestSystem(context)

  runSchedulerTaskByName(context.scheduler, 'unit.sleepWake', 2)

  assert.equal(villager.shelterState.status, 'wakingUp')
  assert.notEqual(villager.dest, stone)
  assert.equal(
    calls.some(call => call[0] === 'sendToEvt' && call[1] === 'stone-pile'),
    false
  )

  const transitionCell = villager.shelterState.transitionTargetCell
  villager.i = transitionCell.i
  villager.j = transitionCell.j
  villager.currentCell = transitionCell
  context.scheduler.elapsedMs = villager.shelterState.transitionUntilMs + 1
  system.updateRestingUnit(villager)

  assert.equal(villager.shelterState, null)
  assert.equal(villager.dest, stone)
  assert.equal(villager.action, 'minestone')
  assert.equal(villager.work, 'stonecutter')
  assert.equal(villager.autonomousJob, 'stone')
})

test('villagers waking from delivery resume the delivery return task', () => {
  const calls = []
  const owner = { units: [], buildings: [] }
  const house = { label: 'house', type: constants.BUILDING_TYPES.house, owner, isBuilt: true, i: 5, j: 5 }
  owner.buildings.push(house)
  const chest = { label: 'storage-chest', i: 6, j: 6, isDestroyed: false }
  const stone = { label: 'stone-pile', i: 9, j: 9, isDestroyed: false }
  const villager = createUnit(owner, {
    autonomousJob: 'stone',
    resourceDeliveryState: {
      target: house,
      returnTask: {
        autonomousJob: 'stone',
        dest: stone,
        action: 'minestone',
        work: 'stonecutter',
      },
    },
    shelterState: {
      status: 'inside',
      location: 'shelter',
      shelter: house,
      previousAutonomousJob: 'stone',
      previousWork: null,
      previousAction: 'delivery',
      previousDest: chest,
    },
    getActionCondition(target, action) {
      return target === stone && action === 'minestone'
    },
    sendToEvt(dest, action, options) {
      calls.push(['sendToEvt', dest.label, action, options])
      this.dest = dest
      this.action = action
      this.path = dest ? [{ i: dest.i, j: dest.j }] : []
    },
  })
  const context = createContext(8, [owner], calls)
  villager.context = context
  const UnitRestSystem = loadUnitRestSystem(calls)

  new UnitRestSystem(context)
  runSchedulerTaskByName(context.scheduler, 'unit.sleepWake', 2)

  assert.deepEqual(
    calls.find(call => call[0] === 'sendToEvt'),
    ['sendToEvt', 'stone-pile', 'minestone', { forceRepath: true, preserveAutonomy: true }]
  )
  assert.equal(villager.dest, stone)
  assert.notEqual(villager.dest, chest)
  assert.equal(villager.action, 'minestone')
  assert.equal(villager.work, 'stonecutter')
})

test('interior sleepers route to the exit after waking instead of resuming old work', () => {
  const calls = []
  const routed = []
  const owner = { units: [], buildings: [] }
  const previousDest = { i: 9, j: 9, isDestroyed: false }
  const house = { label: 'house', type: constants.BUILDING_TYPES.house, owner, isBuilt: true, i: 5, j: 5 }
  owner.buildings.push(house)
  const villager = createUnit(owner, {
    autonomousJob: 'wood',
    shelterState: {
      status: 'inside',
      reason: 'sleep',
      location: 'shelter',
      shelter: house,
      previousAutonomousJob: 'wood',
      previousWork: 'woodcutter',
      previousAction: 'chopwood',
      previousDest,
    },
  })
  const context = createContext(8, [owner], calls)
  context.map.mapType = 'interior'
  context.routeInteriorUnitToExit = (unit, returnTask) => routed.push([unit.label, returnTask])
  villager.context = context
  const UnitRestSystem = loadUnitRestSystem(calls)

  new UnitRestSystem(context)

  assert.equal(villager.shelterState, null)
  assert.deepEqual(routed, [])
  assert.equal(
    calls.some(call => call[0] === 'resumeAutonomy'),
    false
  )

  runSchedulerTaskByName(context.scheduler, 'unit.sleepWake', 2)

  assert.deepEqual(routed, [
    [
      'villager-1',
      {
        autonomousJob: 'wood',
        dest: previousDest,
        action: 'chopwood',
        work: 'woodcutter',
      },
    ],
  ])
  assert.equal(
    calls.some(call => call[0] === 'resumeAutonomy'),
    false
  )
  assert.notEqual(villager.dest, previousDest)
})

test('runtime interior sleepers wake in place before routing through the space exit', () => {
  const calls = []
  const routed = []
  const owner = { units: [], buildings: [] }
  const house = { label: 'house', type: constants.BUILDING_TYPES.house, owner, isBuilt: true, i: 5, j: 5 }
  owner.buildings.push(house)
  const villager = createUnit(owner, {
    shelterState: {
      status: 'inside',
      reason: 'sleep',
      location: 'shelter',
      shelter: house,
    },
  })
  const interiorCell = createCell(3, 4)
  villager.currentCell = interiorCell
  villager.i = interiorCell.i
  villager.j = interiorCell.j
  villager.spaceId = 'space-house'
  const context = createContext(8, [owner], calls)
  context.map.mapType = 'continent'
  context.routeInteriorUnitToExit = (unit, returnTask) => routed.push([unit.label, returnTask])
  villager.context = context
  const UnitRestSystem = loadUnitRestSystem(
    calls,
    {},
    {
      '../BuildingInteriorSpaceSystem': {
        getBuildingInteriorSpaceForBuilding: () => null,
        getBuildingInteriorSpaceForUnit: unit => (unit === villager ? { id: 'space-house' } : null),
        moveUnitToBuildingInteriorSleep: () => false,
      },
    }
  )

  new UnitRestSystem(context)

  assert.equal(villager.currentCell, interiorCell)
  assert.equal(villager.i, 3)
  assert.equal(villager.j, 4)
  assert.equal(villager.shelterState, null)
  assert.deepEqual(routed, [])

  runSchedulerTaskByName(context.scheduler, 'unit.sleepWake', 2)

  assert.deepEqual(routed, [['villager-1', null]])
})

test('time jump to daytime wakes sleeping villagers immediately', () => {
  const calls = []
  const owner = { units: [], buildings: [] }
  const house = { label: 'house', type: constants.BUILDING_TYPES.house, owner, isBuilt: true, i: 5, j: 5 }
  owner.buildings.push(house)
  const villager = createUnit(owner, {
    shelterState: {
      status: 'inside',
      reason: 'sleep',
      location: 'shelter',
      shelter: house,
    },
  })
  const context = createContext(23, [owner], calls)
  villager.context = context
  const entry = context.map.grid[6][7]
  const UnitRestSystem = loadUnitRestSystem(calls)
  const system = new UnitRestSystem(context)

  context.dayNight.state.hour = 9
  system.synchronizeAfterTimeJump()

  assert.equal(villager.shelterState, null)
  assert.equal(villager.i, entry.i)
  assert.equal(villager.j, entry.j)
})

test('time jump to daytime bypasses wake fade-in', () => {
  const calls = []
  const owner = { units: [], buildings: [] }
  const house = { label: 'house', type: constants.BUILDING_TYPES.house, owner, isBuilt: true, i: 5, j: 5 }
  owner.buildings.push(house)
  const villager = createUnit(owner, {
    alpha: 0,
    visible: false,
    shelterState: {
      status: 'inside',
      reason: 'sleep',
      location: 'shelter',
      shelter: house,
    },
  })
  const context = createContext(23, [owner], calls)
  villager.context = context
  const UnitRestSystem = loadUnitRestSystem(calls, {
    fadeIn: entity => {
      calls.push(['fadeIn', entity.label])
      entity.alpha = 0
    },
  })
  const system = new UnitRestSystem(context)

  context.dayNight.state.hour = 9
  system.synchronizeAfterTimeJump()

  assert.equal(villager.shelterState, null)
  assert.equal(villager.visible, true)
  assert.equal(villager.alpha, 1)
  assert.equal(
    calls.some(call => call[0] === 'fadeIn'),
    false
  )
})

test('time jump to daytime restores outside sleepers to standing immediately', () => {
  const calls = []
  const owner = { units: [], buildings: [] }
  const villager = createUnit(owner, {
    currentSheet: constants.SHEET_TYPES.dying,
    shelterState: {
      status: 'outside',
      reason: 'sleep',
      location: 'outside',
      shelter: null,
    },
  })
  const context = createContext(23, [owner], calls)
  villager.context = context
  villager.visible = true
  villager.alpha = 1
  const UnitRestSystem = loadUnitRestSystem(calls, {
    fadeIn: entity => {
      calls.push(['fadeIn', entity.label])
      entity.alpha = 0
    },
  })
  const system = new UnitRestSystem(context)

  context.dayNight.state.hour = 10
  system.synchronizeAfterTimeJump()

  assert.equal(villager.shelterState, null)
  assert.equal(villager.visible, true)
  assert.equal(villager.alpha, 1)
  assert.equal(villager.currentSheet, constants.SHEET_TYPES.standing)
  assert.equal(villager.shadow.visible, true)
  assert.equal(villager.sprite.stopped, true)
  assert.equal(
    calls.some(call => call[0] === 'fadeIn'),
    false
  )
})

test('time jump to night settles awake villagers into shelters immediately', () => {
  const calls = []
  const owner = { units: [], buildings: [] }
  const context = createContext(23, [owner], calls)
  const entry = context.map.grid[6][7]
  const house = {
    label: 'house',
    type: constants.BUILDING_TYPES.house,
    owner,
    isBuilt: true,
    i: 5,
    j: 5,
    entryCells: [entry],
  }
  owner.buildings.push(house)
  const villager = createUnit(owner, { i: 0, j: 0 })
  villager.context = context
  const UnitRestSystem = loadUnitRestSystem(calls)
  const system = new UnitRestSystem(context)

  system.synchronizeAfterTimeJump()

  assert.equal(villager.shelterState.status, 'inside')
  assert.equal(villager.shelterState.shelter, house)
  assert.equal(villager.visible, false)
  assert.equal(villager.alpha, 0)
})

test('time jump to night bypasses shelter fade-out', () => {
  const calls = []
  const owner = { units: [], buildings: [] }
  const context = createContext(23, [owner], calls)
  const entry = context.map.grid[6][7]
  const house = {
    label: 'house',
    type: constants.BUILDING_TYPES.house,
    owner,
    isBuilt: true,
    i: 5,
    j: 5,
    entryCells: [entry],
  }
  owner.buildings.push(house)
  const villager = createUnit(owner, { i: 0, j: 0 })
  villager.context = context
  const UnitRestSystem = loadUnitRestSystem(calls, {
    fadeOut: entity => {
      calls.push(['fadeOut', entity.label])
      entity.alpha = 0.5
    },
  })
  const system = new UnitRestSystem(context)

  system.synchronizeAfterTimeJump()

  assert.equal(villager.shelterState.status, 'inside')
  assert.equal(villager.visible, false)
  assert.equal(villager.alpha, 0)
  assert.equal(
    calls.some(call => call[0] === 'fadeOut'),
    false
  )
})

test('sleeping villagers play reversed hurt as a dialogue preview and lie back down on close', () => {
  const calls = []
  const owner = { units: [], buildings: [] }
  const villager = createUnit(owner)
  const context = createContext(23, [owner], calls)
  villager.context = context
  const UnitRestSystem = loadUnitRestSystem(calls)
  const system = new UnitRestSystem(context)
  villager.sprite.onComplete()
  villager.lookingAtHero = true

  system.previewSleepingUnitWake(villager)

  assert.equal(villager.shelterState.reason, 'sleep')
  assert.equal(villager.currentSheet, constants.SHEET_TYPES.dying)
  assert.equal(villager.sprite.frame, 2)
  assert.equal(villager.shadow.visible, false)
  system.updateSleepingOutsideVisuals()
  assert.ok([...context.scheduler.tasks.values()].some(task => task.name === 'unit.sleepWake'))
  runSchedulerTaskByName(context.scheduler, 'unit.sleepWake')
  assert.equal(villager.sprite.frame, 1)
  assert.equal(villager.shadow.visible, true)
  runSchedulerTaskByName(context.scheduler, 'unit.sleepWake')
  assert.equal(villager.currentSheet, constants.SHEET_TYPES.standing)
  assert.equal(villager.shelterState.reason, 'sleep')

  system.restoreSleepingUnitVisual(villager)

  assert.equal(villager.currentSheet, constants.SHEET_TYPES.dying)
  assert.equal(villager.sprite.playedFrom, 0)
  assert.equal(villager.sprite.playing, true)
  assert.equal(villager.shadow.visible, true)
  villager.sprite.onComplete()
  assert.equal(villager.sprite.frame, 2)
  assert.equal(villager.shadow.visible, false)
})

test('follow orders wake sleeping villagers with reversed hurt without resuming old work', () => {
  const calls = []
  const owner = { units: [], buildings: [] }
  const previousDest = { i: 9, j: 9, isDestroyed: false }
  const villager = createUnit(owner, {
    autonomousJob: 'wood',
    shelterState: {
      status: 'outside',
      reason: 'sleep',
      location: 'outside',
      previousAutonomousJob: 'wood',
      previousAction: 'chopwood',
      previousDest,
      previousWork: 'woodcutter',
    },
  })
  const context = createContext(23, [owner], calls)
  villager.context = context
  const UnitRestSystem = loadUnitRestSystem(calls)
  const system = new UnitRestSystem(context)
  let following = false

  const waking = system.wakeSleepingUnitForOrder(villager, () => {
    following = true
  })

  assert.equal(waking, true)
  assert.equal(following, false)
  assert.equal(villager.shelterState, null)
  assert.equal(villager.currentSheet, constants.SHEET_TYPES.dying)
  assert.equal(villager.sprite.frame, 2)
  runSchedulerTaskByName(context.scheduler, 'unit.sleepWake', 2)
  assert.equal(following, true)
  assert.equal(villager.currentSheet, constants.SHEET_TYPES.standing)
  assert.equal(
    calls.some(call => call[0] === 'resumeAutonomy'),
    false
  )
  assert.notEqual(villager.dest, previousDest)
})

test('night rest no longer applies a tired state to villagers', () => {
  const calls = []
  const owner = { units: [], buildings: [] }
  const villager = createUnit(owner)
  const context = createContext(22, [owner], calls)
  villager.context = context
  const UnitRestSystem = loadUnitRestSystem(calls)
  new UnitRestSystem(context)

  assert.equal(villager.tired, undefined)
})

test('followers stay with the hero at night instead of going to sleep', () => {
  const calls = []
  const owner = { units: [], buildings: [] }
  const villager = createUnit(owner, { label: 'villager', followingHero: true })
  const chief = createUnit(owner, { label: 'chief', type: constants.UNIT_TYPES.chief, followingHero: true })
  const soldier = createUnit(owner, { label: 'soldier', type: constants.UNIT_TYPES.infantry, followingHero: true })
  const context = createContext(23, [owner], calls)
  context.restTransitionsEnabled = true
  for (const unit of [villager, chief, soldier]) unit.context = context
  const UnitRestSystem = loadUnitRestSystem(calls)

  new UnitRestSystem(context)

  for (const unit of [villager, chief, soldier]) {
    assert.equal(unit.shelterState, undefined)
    assert.equal(unit.followingHero, true)
    assert.equal(unit.tired, undefined)
  }
})

test('sleeping villagers wake when attacked and can fight without a tired penalty', () => {
  const calls = []
  const owner = {
    units: [],
    buildings: [],
    isEnemy(other) {
      return other?.label === 'enemy'
    },
  }
  const villager = createUnit(owner)
  const context = createContext(23, [owner], calls)
  villager.context = context
  const UnitRestSystem = loadUnitRestSystem(calls)
  const system = new UnitRestSystem(context)

  assert.equal(villager.shelterState.status, 'outside')
  const handled = system.handleUnitDanger(villager, {
    label: 'enemy',
    family: 'unit',
    owner: { label: 'enemy' },
    isDead: false,
    isDestroyed: false,
  })

  assert.equal(handled, true)
  assert.equal(villager.shelterState, null)
  assert.equal(villager.actionLocked, false)
  assert.equal(villager.tired, undefined)
})

test('awake villagers attack danger instead of entering shelter when morale holds', () => {
  const calls = []
  const owner = {
    units: [],
    buildings: [],
    isEnemy(other) {
      return other?.label === 'enemy'
    },
  }
  owner.buildings.push({ label: 'tc', type: constants.BUILDING_TYPES.townCenter, owner, isBuilt: true, i: 8, j: 8 })
  const villager = createUnit(owner, {
    i: 0,
    j: 0,
    detect(target) {
      calls.push(['detect', this.label, target.label])
    },
  })
  const context = createContext(12, [owner], calls)
  villager.context = context
  const UnitRestSystem = loadUnitRestSystem(calls)
  const system = new UnitRestSystem(context)

  const handled = system.handleUnitDanger(villager, {
    label: 'enemy',
    family: 'unit',
    owner: { label: 'enemy' },
    isDead: false,
    isDestroyed: false,
  })

  assert.equal(handled, true)
  assert.equal(villager.shelterState, undefined)
  assert.deepEqual(calls.at(-1), ['detect', 'villager-1', 'enemy'])
})

test('awake villagers still flee danger when morale breaks', () => {
  const calls = []
  const owner = {
    units: [],
    buildings: [],
    isEnemy(other) {
      return other?.label === 'enemy'
    },
  }
  owner.buildings.push({ label: 'tc', type: constants.BUILDING_TYPES.townCenter, owner, isBuilt: true, i: 8, j: 8 })
  const villager = createUnit(owner, {
    i: 0,
    j: 0,
    runaway(target) {
      calls.push(['runaway', this.label, target.label])
    },
  })
  const context = createContext(12, [owner], calls)
  villager.context = context
  const UnitRestSystem = loadUnitRestSystem(
    calls,
    {},
    {
      '../../lib/combat': {
        evaluateCombatMorale: () => 'flee',
      },
    }
  )
  const system = new UnitRestSystem(context)

  const handled = system.handleUnitDanger(villager, {
    label: 'enemy',
    family: 'unit',
    owner: { label: 'enemy' },
    isDead: false,
    isDestroyed: false,
  })

  assert.equal(handled, true)
  assert.equal(villager.shelterState, undefined)
  assert.deepEqual(calls.at(-1), ['runaway', 'villager-1', 'enemy'])
})

test('critical shelters eject hidden villagers', () => {
  const calls = []
  const owner = { units: [], buildings: [] }
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
  }
  owner.buildings.push(house)
  const villager = createUnit(owner)
  const context = createContext(12, [owner], calls)
  villager.context = context
  const entry = context.map.grid[6][7]
  villager.shelterState = { status: 'inside', reason: 'sleep', location: 'shelter', shelter: house }
  villager.alpha = 0
  villager.visible = false
  const UnitRestSystem = loadUnitRestSystem(calls)
  const system = new UnitRestSystem(context)

  system.evacuateUnitsIfShelterUnsafe(house)

  assert.equal(villager.shelterState, null)
  assert.equal(villager.alpha, 1)
  assert.equal(villager.i, entry.i)
  assert.equal(villager.j, entry.j)
})
