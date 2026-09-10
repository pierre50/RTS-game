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
const unitTypes = { villager: 'Villager' }

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
    const neutralOwner = {
      units: [],
      population: 0,
      createUnit(options) {
        this.units.push(options)
        const cell = grid[options.i][options.j]
        cell.has = options
        cell.solid = true
        return options
      },
    }
    const { furnishBanditCave } = loadTsModule('app/classes/map/BanditCaveGeneration.ts', {
      mocks: {
        '../../../engine/services/BuildingInteriorSpaceSystemRuntime': {
          ensureRuntimeBuildingInteriorSpace: () => space,
        },
        '../../constants': { BUILDING_TYPES: types, UNIT_TYPES: unitTypes },
        '../players': {
          ensureNeutralPlayer: () => neutralOwner,
        },
      },
    })
    const inventory = { resources: { gold: 9 }, equipment: ['bow'] }
    const context = { players: [owner, neutralOwner], map: { randomRange: () => 3 } }
    owner.units = []
    furnishBanditCave(context, cave, 0, owner, inventory)
    const chest = owner.buildings.find(item => item.type === 'Chest')
    assert.ok(chest)
    assert.equal(chest.spaceId, space.id)
    assert.deepEqual(chest.inventory, inventory)
    assert.ok(owner.buildings.length >= 3)
    assert.ok(neutralOwner.units.length >= 1)
    assert.ok(neutralOwner.units.length <= 3)
    assert.ok(neutralOwner.units.every(unit => unit.type === 'Villager' && unit.spaceId === space.id))
    assert.equal(new Set(neutralOwner.units.map(unit => unit.assetCiv)).size, neutralOwner.units.length)
    assert.ok(neutralOwner.units.every(unit => typeof unit.assetCiv === 'string'))
    const count = owner.buildings.length
    const neutralCount = neutralOwner.units.length
    assert.equal(neutralOwner.population, neutralCount)
    furnishBanditCave(context, cave, 0, owner, inventory)
    assert.equal(owner.buildings.length, count)
    assert.equal(neutralOwner.units.length, neutralCount)
    assert.ok(owner.buildings.every(item => item.spaceId === space.id))
    for (const unit of neutralOwner.units) {
      grid[unit.i][unit.j].has = null
      grid[unit.i][unit.j].solid = false
    }
    neutralOwner.units = []
    furnishBanditCave(context, cave, 0, owner, inventory)
    assert.equal(neutralOwner.units.length, 0, 'recruited prisoners must not respawn')
    assert.equal(JSON.parse(JSON.stringify(cave.cave)).neutralVillagersGenerated, true)
  })
}
