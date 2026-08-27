const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function loadBuildingInteriors() {
  return loadTsModule('app/lib/buildings/interiors.ts', {
    mocks: {
      '../../constants': {
        BUILDING_TYPES: { house: 'House', townCenter: 'TownCenter' },
      },
    },
  })
}

function makeGrid(size) {
  return Array.from({ length: size }, (_, i) => Array.from({ length: size }, (_, j) => ({ i, j })))
}

test('building interior entry uses the configured grid cell in front of the door', () => {
  const { findBuildingInteriorEntryTarget, getBuildingInteriorEntryCell } = loadBuildingInteriors()
  const grid = makeGrid(12)
  const townCenter = {
    context: { map: { grid } },
    i: 5,
    isBuilt: true,
    j: 5,
    type: 'TownCenter',
  }
  const hero = {
    context: { map: { grid } },
    i: 6,
    j: 7,
  }

  assert.equal(getBuildingInteriorEntryCell(townCenter), grid[6][7])
  assert.equal(findBuildingInteriorEntryTarget(hero, [townCenter]), townCenter)
  assert.equal(findBuildingInteriorEntryTarget({ ...hero, i: 5 }, [townCenter]), null)
})

test('building interior entry ignores unfinished and unsupported buildings', () => {
  const { findBuildingInteriorEntryTarget } = loadBuildingInteriors()
  const grid = makeGrid(12)
  const hero = { context: { map: { grid } }, i: 6, j: 7 }

  assert.equal(findBuildingInteriorEntryTarget(hero, [{ i: 5, isBuilt: false, j: 5, type: 'TownCenter' }]), null)
  assert.equal(findBuildingInteriorEntryTarget(hero, [{ i: 5, isBuilt: true, j: 5, type: 'Barracks' }]), null)
})

test('house interior entry uses the same grid cell flow', () => {
  const { findBuildingInteriorEntryTarget, isBuildingInteriorSupported } = loadBuildingInteriors()
  const grid = makeGrid(12)
  const house = {
    context: { map: { grid } },
    i: 5,
    isBuilt: true,
    j: 5,
    type: 'House',
  }
  const hero = {
    context: { map: { grid } },
    i: 6,
    j: 7,
  }

  assert.equal(isBuildingInteriorSupported(house), true)
  assert.equal(findBuildingInteriorEntryTarget(hero, [house]), house)
  assert.equal(findBuildingInteriorEntryTarget({ ...hero, j: 6 }, [house]), null)
})

test('building interior entry offset matches the measured exterior door cell', () => {
  const { getBuildingInteriorEntryCell } = loadBuildingInteriors()
  const grid = makeGrid(50)
  const building = {
    context: { map: { grid } },
    i: 22,
    isBuilt: true,
    j: 39,
    type: 'TownCenter',
  }

  assert.equal(getBuildingInteriorEntryCell(building), grid[23][41])
})

test('building interior entry can override the default entry offset', () => {
  const { findBuildingInteriorEntryTarget, getBuildingInteriorEntryCell } = loadBuildingInteriors()
  const grid = makeGrid(12)
  const house = {
    context: { map: { grid } },
    i: 5,
    interior: { entryOffset: { i: -1, j: 2 } },
    isBuilt: true,
    j: 5,
    type: 'House',
  }
  const hero = {
    context: { map: { grid } },
    i: 4,
    j: 7,
  }

  assert.equal(getBuildingInteriorEntryCell(house), grid[4][7])
  assert.equal(findBuildingInteriorEntryTarget(hero, [house]), house)
})

test('interior exit cell uses configured exits then falls back to the bottom middle floor cell', () => {
  const { getInteriorExitCell } = loadTsModule('app/lib/buildings/interiorExits.ts')
  const configuredCell = { i: 8, j: 11, category: 'Dirt', terrainHidden: false }
  const fallbackCell = { i: 7, j: 12, category: 'Dirt', terrainHidden: false }
  const map = {
    grid: Array.from({ length: 16 }, () => Array.from({ length: 16 }, () => ({ category: 'Water', terrainHidden: true }))),
    interiorExits: [{ i: 8, j: 11 }],
    mapType: 'interior',
    size: 15,
  }
  map.grid[8][11] = configuredCell
  map.grid[7][12] = fallbackCell

  assert.equal(getInteriorExitCell(map), configuredCell)

  map.interiorExits = []
  assert.equal(getInteriorExitCell(map), fallbackCell)
})
