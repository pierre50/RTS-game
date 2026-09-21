const { loadTsModule } = require('./loadTsModule.cjs')
const { buildingInterior } = require('../../tools/generate-interior-maps.cjs')
const config = require('../../public/assets/data/gameplay/buildings.json')
const { BUILDING_TYPES } = loadTsModule('app/constants/entities.ts')
const { ensureInteriorDefaultBuildings } = loadTsModule('engine/services/BuildingInteriorSpaceDecorations.ts', {
  mocks: {
    '../../app/constants': { BUILDING_TYPES },
    '../../constants': { BUILDING_TYPES },
    '../../app/lib/grid/placement': {
      canPlaceBuildingAt: (grid, i, j) => {
        const cell = grid[i]?.[j]
        return Boolean(cell && !cell.solid && !cell.has && !cell.border && !cell.terrainHidden)
      },
    },
  },
})

function furnishInterior(type) {
  const buildingSize = config[type].size
  const blueprint = buildingInterior({ buildingSize, size: buildingSize * 2 + 7, id: type, seed: 1 })
  const floor = Buffer.from(blueprint.floorMask, 'base64')
  const borders = Buffer.from(blueprint.borderMask, 'base64')
  const width = blueprint.size + 1
  const grid = Array.from({ length: width }, (_, i) =>
    Array.from({ length: width }, (_, j) => ({
      i,
      j,
      category: 'Dirt',
      has: null,
      border: Boolean(borders[i * width + j]),
      solid: !floor[i * width + j],
      terrainHidden: !floor[i * width + j],
    }))
  )
  const owner = {
    buildings: [],
    config: { buildings: config },
    createBuilding(options) {
      const building = { ...options, isDestroyed: false }
      this.buildings.push(building)
      const cell = grid[options.i][options.j]
      cell.has = building
      cell.solid = true
      return building
    },
  }
  const exit = blueprint.exits[0]
  const cells = grid.flat().filter(cell => !cell.border && !cell.solid)
  const space = {
    id: `interior:${type}`,
    size: blueprint.size,
    grid,
    entryCell: grid[exit.i][exit.j],
    exitCell: grid[exit.i][exit.j],
    walkableCells: cells,
    sleepCells: cells,
    building: { type, owner },
  }
  const context = { map: { randomItem: items => items[0] } }
  ensureInteriorDefaultBuildings(context, space)
  return { space, owner, context, blueprint }
}

module.exports = { furnishInterior, ensureInteriorDefaultBuildings }
