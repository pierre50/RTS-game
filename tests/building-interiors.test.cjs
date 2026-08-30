const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function loadBuildingInteriors() {
  return loadTsModule('app/lib/buildings/interiors.ts', {
    mocks: {
      '../../constants': {
        BUILDING_TYPES: {
          archeryRange: 'ArcheryRange',
          barracks: 'Barracks',
          granary: 'Granary',
          house: 'House',
          market: 'Market',
          stable: 'Stable',
          storagePit: 'StoragePit',
          temple: 'Temple',
          townCenter: 'TownCenter',
          watchTower: 'WatchTower',
        },
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
  assert.equal(findBuildingInteriorEntryTarget(hero, [{ i: 5, isBuilt: true, j: 5, type: 'Farm' }]), null)
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

test('stable interior entry uses the same size and entry flow as a house', () => {
  const { findBuildingInteriorEntryTarget, getBuildingInteriorBlueprintType, isBuildingInteriorSupported } =
    loadBuildingInteriors()
  const grid = makeGrid(12)
  const stable = {
    context: { map: { grid } },
    i: 5,
    isBuilt: true,
    j: 5,
    type: 'Stable',
  }
  const hero = {
    context: { map: { grid } },
    i: 6,
    j: 7,
  }

  assert.equal(isBuildingInteriorSupported(stable), true)
  assert.equal(getBuildingInteriorBlueprintType(stable), 'Stable')
  assert.equal(findBuildingInteriorEntryTarget(hero, [stable]), stable)
})

test('interior decorations vary by building type', () => {
  const { getBuildingInteriorDecorationLayout } = loadTsModule('app/lib/buildings/interiorDecorations.ts', {
    mocks: {
      '../../constants': {
        BUILDING_TYPES: {
          archeryRange: 'ArcheryRange',
          barracks: 'Barracks',
          campBucket: 'CampBucket',
          campCrate: 'CampCrate',
          campDryingRack: 'CampDryingRack',
          campFencePost: 'CampFencePost',
          campJarSmall: 'CampJarSmall',
          campJarLarge: 'CampJarLarge',
          campRockPile: 'CampRockPile',
          campSkull: 'CampSkull',
          campTotemHorns: 'CampTotemHorns',
          campTotemPlain: 'CampTotemPlain',
          fireCamp: 'FireCamp',
          granary: 'Granary',
          house: 'House',
          market: 'Market',
          stable: 'Stable',
          storagePit: 'StoragePit',
          temple: 'Temple',
          watchTower: 'WatchTower',
        },
      },
    },
  })

  assert.deepEqual(getBuildingInteriorDecorationLayout({ type: 'Stable' }).map(item => item.type), [
    'CampBucket',
    'CampDryingRack',
  ])
  assert.deepEqual(getBuildingInteriorDecorationLayout({ type: 'Barracks' }).map(item => item.type), [
    'FireCamp',
    'CampCrate',
    'CampTotemPlain',
  ])
  assert.deepEqual(getBuildingInteriorDecorationLayout({ type: 'Temple' }).map(item => item.type), [
    'CampTotemHorns',
    'CampJarLarge',
    'CampJarSmall',
  ])
})

test('building interior entry offset matches the measured exterior door cell', () => {
  const { getBuildingInteriorEntryCell, getBuildingInteriorEntryPosition } = loadBuildingInteriors()
  const grid = makeGrid(50)
  const building = {
    context: { map: { grid } },
    i: 22,
    isBuilt: true,
    j: 39,
    type: 'TownCenter',
  }

  assert.equal(getBuildingInteriorEntryCell(building), grid[23][41])
  assert.deepEqual(getBuildingInteriorEntryPosition({ i: 22, j: 39, type: 'TownCenter' }), { i: 23, j: 41 })
  assert.equal(getBuildingInteriorEntryPosition({ i: 22, isBuilt: false, j: 39, type: 'TownCenter' }), null)
})

test('building interior portal id includes the owner to avoid cross-player collisions', () => {
  const { getBuildingInteriorPortalId } = loadBuildingInteriors()
  const ownTownCenter = {
    i: 5,
    isBuilt: true,
    j: 5,
    label: 'town-center',
    owner: { label: 'player-1' },
    type: 'TownCenter',
  }
  const enemyTownCenter = {
    i: 5,
    isBuilt: true,
    j: 5,
    label: 'town-center',
    owner: { label: 'enemy-1' },
    type: 'TownCenter',
  }

  assert.equal(getBuildingInteriorPortalId(ownTownCenter), 'player-1:town-center')
  assert.equal(getBuildingInteriorPortalId(enemyTownCenter), 'enemy-1:town-center')
  assert.notEqual(getBuildingInteriorPortalId(ownTownCenter), getBuildingInteriorPortalId(enemyTownCenter))
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
