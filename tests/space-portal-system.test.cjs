const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function loadSpacePortalSystem(options = {}) {
  return loadTsModule('app/services/SpacePortalSystem.ts', {
    mocks: {
      '../lib/audio/sound': {
        playAudibleSoundCue: options.playAudibleSoundCue ?? (() => {}),
      },
      '../lib/grid/visibility': {
        updateInstanceRenderVisibility: options.updateInstanceRenderVisibility ?? (() => {}),
        updateInstanceVisibility: options.updateInstanceVisibility ?? (() => {}),
      },
    },
  })
}

for (const exiting of [false, true]) {
  for (const listener of ['hero', 'source', 'target', 'other']) {
    test(`door sound on ${exiting ? 'exit' : 'entry'} with listener ${listener}`, () => {
      const calls = []
      const { transferUnitThroughSpacePortal } = loadSpacePortalSystem({
        playAudibleSoundCue: (...args) => calls.push(args),
      })
      const { context, portal: entry } = createSplitPortalContext()
      for (const space of context.map.spaces.values()) {
        for (const row of space.grid) {
          for (const cell of row) cell.spaceId = space.id
        }
      }
      context.map.spaces.get('interior-house').buildingLabel = 'house-1'
      const portal = exiting
        ? {
            ...entry,
            sourceCell: entry.targetCell,
            sourceSpaceId: entry.targetSpaceId,
            targetCell: entry.sourceCell,
            targetSpaceId: entry.sourceSpaceId,
          }
        : entry
      const unit = {
        context,
        label: 'unit-1',
        spaceId: portal.sourceSpaceId,
        currentCell: portal.sourceCell,
        i: portal.sourceCell.i,
        j: portal.sourceCell.j,
        owner: { isPlayed: true },
      }
      context.controls = {
        heroUnit:
          listener === 'hero'
            ? unit
            : {
                spaceId:
                  listener === 'source'
                    ? portal.sourceSpaceId
                    : listener === 'target'
                      ? portal.targetSpaceId
                      : 'unrelated-room',
              },
      }
      let completed = 0
      assert.equal(
        transferUnitThroughSpacePortal(context, unit, portal, {
          onTransferred: () => completed++,
        }),
        true
      )
      assert.equal(completed, 1)
      assert.equal(calls.length, listener === 'other' ? 0 : 1)
      if (calls.length) {
        const cell = listener === 'target' ? portal.targetCell : portal.sourceCell
        assert.equal(calls[0][0].i, cell.i)
        assert.equal(calls[0][0].j, cell.j)
        assert.equal(calls[0][0].spaceId, listener === 'target' ? portal.targetSpaceId : portal.sourceSpaceId)
        assert.equal(calls[0][1], 'building/door-open')
        assert.deepEqual(calls[0][2], { profile: 'surface' })
      }
      assert.equal(transferUnitThroughSpacePortal(context, unit, portal), false)
      assert.equal(calls.length, listener === 'other' ? 0 : 1)
    })
  }
}

test('door sound waits for arrival and ignores portals without buildings', () => {
  const calls = []
  const { routeUnitThroughSpacePortal, transferUnitThroughSpacePortal } = loadSpacePortalSystem({
    playAudibleSoundCue: (...args) => calls.push(args),
  })
  const { context, portal, sourceCell } = createPortalContext()
  const interior = context.map.spaces.get('interior-house')
  interior.buildingLabel = 'house-1'
  const unit = { context, label: 'unit-1', i: 0, j: 0, currentCell: context.map.grid[0][0] }
  assert.equal(routeUnitThroughSpacePortal(context, unit, portal), true)
  assert.equal(calls.length, 0)
  unit.currentCell = sourceCell
  unit.i = sourceCell.i
  unit.j = sourceCell.j
  portal.targetCell.solid = true
  assert.equal(transferUnitThroughSpacePortal(context, unit, portal), false)
  assert.equal(calls.length, 0)
  portal.targetCell.solid = false
  delete interior.buildingLabel
  assert.equal(transferUnitThroughSpacePortal(context, unit, portal), true)
  assert.equal(calls.length, 0)
})

