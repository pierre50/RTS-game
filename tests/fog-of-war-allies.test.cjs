const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function loadFogOfWar() {
  const mocks = {
    '../constants': {
      FAMILY_TYPES: { animal: 'animal', building: 'building', unit: 'unit' },
      PLAYER_TYPES: { ai: 'ai' },
    },
  }
  return loadTsModule('app/services/FogOfWar.ts', { mocks })
}

function createViews(size = 2) {
  let activeSpaceId = 'outside'
  const viewersBySpace = new Map()
  const viewedBySpace = new Map()
  const calls = []
  const getSpaceViewers = () => {
    let viewersByIndex = viewersBySpace.get(activeSpaceId)
    if (!viewersByIndex) {
      viewersByIndex = new Map()
      viewersBySpace.set(activeSpaceId, viewersByIndex)
    }
    return viewersByIndex
  }
  const getSpaceViewed = () => {
    let viewed = viewedBySpace.get(activeSpaceId)
    if (!viewed) {
      viewed = new Set()
      viewedBySpace.set(activeSpaceId, viewed)
    }
    return viewed
  }
  return {
    calls,
    size,
    index: (i, j) => i * (size + 1) + j,
    coordinates: index => [Math.floor(index / (size + 1)), index % (size + 1)],
    withSpace(spaceId, callback) {
      const previous = activeSpaceId
      activeSpaceId = spaceId || 'outside'
      try {
        return callback()
      } finally {
        activeSpaceId = previous
      }
    },
    addViewer(i, j, viewer) {
      calls.push(['addViewer', i, j, viewer.label])
      const index = this.index(i, j)
      const viewersByIndex = getSpaceViewers()
      const viewers = viewersByIndex.get(index) ?? new Set()
      viewers.add(viewer)
      viewersByIndex.set(index, viewers)
    },
    removeViewer(i, j, viewer) {
      calls.push(['removeViewer', i, j, viewer.label])
      const viewersByIndex = getSpaceViewers()
      const viewers = viewersByIndex.get(this.index(i, j))
      viewers?.delete(viewer)
    },
    getViewers(i, j) {
      const viewersByIndex = getSpaceViewers()
      return viewersByIndex.get(this.index(i, j)) ?? new Set()
    },
    hasViewer(i, j, viewer) {
      return this.getViewers(i, j).has(viewer)
    },
    isVisible(i, j) {
      return this.getViewers(i, j).size > 0
    },
    isViewed(i, j) {
      return getSpaceViewed().has(this.index(i, j))
    },
    setViewed(i, j) {
      const index = this.index(i, j)
      const viewed = getSpaceViewed()
      const changed = !viewed.has(index)
      viewed.add(index)
      calls.push(['setViewed', i, j, changed])
      return changed
    },
    getKnownOccupant: () => null,
    setKnownOccupant: () => {},
  }
}

function createCell(i, j) {
  return {
    i,
    j,
    viewBy: new Set(),
    corpses: [],
    fogged: false,
    unfogged: false,
    setFog() {
      this.fogged = true
    },
    removeFog() {
      this.unfogged = true
    },
    updateVisible() {},
  }
}

test('unit vision updates only its owner, not allied players', () => {
  const { updateVisibility } = loadFogOfWar()
  const owner = {
    label: 'owner',
    type: 'human',
    cellViewed: 0,
    views: createViews(),
    visiblePlayers: () => {
      throw new Error('allied vision sharing should not be used')
    },
  }
  const ally = {
    label: 'ally',
    type: 'human',
    cellViewed: 0,
    views: createViews(),
  }
  const grid = Array.from({ length: 3 }, (_, i) => Array.from({ length: 3 }, (_, j) => createCell(i, j)))
  const instance = {
    i: 1,
    j: 1,
    label: 'scout',
    owner,
    sight: 0,
    context: {
      map: { grid, revealEverything: false },
      player: owner,
    },
  }

  updateVisibility(instance)

  assert.equal(owner.views.hasViewer(1, 1, instance), true)
  assert.equal(owner.cellViewed, 1)
  assert.equal(ally.views.hasViewer(1, 1, instance), false)
  assert.equal(ally.cellViewed, 0)
})

