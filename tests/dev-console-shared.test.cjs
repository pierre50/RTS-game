const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function loadSharedActions({ canPlaceBuildingAt, hasBuildingPlacementClearance }) {
  return loadTsModule('app/dev-console/actions/shared.ts', {
    mocks: {
      'pixi.js': {
        Container: class {},
        Graphics: class {},
      },
      '../../constants': {
        CELL_HEIGHT: 32,
        CELL_WIDTH: 64,
        FAMILY_TYPES: { building: 'building', resource: 'resource', unit: 'unit', animal: 'animal' },
      },
      '../../lib': {
        addEntityToMapSpaceContainer: () => {},
        canPlaceBuildingAt,
        getMapSpace: () => null,
        hasBuildingPlacementClearance,
      },
    },
  })
}

function createGrid(size) {
  return Array.from({ length: size }, (_, i) =>
    Array.from({ length: size }, (_, j) => ({
      i,
      j,
      category: 'Grass',
      solid: false,
    }))
  )
}

test('dev-console building spawn requires placement clearance at the cursor', () => {
  const grid = createGrid(5)
  const cursorCell = grid[2][2]
  const calls = []
  const { getSpawnCell } = loadSharedActions({
    canPlaceBuildingAt: (_grid, i, j) => i === 2 && j === 2,
    hasBuildingPlacementClearance: (_grid, i, j) => {
      calls.push([i, j])
      return false
    },
  })

  const result = getSpawnCell(
    {
      map: { grid },
      controls: { getCellUnderCursor: () => cursorCell },
    },
    { buildingConfig: { type: 'Farm', size: 4 } }
  )

  assert.equal(result, null)
  assert.deepEqual(calls, [[2, 2]])
})

test('dev-console building spawn skips nearby cells without placement clearance', () => {
  const grid = createGrid(5)
  const cursorCell = grid[2][2]
  const { getSpawnCell } = loadSharedActions({
    canPlaceBuildingAt: (_grid, i, j) => (i === 2 && j === 2) || (i === 1 && j === 1) || (i === 1 && j === 2),
    hasBuildingPlacementClearance: (_grid, i, j) => i === 1 && j === 2,
  })

  const result = getSpawnCell(
    {
      map: { grid },
      controls: { getCellUnderCursor: () => cursorCell },
    },
    { buildingConfig: { type: 'Farm', size: 4 } }
  )

  assert.equal(result, grid[1][2])
})