function createGrid(size) {
  return Array.from({ length: size }, (_, i) =>
    Array.from({ length: size }, (_, j) => ({
      category: 'Land',
      corpses: new Set(),
      has: null,
      i,
      j,
      solid: false,
      terrainHidden: false,
      type: 'grass',
      visible: true,
      waterBorder: false,
      x: i,
      y: j,
      z: 0,
      place(entity) {
        this.has = entity
      },
      setFog() {},
      removeFog() {},
      updateVisible() {},
      viewBy: new Set(),
      fogSprites: [],
    }))
  )
}

function createPortalContext() {
  const grid = createGrid(5)
  const sourceCell = grid[2][2]
  const targetCell = grid[3][3]
  const sortedContainers = []
  const createContainer = label => ({
    children: [],
    label,
    addChild(child) {
      this.children.push(child)
      child.parent = this
      return child
    },
    removeChild(child) {
      this.children = this.children.filter(candidate => candidate !== child)
      child.parent = null
      return child
    },
    sortChildren() {
      sortedContainers.push(label)
    },
  })
  const portal = {
    id: 'outside:house-entry',
    sourceCell,
    sourceSpaceId: 'outside',
    targetCell,
    targetSpaceId: 'interior-house',
  }
  const space = {
    id: 'interior-house',
    kind: 'interior',
    grid,
    size: 4,
    container: createContainer('interior-house'),
    origin: { x: 0, y: 0 },
    portals: [portal],
  }
  let scheduled = null
  const context = {
    map: {
      grid,
      size: 4,
      spaces: new Map([
        ['outside', { ...space, container: createContainer('outside'), id: 'outside', kind: 'outside' }],
        ['interior-house', space],
      ]),
    },
    scheduler: {
      elapsedMs: 0,
      add(callback) {
        scheduled = callback
        return 42
      },
      remove() {},
    },
  }
  return { context, grid, portal, sourceCell, sortedContainers, targetCell, getScheduled: () => scheduled }
}

function createSplitPortalContext() {
  const outsideGrid = createGrid(5)
  const interiorGrid = createGrid(5)
  for (const [spaceId, grid] of [
    ['outside', outsideGrid],
    ['interior-house', interiorGrid],
  ]) {
    for (const row of grid) {
      for (const cell of row) cell.spaceId = spaceId
    }
  }
  const sourceCell = outsideGrid[2][2]
  const targetCell = interiorGrid[2][2]
  const createContainer = label => ({
    children: [],
    label,
    addChild(child) {
      this.children.push(child)
      child.parent = this
      return child
    },
    removeChild(child) {
      this.children = this.children.filter(candidate => candidate !== child)
      child.parent = null
      return child
    },
    sortChildren() {},
  })
  const portal = {
    id: 'outside:house-entry',
    sourceCell,
    sourceSpaceId: 'outside',
    targetCell,
    targetSpaceId: 'interior-house',
  }
  const outsideSpace = {
    id: 'outside',
    kind: 'outside',
    grid: outsideGrid,
    size: 4,
    container: createContainer('outside'),
    origin: { x: 0, y: 0 },
    portals: [portal],
  }
  const interiorSpace = {
    id: 'interior-house',
    kind: 'interior',
    grid: interiorGrid,
    size: 4,
    container: createContainer('interior-house'),
    origin: { x: 0, y: 0 },
    portals: [portal],
  }
  let scheduled = null
  const context = {
    map: {
      grid: outsideGrid,
      size: 4,
      spaces: new Map([
        ['outside', outsideSpace],
        ['interior-house', interiorSpace],
      ]),
    },
    scheduler: {
      elapsedMs: 0,
      add(callback) {
        scheduled = callback
        return 42
      },
      remove() {},
    },
  }
  return { context, interiorGrid, portal, sourceCell, targetCell, getScheduled: () => scheduled }
}

