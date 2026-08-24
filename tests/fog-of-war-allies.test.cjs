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
  const viewersByIndex = new Map()
  const viewed = new Set()
  const calls = []
  return {
    calls,
    size,
    index: (i, j) => i * (size + 1) + j,
    coordinates: index => [Math.floor(index / (size + 1)), index % (size + 1)],
    addViewer(i, j, viewer) {
      calls.push(['addViewer', i, j, viewer.label])
      const index = this.index(i, j)
      const viewers = viewersByIndex.get(index) ?? new Set()
      viewers.add(viewer)
      viewersByIndex.set(index, viewers)
    },
    removeViewer(i, j, viewer) {
      calls.push(['removeViewer', i, j, viewer.label])
      const viewers = viewersByIndex.get(this.index(i, j))
      viewers?.delete(viewer)
    },
    getViewers(i, j) {
      return viewersByIndex.get(this.index(i, j)) ?? new Set()
    },
    hasViewer(i, j, viewer) {
      return this.getViewers(i, j).has(viewer)
    },
    isVisible(i, j) {
      return this.getViewers(i, j).size > 0
    },
    setViewed(i, j) {
      const index = this.index(i, j)
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
    setFog() {},
    removeFog() {},
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
