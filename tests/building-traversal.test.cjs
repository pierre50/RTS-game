const test = require('node:test')
const assert = require('node:assert/strict')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { point, reliefMap } = require('./helpers/reliefFixture.cjs')
const config = require('../public/assets/data/gameplay/buildings.json')
const moduleCache = new Map()
const load = path => loadTsModule(path, { moduleCache })
const { getBuildingFootprintCells } = load('app/lib/grid/cells.ts')
const maths = load('app/lib/maths.ts')
const geometry = load('app/lib/graphics/isoFootprint.ts')
const polygon = load('app/lib/geometry/polygon.ts')
const { isInteriorFloorFurniture } = load('app/lib/buildings/interiorFurnitureCatalog.ts')
const mocks = {
  'pixi.js': {},
  '../../../lib': { ...maths, ...geometry, ...polygon },
  '../../lib': {
    getBuildingFootprintCells,
    getEntityMapSpace: building => building.context.map,
    clearCellTerrainSet() {},
  },
  '../../../lib/mapSpaces': {
    getEntitySpaceMapLike: (_unit, map) => map,
    sameMapSpace: (a, b) => a.spaceId === b.spaceId,
  },
  '../../../lib/units/unitControl': { isHeroControlled: () => true },
  './BuildingVisuals': {},
  './BuildingTrainingPreview': {},
}
const { occupyBuildingFootprint } = loadTsModule('app/classes/building/BuildingSetup.ts', { moduleCache, mocks })
const { getHeroDirectMoveBlockerAtPoint, blocksHeroDirectMoveWithRoundedFootprint } = loadTsModule(
  'app/classes/unit/movement/UnitHeroDirectMovementCollision.ts',
  { moduleCache, mocks }
)
const { getReliefLevelAtPoint } = load('app/lib/terrain/reliefSurface.ts')

function fixture(type) {
  const map = { ...reliefMap(() => 0), kind: 'interior' }
  for (const row of map.grid)
    for (const cell of row)
      Object.assign(cell, {
        has: null,
        solid: false,
        corpses: new Set(),
        updateVisible() {},
      })
  const building = {
    type,
    family: 'building',
    i: 4,
    j: 4,
    ...point(4, 4),
    size: config[type].size,
    isBuilt: true,
    context: { map },
  }
  occupyBuildingFootprint(building)
  const hero = { ...point(1, 1), context: { map } }
  return { map, building, hero }
}

for (const type of ['CampBedroll', 'CampRug', 'CampHide', 'CampFur', 'Farm']) {
  test(`${type} is traversable for both grid movement and hero collision`, () => {
    const { map, building, hero } = fixture(type)
    for (const cell of getBuildingFootprintCells(4, 4, map.grid, building.size, undefined, building.type)) {
      assert.equal(cell.solid, false)
      assert.equal(cell.has, building)
      assert.equal(getHeroDirectMoveBlockerAtPoint(hero, cell, cell.x, cell.y), null)
    }
    assert.equal(blocksHeroDirectMoveWithRoundedFootprint(building), false)
  })
}

for (const type of ['Chest', 'CampTable', 'House']) {
  test(`${type} still blocks both grid movement and the hero`, () => {
    const { map, building, hero } = fixture(type)
    const cell = map.grid[4][4]
    assert.equal(cell.solid, true)
    assert.equal(getHeroDirectMoveBlockerAtPoint(hero, cell, cell.x, cell.y), building)
    assert.equal(blocksHeroDirectMoveWithRoundedFootprint(building), true)
  })
}

test('hero approaches and crosses the whole bed from all four sides, retaining its walking height', () => {
  const { map, hero } = fixture('CampBedroll')
  assert.equal(isInteriorFloorFurniture('CampBedroll'), false)
  for (const axis of ['i', 'j'])
    for (const direction of [-1, 1]) {
      for (let step = 0; step <= 40; step++) {
        const coordinate = direction === 1 ? 3 + step / 10 : 7 - step / 10
        const i = axis === 'i' ? coordinate : 4.5
        const j = axis === 'j' ? coordinate : 4.5
        const position = point(i, j)
        const cell = map.grid[Math.round(i)][Math.round(j)]
        assert.equal(getHeroDirectMoveBlockerAtPoint(hero, cell, position.x, position.y), null)
        Object.assign(hero, position)
      }
    }
  assert.equal(getReliefLevelAtPoint(map, { x: -1, y: 116 }), 0.5)
  assert.equal(getReliefLevelAtPoint(map, point(3, 4.5)), 0)
})

test('bed occupancy follows the rear mattress without claiming empty floor in front', () => {
  const { map, building } = fixture('CampBedroll')
  const occupied = map.grid
    .flat()
    .filter(cell => cell.has === building)
    .map(cell => [cell.i, cell.j])
  assert.deepEqual(occupied, [
    [3, 3],
    [3, 4],
    [4, 3],
    [4, 4],
  ])
  assert.equal(map.grid[5][4].has, null)
  assert.equal(map.grid[4][5].has, null)
  assert.equal(map.grid[5][5].has, null)
})