test('building interior entry cells are reserved for passage only', () => {
  const { createReservedPassageCellLookup, findNearestPassageWaitingCell } = loadTsModule(
    'app/lib/buildings/passageCells.ts'
  )
  const grid = createGrid(5)
  const owner = { buildings: [], units: [] }
  const building = {
    i: 1,
    isBuilt: true,
    j: 0,
    label: 'town-center-1',
    owner,
    type: 'TownCenter',
  }
  owner.buildings.push(building)
  const context = { map: { grid, size: 4 }, players: [owner] }
  const entryCell = grid[2][2]
  const unit = {
    context,
    currentCell: grid[0][0],
    i: 0,
    j: 0,
    label: 'villager-1',
  }

  const lookup = createReservedPassageCellLookup(context)
  const waitingCell = findNearestPassageWaitingCell(unit, entryCell, { passageLookup: lookup })

  assert.equal(lookup.has(entryCell), true)
  assert.equal(lookup.has(grid[1][2]), false)
  assert.ok(waitingCell)
  assert.notEqual(waitingCell.cell, entryCell)
})

test('portal routes use the source cell as a passage, not a regular stopping cell', () => {
  const { routeUnitThroughSpacePortal } = loadSpacePortalSystem()
  const { context, portal, sourceCell } = createPortalContext()
  const sent = []
  const unit = {
    context,
    currentCell: context.map.grid[0][0],
    dest: null,
    i: 0,
    isDead: false,
    isDestroyed: false,
    j: 0,
    label: 'villager-1',
    path: [],
    sendToEvt(dest, action, options) {
      sent.push([dest, action, options])
      this.dest = dest
    },
  }

  assert.equal(routeUnitThroughSpacePortal(context, unit, portal), true)

  assert.equal(sent.length, 1)
  assert.equal(sent[0][0], sourceCell)
  assert.deepEqual(sent[0][2], {
    forceRepath: true,
    preserveAutonomy: true,
    allowPassageStop: true,
  })
})

test('portal transfer refreshes visibility and sorts the target space immediately', () => {
  const renderUpdates = []
  const visibilityUpdates = []
  const { routeUnitThroughSpacePortal } = loadSpacePortalSystem({
    updateInstanceVisibility: unit => {
      visibilityUpdates.push(unit.label)
      renderUpdates.push(unit.label)
    },
  })
  const { context, portal, sourceCell, sortedContainers, targetCell } = createPortalContext()
  const unit = {
    context,
    currentCell: sourceCell,
    dest: null,
    i: sourceCell.i,
    isDead: false,
    isDestroyed: false,
    j: sourceCell.j,
    label: 'hero-1',
    path: [],
    stopInterval() {},
    stopTimeout() {},
  }
  sourceCell.place(unit)
  sourceCell.solid = true

  assert.equal(routeUnitThroughSpacePortal(context, unit, portal), true)

  assert.equal(unit.currentCell, targetCell)
  assert.equal(unit.currentCell.has, unit)
  assert.equal(targetCell.has, unit)
  assert.equal(targetCell.solid, true)
  assert.equal(unit.spaceId, 'interior-house')
  assert.deepEqual(visibilityUpdates, ['hero-1'])
  assert.deepEqual(renderUpdates, ['hero-1'])
  assert.deepEqual(sortedContainers, ['interior-house'])
})

