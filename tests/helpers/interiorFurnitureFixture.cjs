const { loadTsModule } = require('./loadTsModule.cjs')
const { buildingInterior } = require('../../tools/generate-interior-maps.cjs')
const config = require('../../public/assets/data/gameplay/buildings.json')
const constants = loadTsModule('app/constants/entities.ts')
const placement = loadTsModule('app/lib/grid/placement.ts')
const { getBuildingFootprintCells } = loadTsModule('app/lib/grid/cells.ts')
const { isBuildingTraversable } = loadTsModule('app/lib/buildings/buildingTraversal.ts')
const { ensureInteriorDefaultBuildings } = loadTsModule('engine/services/BuildingInteriorSpaceDecorations.ts', {
  mocks: {
    '../../app/constants': constants,
    '../../constants': constants,
    '../../app/lib/grid/placement': {
      canPlaceBuildingAt: (grid, i, j, config, options = {}) => {
        if (config.type === 'CampBedroll') return placement.canPlaceBuildingAt(grid, i, j, config, options)
        if (options.allowBorder) {
          const size = config.size ?? 1
          for (let x = i; x < i + size; x++)
            for (let y = j; y < j + size; y++) {
              const cell = grid[x]?.[y]
              if (!cell || cell.solid || cell.has || cell.terrainHidden || !options.canUseCell(cell)) return false
            }
          return true
        }
        const cell = grid[i]?.[j]
        return Boolean(cell && !cell.solid && !cell.has && !cell.border && !cell.terrainHidden)
      },
    },
  },
})

function furnishInterior(type, saved, placementMirrored = false, ownerOptions = {}, buildingOptions = {}) {
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
      border: Boolean(borders[placementMirrored ? j * width + i : i * width + j]),
      solid: !floor[placementMirrored ? j * width + i : i * width + j],
      terrainHidden: !floor[placementMirrored ? j * width + i : i * width + j],
    }))
  )
  const owner = {
    type: 'AI',
    ...ownerOptions,
    buildings: [],
    config: { buildings: config },
    createBuilding(options) {
      const building = { ...options, isDestroyed: false }
      this.buildings.push(building)
      const cells =
        options.type === 'CampBedroll'
          ? getBuildingFootprintCells(options.i, options.j, grid, config[options.type].size, undefined, options.type)
          : [grid[options.i][options.j]]
      for (const cell of cells) {
        cell.has = building
        cell.solid = !isBuildingTraversable(options.type)
      }
      return building
    },
  }
  const originalExit = blueprint.exits[0]
  const exit = placementMirrored ? { i: originalExit.j, j: originalExit.i } : originalExit
  const cells = grid.flat().filter(cell => !cell.border && !cell.solid)
  const space = {
    id: `interior:${type}`,
    size: blueprint.size,
    grid,
    entryCell: grid[exit.i][exit.j],
    exitCell: grid[exit.i][exit.j],
    walkableCells: cells,
    sleepCells: cells,
    building: { type, owner, interiorBuildings: saved, placementMirrored, ...buildingOptions },
  }
  const context = { map: { randomItem: items => items[0] } }
  ensureInteriorDefaultBuildings(context, space)
  return { space, owner, context, blueprint }
}

module.exports = { furnishInterior, ensureInteriorDefaultBuildings }