test('instances with providesVision false do not reveal even their own cell', () => {
  const { updateVisibility } = loadFogOfWar()
  const owner = {
    label: 'owner',
    type: 'human',
    cellViewed: 0,
    views: createViews(),
  }
  const grid = Array.from({ length: 3 }, (_, i) => Array.from({ length: 3 }, (_, j) => createCell(i, j)))
  const trap = {
    i: 1,
    j: 1,
    label: 'trap',
    owner,
    providesVision: false,
    sight: 3,
    visibleCells: new Set([owner.views.index(1, 1)]),
    context: {
      map: { grid, revealEverything: false },
      player: owner,
    },
  }
  owner.views.addViewer(1, 1, trap)

  updateVisibility(trap)

  assert.equal(owner.views.hasViewer(1, 1, trap), false)
  assert.equal(grid[1][1].viewBy.has(trap), false)
})

test('unit vision in an interior space does not reveal matching exterior coordinates', () => {
  const { updateVisibility } = loadFogOfWar()
  const owner = {
    label: 'owner',
    type: 'human',
    cellViewed: 0,
    views: createViews(),
  }
  const exteriorGrid = Array.from({ length: 3 }, (_, i) => Array.from({ length: 3 }, (_, j) => createCell(i, j)))
  const interiorGrid = Array.from({ length: 3 }, (_, i) => Array.from({ length: 3 }, (_, j) => createCell(i, j)))
  const instance = {
    i: 1,
    j: 1,
    label: 'hero',
    owner,
    sight: 0,
    spaceId: 'interior:house',
    context: {
      map: {
        grid: exteriorGrid,
        revealEverything: false,
        size: 2,
        spaces: new Map([
          ['outside', { id: 'outside', grid: exteriorGrid, size: 2 }],
          ['interior:house', { id: 'interior:house', grid: interiorGrid, size: 2 }],
        ]),
      },
      player: owner,
    },
  }

  updateVisibility(instance)

  assert.equal(owner.views.withSpace('outside', () => owner.views.isViewed(1, 1)), false)
  assert.equal(owner.views.withSpace('interior:house', () => owner.views.isViewed(1, 1)), true)
  assert.equal(exteriorGrid[1][1].viewBy.has(instance), false)
  assert.equal(interiorGrid[1][1].viewBy.has(instance), true)
  assert.equal(exteriorGrid[1][1].unfogged, false)
  assert.equal(interiorGrid[1][1].unfogged, true)
})

test('animal detection uses slow target insight range when a unit reveals its cell', () => {
  const { updateVisibility } = loadFogOfWar()

  function detectFrom(unitI, requestedMoveSpeedFactor) {
    const detectCalls = []
    const owner = {
      label: 'owner',
      type: 'human',
      cellViewed: 0,
      views: createViews(8),
    }
    const grid = Array.from({ length: 9 }, (_, i) => Array.from({ length: 9 }, (_, j) => createCell(i, j)))
    grid[0][0].has = {
      i: 0,
      j: 0,
      label: 'deer',
      sight: 8,
      detect: target => detectCalls.push(target.label),
    }
    const unit = {
      i: unitI,
      j: 0,
      label: 'scout',
      family: 'unit',
      owner,
      requestedMoveSpeedFactor,
      sight: 8,
      context: {
        map: { grid, revealEverything: false },
        player: owner,
      },
    }

    updateVisibility(unit)
    return detectCalls
  }

  assert.deepEqual(detectFrom(5, 1), ['scout'])
  assert.deepEqual(detectFrom(5, 0.5), [])
  assert.deepEqual(detectFrom(4, 0.5), ['scout'])
})
