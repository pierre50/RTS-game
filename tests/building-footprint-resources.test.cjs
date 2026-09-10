const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

const { getBuildingFootprintCells } = loadTsModule('app/lib/grid/cells.ts')
const { occupyBuildingFootprint } = loadTsModule('app/classes/building/BuildingSetup.ts', {
  mocks: {
    'pixi.js': {},
    '../../lib': {
      getBuildingFootprintCells,
      getEntityMapSpace: building => building.context.map,
      clearCellTerrainSet: () => {},
    },
    './BuildingVisuals': {},
    './BuildingTrainingPreview': {},
  },
})

test('building footprint destroys wheat and every wildgrass type before occupying their cells', () => {
  const grid = Array.from({ length: 5 }, (_, i) =>
    Array.from({ length: 5 }, (_, j) => ({ i, j, has: null, solid: false, corpses: new Set() }))
  )
  const building = { i: 2, j: 2, size: 2, context: { map: { grid, kind: 'interior' } } }
  const cells = getBuildingFootprintCells(2, 2, grid, 2)
  const resources = ['Wheat', 'MedicinalHerb', 'ToxicHerb', 'FiberPlant'].map((type, index) => {
    const cell = cells[index]
    const resource = {
      family: 'resource',
      type,
      isDead: false,
      isDestroyed: false,
      die(immediate) {
        assert.equal(immediate, true, 'wheat must be destroyed rather than reset for regrowth')
        assert.equal(cell.has, resource)
        this.isDead = true
        cell.has = null
        cell.corpses.add(this)
      },
      clear() {
        this.isDestroyed = true
        cell.corpses.delete(this)
      },
    }
    cell.has = resource
    return resource
  })
  const neighbor = { family: 'resource', type: 'Wheat', die: () => assert.fail('outside footprint') }
  grid[0][0].has = neighbor

  occupyBuildingFootprint(building)

  for (const resource of resources) {
    assert.equal(resource.isDead, true)
    assert.equal(resource.isDestroyed, true)
  }
  for (const cell of cells) {
    assert.equal(cell.has, building)
    assert.equal(cell.solid, true)
    assert.equal(cell.corpses.size, 0)
  }
  assert.equal(grid[0][0].has, neighbor)
})
