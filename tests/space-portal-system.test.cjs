const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function loadSpacePortalSystem(options = {}) {
  return loadTsModule('app/services/SpacePortalSystem.ts', {
    mocks: {
      '../lib/grid/visibility': {
        updateInstanceRenderVisibility: options.updateInstanceRenderVisibility ?? (() => {}),
        updateInstanceVisibility: options.updateInstanceVisibility ?? (() => {}),
      },
    },
  })
}

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
    updateInstanceRenderVisibility: unit => renderUpdates.push(unit.label),
    updateInstanceVisibility: unit => visibilityUpdates.push(unit.label),
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

  assert.notEqual(unit.currentCell, targetCell)
  assert.equal(unit.currentCell.has, unit)
  assert.equal(targetCell.has, null)
  assert.equal(targetCell.solid, false)
  assert.equal(unit.spaceId, 'interior-house')
  assert.deepEqual(visibilityUpdates, ['hero-1'])
  assert.deepEqual(renderUpdates, ['hero-1'])
  assert.deepEqual(sortedContainers, ['interior-house'])
})

test('non-hero portal travelers arrive beside the target passage cell after transfer', () => {
  const { routeUnitThroughSpacePortal } = loadSpacePortalSystem()
  const { context, portal, sourceCell, targetCell } = createPortalContext()
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

  assert.notEqual(unit.currentCell, targetCell)
  assert.equal(unit.currentCell.has, unit)
  assert.equal(targetCell.has, null)
  assert.equal(targetCell.solid, false)
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

  assert.notEqual(hero.currentCell, targetCell)
  assert.equal(hero.currentCell.has, hero)
  assert.equal(targetCell.has, null)
  assert.equal(targetCell.solid, false)
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

  assert.notEqual(hero.currentCell, targetCell)
  assert.equal(hero.currentCell.has, hero)
  assert.equal(targetCell.has, null)
  assert.equal(targetCell.solid, false)
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
