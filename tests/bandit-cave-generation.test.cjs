const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const catalog = require('../public/maps/interiors/cave/catalog.json')
const { decodeInteriorPayload } = loadTsModule('app/serialization/InteriorBlueprintLoader.ts')
const types = {
  chest: 'Chest',
  fireCamp: 'FireCamp',
  campCrate: 'CampCrate',
  campMeatRack: 'CampMeatRack',
  campJarLarge: 'CampJarLarge',
  campAnimalBones: 'CampAnimalBones',
}

for (const payload of catalog.blueprints) {
  test(`bandit lair ${payload.id} keeps passages open and stores its chest in the cave`, () => {
    const blueprint = decodeInteriorPayload(
      payload,
      { blueprint: { id: payload.id, size: payload.size, path: payload.id } },
      'Cave'
    )
    const grid = blueprint.terrain.map((row, i) =>
      row.map((category, j) => ({
        i,
        j,
        category,
        border: Boolean(blueprint.borderMask?.[i]?.[j]) && !blueprint.exits.some(exit => exit.i === i && exit.j === j),
        terrainHidden: !blueprint.floorMask?.[i]?.[j],
        solid: false,
        has: null,
      }))
    )
    const cells = grid.flat().filter(cell => !cell.terrainHidden && !cell.border && cell.category !== 'Water')
    const space = { id: 'interior:gaia:cave', grid, walkableCells: cells, entryCell: blueprint.exits[0] }
    const owner = {
      buildings: [],
      config: { buildings: Object.fromEntries(Object.values(types).map(type => [type, { size: 1 }])) },
      createBuilding(options) {
        this.buildings.push(options)
        const cell = grid[options.i][options.j]
        cell.has = options
        cell.solid = true
        return options
      },
    }
    const cave = { owner: { buildings: [] }, cave: { id: payload.id } }
    const { furnishBanditCave } = loadTsModule('app/classes/map/BanditCaveGeneration.ts', {
      mocks: {
        '../../../engine/services/BuildingInteriorSpaceSystemRuntime': {
          ensureRuntimeBuildingInteriorSpace: () => space,
        },
        '../../constants': { BUILDING_TYPES: types },
      },
    })
    const inventory = { resources: { gold: 9 }, equipment: ['bow'] }
    furnishBanditCave({}, cave, 0, owner, inventory)
    const chest = owner.buildings.find(item => item.type === 'Chest')
    assert.ok(chest)
    assert.equal(chest.spaceId, space.id)
    assert.deepEqual(chest.inventory, inventory)
    assert.ok(owner.buildings.length >= 3)
    const count = owner.buildings.length
    furnishBanditCave({}, cave, 0, owner, inventory)
    assert.equal(owner.buildings.length, count)
    assert.ok(owner.buildings.every(item => item.spaceId === space.id))
  })
}