test('portal transfer completes its local transition only after the unit reaches the target space', () => {
  const { routeUnitThroughSpacePortal } = loadSpacePortalSystem()
  const { context, portal, sourceCell } = createPortalContext()
  const completed = []
  const unit = {
    context,
    currentCell: sourceCell,
    dest: null,
    i: sourceCell.i,
    isDead: false,
    isDestroyed: false,
    j: sourceCell.j,
    label: 'villager-1',
    path: [],
    stopInterval() {},
    stopTimeout() {},
  }
  sourceCell.place(unit)
  sourceCell.solid = true

  assert.equal(
    routeUnitThroughSpacePortal(context, unit, portal, {
      onTransferred: () => completed.push(unit.spaceId),
    }),
    true
  )

  assert.deepEqual(completed, ['interior-house'])
  assert.equal(unit.spacePortalState, null)
})

test('queued portal transfer preserves its completion until the unit reaches the door', () => {
  const { routeUnitThroughSpacePortal } = loadSpacePortalSystem()
  const { context, portal, sourceCell, getScheduled } = createPortalContext()
  const completed = []
  const unit = {
    context,
    currentCell: context.map.grid[0][0],
    dest: null,
    i: 0,
    isDead: false,
    isDestroyed: false,
    j: 0,
    label: 'villager-1',
    path: [],
    sendToEvt(dest) {
      this.dest = dest
    },
    stopInterval() {},
    stopTimeout() {},
  }

  routeUnitThroughSpacePortal(context, unit, portal, {
    onTransferred: () => completed.push(unit.spaceId),
  })
  assert.deepEqual(completed, [])

  unit.currentCell = sourceCell
  unit.i = sourceCell.i
  unit.j = sourceCell.j
  sourceCell.place(unit)
  sourceCell.solid = true
  getScheduled()()

  assert.deepEqual(completed, ['interior-house'])
  assert.equal(unit.spacePortalState, null)
})

for (const exiting of [false, true]) {
  test(`NPC ${exiting ? 'exit' : 'entry'} arrives on the door then walks away`, () => {
    const { routeUnitThroughSpacePortal } = loadSpacePortalSystem()
    const { context, portal: entry } = createSplitPortalContext()
    const portal = exiting
      ? {
          ...entry,
          sourceCell: entry.targetCell,
          sourceSpaceId: entry.targetSpaceId,
          targetCell: entry.sourceCell,
          targetSpaceId: entry.sourceSpaceId,
        }
      : entry
    const { sourceCell, targetCell } = portal
    const unit = {
      context,
      spaceId: portal.sourceSpaceId,
      currentCell: sourceCell,
      dest: null,
      i: sourceCell.i,
      isDead: false,
      isDestroyed: false,
      j: sourceCell.j,
      label: 'villager-1',
      path: [],
      sendToEvt(dest) {
        this.dest = dest
      },
      stopInterval() {},
      stopTimeout() {},
    }
    sourceCell.place(unit)
    sourceCell.solid = true

    assert.equal(routeUnitThroughSpacePortal(context, unit, portal), true)

    assert.equal(unit.currentCell, targetCell)
    assert.equal(unit.currentCell.has, unit)
    assert.equal(targetCell.has, unit)
    assert.equal(targetCell.solid, true)
    assert.ok(unit.dest)
    assert.notEqual(unit.dest, targetCell)
    assert.notEqual(unit.dest, sourceCell)
  })
}

test('an order resumed after portal arrival is preserved instead of replaced by passage clearing', () => {
  const { transferUnitThroughSpacePortal } = loadSpacePortalSystem()
  const { context, portal, sourceCell, targetCell, interiorGrid } = createSplitPortalContext()
  const destination = interiorGrid[4][4]
  const unit = {
    context,
    label: 'worker',
    currentCell: sourceCell,
    i: sourceCell.i,
    j: sourceCell.j,
    sendToEvt(dest) {
      this.dest = dest
    },
  }
  sourceCell.place(unit)
  sourceCell.solid = true
  assert.equal(
    transferUnitThroughSpacePortal(context, unit, portal, {
      onTransferred: () => unit.sendToEvt(destination),
    }),
    true
  )
  assert.equal(unit.currentCell, targetCell)
  assert.equal(unit.dest, destination)
})

