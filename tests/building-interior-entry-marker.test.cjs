const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function loadEntryMarker() {
  const drawn = []
  class Graphics {
    constructor() {
      this.eventMode = null
      this.label = null
      this.parent = { removeChild: () => {} }
      this.zIndex = 0
    }
    clear() {
      drawn.push(['clear'])
    }
    destroy() {}
  }

  const module = loadTsModule('app/services/BuildingInteriorEntryMarkerSystem.ts', {
    mocks: {
      'pixi.js': { Graphics },
      '../constants': {
        BUILDING_TYPES: { house: 'House', townCenter: 'TownCenter' },
        LABEL_TYPES: { buildingInteriorEntry: 'buildingInteriorEntry' },
      },
      '../lib/ui/InteractionCellMarker': {
        INTERACTION_CELL_MARKER_PULSE_MS: 1400,
        INTERACTION_CELL_MARKER_Z_INDEX: -0.25,
        drawInteractionCellMarker: (_layer, cell, pulse) => drawn.push(['draw', cell.i, cell.j, pulse]),
        interactionCellPulse: () => 0.5,
      },
    },
  })

  return { ...module, drawn }
}

function makeGrid(size) {
  return Array.from({ length: size }, (_, i) =>
    Array.from({ length: size }, (_, j) => ({ i, j, category: 'Grass', terrainHidden: false }))
  )
}

test('building interior entry marker draws supported exterior entry cells', () => {
  const { BuildingInteriorEntryMarkerSystem, drawn } = loadEntryMarker()
  const ticker = { add: () => {}, remove: () => {} }
  const children = []
  const map = {
    addChild: child => children.push(child),
    grid: makeGrid(16),
  }
  const context = {
    app: { ticker },
    player: {
      buildings: [
        { i: 5, isBuilt: true, j: 5, type: 'TownCenter' },
        { i: 1, isBuilt: true, j: 1, type: 'Barracks' },
      ],
    },
    players: [
      {
        buildings: [
          { i: 5, isBuilt: true, j: 5, type: 'TownCenter' },
          { i: 1, isBuilt: true, j: 1, type: 'Barracks' },
        ],
      },
      {
        buildings: [{ i: 10, isBuilt: true, j: 4, type: 'House' }],
      },
    ],
  }

  const marker = new BuildingInteriorEntryMarkerSystem(context, map)

  assert.equal(children[0].label, 'buildingInteriorEntry')
  assert.deepEqual(drawn, [
    ['clear'],
    ['draw', 6, 7, 0.5],
    ['draw', 11, 6, 0.5],
  ])

  marker.destroy()
})
