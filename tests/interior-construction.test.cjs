const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const definitions = require('../public/assets/data/gameplay/buildings.json')
const placement = {
  ...loadTsModule('app/lib/grid/placement.ts'),
  ...loadTsModule('app/lib/grid/cells.ts'),
}
const reserved = new Set()
const mocks = {
  '../lib/buildings/walls': {},
  '../lib/audio/settings': {},
  '../lib': placement,
  '../../lib': placement,
  '../lib/buildings/passageCells': { createReservedPassageCellLookup: () => reserved },
  '../../lib/buildings/passageCells': { createReservedPassageCellLookup: () => reserved },
}
const { BuildingPlacementRules } = loadTsModule('app/controllers/BuildingPlacementRules.ts', { mocks })
const { buyPlayerBuilding } = loadTsModule('app/classes/players/PlayerBuildingPlacement.ts', { mocks })
const { getInventoryConstructionButtons } = loadTsModule('app/ui/InventoryConstruction.ts', {
  mocks: {
    './ActionDetailsFactory': {},
    '../lib/avatar': {},
    '../lib/audio/settings': {},
    './inventory/InventoryActionRow': {},
  },
})

function fixture() {
  reserved.clear()
  const id = 'interior:house'
  const grid = Array.from({ length: 5 }, (_, i) =>
    Array.from({ length: 5 }, (_, j) => ({
      i,
      j,
      z: 0,
      spaceId: id,
      visible: true,
      category: 'Dirt',
      border: i === 0 || j === 0 || i === 4 || j === 4,
      solid: false,
      has: null,
      terrainHidden: false,
    }))
  )
  const space = { id, kind: 'interior', grid, size: 4 }
  const map = { grid: [], spaces: new Map([[id, space]]), activeSpaceId: id }
  const player = {
    age: 0,
    isPlayed: true,
    config: { buildings: definitions },
    buildings: [],
    isBuildingEligible: () => true,
    spawnBuilding(building) {
      this.buildings.push(building)
    },
  }
  const controls = {
    heroUnit: { i: 2, j: 2, spaceId: id, isChief: true },
    isHeroControlActive: () => true,
  }
  const menu = { updateTopbar() {}, getActionBuildingButton: type => ({ id: type }) }
  const context = { map, player, controls, menu }
  player.context = controls.context = menu.context = context
  return { grid, space, player, controls, menu, rules: new BuildingPlacementRules(controls) }
}

for (const type of ['Chest', 'FireCamp', 'Trap']) {
  test(`${type} previews and places on every interior border, including corners`, () => {
    const { grid, player, controls, rules } = fixture()
    controls.mouseBuilding = { ...definitions[type], type }
    for (const [i, j] of [
      [0, 0],
      [0, 2],
      [0, 4],
      [2, 0],
      [2, 4],
      [4, 0],
      [4, 2],
      [4, 4],
    ]) {
      assert.equal(rules.canPlaceMouseBuilding(grid[i][j]), true, `${i},${j}`)
      assert.equal(buyPlayerBuilding(player, i, j, type, { spaceId: grid[i][j].spaceId }), true)
      assert.equal(player.buildings.at(-1).spaceId, grid[i][j].spaceId)
    }
  })
}

test('interior border placement still rejects obstacles, hidden floor, water, slopes and passages', () => {
  const { grid, player, controls, rules } = fixture()
  controls.mouseBuilding = { ...definitions.Chest, type: 'Chest' }
  const cell = grid[0][2]
  for (const patch of [
    { solid: true },
    { has: {} },
    { terrainHidden: true },
    { category: 'Water' },
    { inclined: true },
  ]) {
    const before = { ...cell }
    Object.assign(cell, patch)
    assert.equal(rules.canPlaceMouseBuilding(cell), false)
    assert.equal(buyPlayerBuilding(player, cell.i, cell.j, 'Chest', { spaceId: cell.spaceId }), false)
    Object.assign(cell, before)
  }
  reserved.add(cell)
  assert.equal(rules.canPlaceMouseBuilding(cell), false)
  assert.equal(buyPlayerBuilding(player, cell.i, cell.j, 'Chest', { spaceId: cell.spaceId }), false)
})

test('outside camp placement retains border and clearance restrictions', () => {
  const { grid, space, player, controls, rules } = fixture()
  space.kind = 'outside'
  controls.mouseBuilding = { ...definitions.Chest, type: 'Chest' }
  for (const cell of [grid[0][2], grid[3][3]]) {
    assert.equal(rules.canPlaceMouseBuilding(cell), false)
    assert.equal(buyPlayerBuilding(player, cell.i, cell.j, 'Chest', { spaceId: cell.spaceId }), false)
  }
})

test('construction menu shows only camp objects inside and restores buildings outside', () => {
  const { menu, controls } = fixture()
  assert.deepEqual(
    getInventoryConstructionButtons(menu)
      .map(button => button.id)
      .sort(),
    ['Chest', 'FireCamp', 'Trap']
  )
  controls.heroUnit.spaceId = 'outside'
  const outside = getInventoryConstructionButtons(menu).map(button => button.id)
  assert.ok(outside.includes('House'))
  assert.ok(outside.includes('TownCenter'))
  assert.ok(outside.includes('Chest'))
  assert.ok(!outside.includes('Cave'))
})