test('blocked portal targets ask the blocking npc to clear the passage cell', () => {
  const { routeUnitThroughSpacePortal } = loadSpacePortalSystem()
  const { context, portal, sourceCell, targetCell, getScheduled } = createPortalContext()
  const blockerSent = []
  const blocker = {
    context,
    currentCell: targetCell,
    family: 'unit',
    i: targetCell.i,
    isDead: false,
    isDestroyed: false,
    j: targetCell.j,
    label: 'villager-2',
    path: [],
    sendToEvt(dest, action, options) {
      blockerSent.push([dest, action, options])
      this.dest = dest
    },
  }
  targetCell.has = blocker
  targetCell.solid = true
  const unit = {
    context,
    currentCell: sourceCell,
    dest: null,
    i: sourceCell.i,
    isDead: false,
    isDestroyed: false,
    j: sourceCell.j,
    label: 'villager-1',
    path: [],
    sendToEvt(dest) {
      this.dest = dest
    },
    stopInterval() {},
    stopTimeout() {},
  }
  sourceCell.place(unit)
  sourceCell.solid = true

  assert.equal(routeUnitThroughSpacePortal(context, unit, portal), true)
  getScheduled()()

  assert.ok(blockerSent.length >= 1)
  assert.notEqual(blockerSent[0][0], targetCell)
  assert.deepEqual(blockerSent[0][1], null)
  assert.deepEqual(blockerSent[0][2], { forceRepath: true, preserveAutonomy: true })
})

test('hero portal transfer pushes a blocking animal away from the target passage cell', () => {
  const { routeUnitThroughSpacePortal } = loadSpacePortalSystem()
  const { context, portal, sourceCell, targetCell } = createPortalContext()
  const blocker = {
    context,
    currentCell: targetCell,
    family: 'animal',
    i: targetCell.i,
    isDead: false,
    isDestroyed: false,
    j: targetCell.j,
    label: 'boar-1',
    path: [{ i: targetCell.i, j: targetCell.j }],
    stopInterval() {},
    stopTimeout() {},
  }
  targetCell.place(blocker)
  targetCell.solid = true
  const hero = {
    context,
    controlMode: 'hero',
    currentCell: sourceCell,
    dest: null,
    i: sourceCell.i,
    isDead: false,
    isDestroyed: false,
    j: sourceCell.j,
    label: 'hero-1',
    path: [],
    stopInterval() {},
    stopTimeout() {},
  }
  sourceCell.place(hero)
  sourceCell.solid = true

  assert.equal(routeUnitThroughSpacePortal(context, hero, portal), true)

  assert.equal(hero.currentCell, targetCell)
  assert.equal(hero.currentCell.has, hero)
  assert.equal(targetCell.has, hero)
  assert.equal(targetCell.solid, true)
  assert.notEqual(blocker.currentCell, targetCell)
  assert.equal(blocker.currentCell.solid, true)
  assert.equal(blocker.currentCell.has, blocker)
  assert.deepEqual(blocker.path, [])
})

test('hero portal transfer clears stale solid passage cells without an occupant', () => {
  const { routeUnitThroughSpacePortal } = loadSpacePortalSystem()
  const { context, portal, sourceCell, targetCell } = createPortalContext()
  targetCell.has = null
  targetCell.solid = true
  const hero = {
    context,
    controlMode: 'hero',
    currentCell: sourceCell,
    dest: null,
    i: sourceCell.i,
    isDead: false,
    isDestroyed: false,
    j: sourceCell.j,
    label: 'hero-1',
    path: [],
    stopInterval() {},
    stopTimeout() {},
  }
  sourceCell.place(hero)
  sourceCell.solid = true

  assert.equal(routeUnitThroughSpacePortal(context, hero, portal), true)

  assert.equal(hero.currentCell, targetCell)
  assert.equal(hero.currentCell.has, hero)
  assert.equal(targetCell.has, hero)
  assert.equal(targetCell.solid, true)
})

test('blocked portal target makes the unit wait away from the source cell', () => {
  const { routeUnitThroughSpacePortal } = loadSpacePortalSystem()
  const { context, portal, sourceCell, targetCell, getScheduled } = createPortalContext()
  const blocker = { label: 'villager-2', isDestroyed: false }
  targetCell.has = blocker
  targetCell.solid = true

  const sent = []
  const unit = {
    context,
    currentCell: sourceCell,
    dest: null,
    i: sourceCell.i,
    isDead: false,
    isDestroyed: false,
    j: sourceCell.j,
    label: 'villager-1',
    path: [],
    sendToEvt(dest, action, options) {
      sent.push([dest, action, options])
      this.dest = dest
    },
    stopInterval() {},
    stopTimeout() {},
  }
  sourceCell.place(unit)
  sourceCell.solid = true

  assert.equal(routeUnitThroughSpacePortal(context, unit, portal), true)
  getScheduled()()

  assert.equal(sent.length, 1)
  assert.notEqual(sent[0][0], sourceCell)
  assert.deepEqual(sent[0][1], null)
  assert.deepEqual(sent[0][2], { forceRepath: true, preserveAutonomy: true })

  sourceCell.has = null
  sourceCell.solid = false
  unit.currentCell = sent[0][0]
  unit.i = sent[0][0].i
  unit.j = sent[0][0].j
  sent.length = 0
  getScheduled()()

  assert.deepEqual(sent, [])
})

test('full portal destination makes a source-cell traveler wait away from the passage', () => {
  const { routeUnitThroughSpacePortal } = loadSpacePortalSystem()
  const { context, interiorGrid, portal, sourceCell, targetCell } = createSplitPortalContext()
  for (const row of interiorGrid) {
    for (const cell of row) {
      if (cell === targetCell) continue
      cell.has = { family: 'unit', i: cell.i, isDestroyed: false, j: cell.j, label: `occupant-${cell.i}-${cell.j}` }
      cell.solid = true
    }
  }
  const sent = []
  const unit = {
    context,
    currentCell: sourceCell,
    dest: null,
    i: sourceCell.i,
    isDead: false,
    isDestroyed: false,
    j: sourceCell.j,
    label: 'villager-1',
    path: [],
    sendToEvt(dest, action, options) {
      sent.push([dest, action, options])
      this.dest = dest
    },
    stopInterval() {},
    stopTimeout() {},
  }
  sourceCell.place(unit)
  sourceCell.solid = true

  assert.equal(routeUnitThroughSpacePortal(context, unit, portal), true)

  assert.equal(unit.currentCell, sourceCell)
  assert.equal(sent.length, 1)
  assert.notEqual(sent[0][0], sourceCell)
  assert.notEqual(sent[0][0], targetCell)
  assert.deepEqual(sent[0][1], null)
  assert.deepEqual(sent[0][2], { forceRepath: true, preserveAutonomy: true })
})

test('portal capacity and pursuit guards are checked before transfer', () => {
  const { transferUnitThroughSpacePortal } = loadSpacePortalSystem()
  const { context, portal } = createSplitPortalContext()
  const unit = {
    context,
    label: 'guard',
    spaceId: portal.sourceSpaceId,
    currentCell: portal.sourceCell,
    i: portal.sourceCell.i,
    j: portal.sourceCell.j,
  }
  let transferred = false
  for (const guards of [{ canTransfer: () => false }, { shouldContinue: () => false }]) {
    assert.equal(
      transferUnitThroughSpacePortal(context, unit, portal, {
        ...guards,
        onTransferred: () => {
          transferred = true
        },
      }),
      false
    )
    assert.equal(unit.spaceId, portal.sourceSpaceId)
    assert.equal(transferred, false)
  }
})
