const path = require('node:path')
const { ENVIRONMENT_TERRAIN_PARAMS, DEFAULT_ENVIRONMENT_ID, ROOT } = require('./config.cjs')
const {
  getCellsAroundPoint,
  getBuildingFootprintCells,
  getBuildingFootprintRadius,
  getPlainCellsAroundPoint,
  getZoneInGridWithCondition,
  hasWaterBorderWithin,
} = require('./grid.cjs')
const { getDeterministicCellVariant } = require('./noise.cjs')
const {
  EIGHT_NEIGHBOR_OFFSETS,
  getCyclicGroups,
  getNeighborFlags,
  getNeighborFlagsFromRing,
  getNeighborRing,
  getWaterBorderFrame,
  hasUnsupportedTransition,
} = require('./topology.cjs')

const RUNTIME_FILENAMES = new Set([
  'AmbientAnimalGeneration.ts',
  'MapSavedStateGeneration.ts',
  'MapTerrainAppearance.ts',
  'MapTerrainReliefAppearance.ts',
  'MapTerrainReliefContinuity.ts',
  'MapTerrainWaterTopology.ts',
  'MapTerrain.ts',
  'MapForestResources.ts',
  'MapResourceSpacing.ts',
  'ResourceQuantityRanges.ts',
  'TreeResourceTextures.ts',
  'MapResources.ts',
  'MapResourceCreation.ts',
  'MapResourcePlacement.ts',
  'MapNaturalResources.ts',
  'definedProperties.ts',
])
const isMapRuntime = filename => RUNTIME_FILENAMES.has(path.basename(filename))

class HeadlessContainer {
  constructor() {
    this.children = []
    this.parent = null
    this.position = { copyFrom() {} }
    this.anchor = { copyFrom() {}, set() {} }
  }
  addChild(child) {
    child.parent = this
    this.children.push(child)
    return child
  }
  removeChildren() {
    const children = this.children
    this.children = []
    for (const child of children) child.parent = null
    return children
  }
  destroy() {}
}

class HeadlessSprite extends HeadlessContainer {
  constructor(texture = null) {
    super()
    this.texture = texture
    this.roundPixels = false
  }
}

const pixi = { Assets: { cache: { get: () => ({}) } }, Sprite: HeadlessSprite, Container: HeadlessContainer }

class HeadlessResource {
  constructor(options, context) {
    Object.assign(this, options)
    this.context = context
    this.size = options.size ?? 1
    const cell = context.map.grid[this.i]?.[this.j]
    if (cell) {
      cell.has = this
      cell.solid = true
    }
  }
}

const constants = {
  ...require('./load-generation-ts.cjs').loadGenerationTs('app/constants/ambient.ts'),
  CELL_DEPTH: 1,
  RESOURCE_TYPES: {
    tree: 'Tree',
    berrybush: 'Berrybush',
    wheat: 'Wheat',
    medicinalHerb: 'MedicinalHerb',
    toxicHerb: 'ToxicHerb',
    fiberPlant: 'FiberPlant',
    stone: 'Stone',
    gold: 'Gold',
    copper: 'Copper',
    iron: 'Iron',
    salmon: 'Salmon',
  },
  SPACED_RESOURCE_TYPES: [
    'Berrybush',
    'Wheat',
    'MedicinalHerb',
    'ToxicHerb',
    'FiberPlant',
    'Stone',
    'Copper',
    'Iron',
    'Gold',
    'Tree',
  ],
  // Kept in sync with app/constants/ambient.ts: DarkForest/Jungle have no entry since
  // EnvironmentTerrainParams.groundTreeChance and macro terrain tree profiles
  // always override them.
  BIOME_TREE_CHANCE: {
    Grass: 0,
    Desert: 0,
  },
  BIOME_TREE_PLAYER_SAFE_DIST: 6,
  WATER_BORDER_PLACEMENT_CLEARANCE: 2,
  ENVIRONMENT_TERRAIN_PARAMS,
  DEFAULT_ENVIRONMENT_ID,
  getEnvironmentTerrainParams: environment =>
    ENVIRONMENT_TERRAIN_PARAMS[environment] ?? ENVIRONMENT_TERRAIN_PARAMS[DEFAULT_ENVIRONMENT_ID],
}

const RUNTIME_IMPORTS = new Map([
  ['./MapResourceCreation', 'app/classes/map/resources/MapResourceCreation.ts'],
  ['./MapResourcePlacement', 'app/classes/map/resources/MapResourcePlacement.ts'],
  ['./MapNaturalResources', 'app/classes/map/resources/MapNaturalResources.ts'],
  ['../../lib/definedProperties', 'app/lib/definedProperties.ts'],
  ['./generation/MapSavedStateGeneration', 'app/classes/map/generation/MapSavedStateGeneration.ts'],
  ['./MapTerrainAppearance', 'app/classes/map/terrain/MapTerrainAppearance.ts'],
  ['./terrain/MapTerrainAppearance', 'app/classes/map/terrain/MapTerrainAppearance.ts'],
  ['./MapTerrainReliefAppearance', 'app/classes/map/terrain/MapTerrainReliefAppearance.ts'],
  ['./MapTerrainReliefContinuity', 'app/classes/map/terrain/MapTerrainReliefContinuity.ts'],
  ['./MapTerrainWaterTopology', 'app/classes/map/terrain/MapTerrainWaterTopology.ts'],
  ['./MapForestResources', 'app/classes/map/resources/MapForestResources.ts'],
  ['./MapResourceSpacing', 'app/classes/map/resources/MapResourceSpacing.ts'],
  ['./ResourceQuantityRanges', 'app/classes/map/resources/ResourceQuantityRanges.ts'],
  ['./TreeResourceTextures', 'app/classes/map/resources/TreeResourceTextures.ts'],
])

function loadHeadlessImport(request, parent, isMain, originalLoad) {
  if (parent && isMapRuntime(parent.filename)) {
    request = request.replace(/^\.\.\/\.\.\/\.\.\//, '../../')
    const filename = RUNTIME_IMPORTS.get(request)
    if (filename) return originalLoad(path.join(ROOT, filename), parent, isMain)
    if (request === 'pixi.js') return pixi
    if (request === '../Resource' || request === '../../Resource') return { Resource: HeadlessResource }
    if (request === '../../lib') {
      return {
        getCellsAroundPoint,
        cartesianToIsometric: (i, j) => [(i - j) * 32, (i + j) * 16],
        getDeterministicCellVariant,
        getBuildingFootprintCells,
        getBuildingFootprintRadius,
        getPlainCellsAroundPoint,
        getTexture: () => null,
        getZoneInGridWithCondition,
        hasWaterBorderWithin,
      }
    }
    if (request === '../../lib/grid/queries') return { hasWaterBorderWithin }
    if (request === '../../lib/terrain/reliefAppearance') {
      const { loadGenerationTs } = require('./load-generation-ts.cjs')
      const { getReliefAppearance } = loadGenerationTs('app/lib/terrain/reliefAppearance.ts')
      const { CELL_DEPTH } = loadGenerationTs('app/constants/relief.ts')
      // Blueprints store fractions of a terrain level; runtime rendering uses pixels.
      return { getReliefAppearance: flags => {
        const appearance = getReliefAppearance(flags)
        return appearance && { ...appearance, elevation: appearance.elevation / CELL_DEPTH }
      } }
    }
    if (request === '../../constants') return constants
    if (request === '../../lib/terrain/topology') {
      return {
        EIGHT_NEIGHBOR_OFFSETS,
        getCyclicGroups,
        getNeighborFlags,
        getNeighborFlagsFromRing,
        getNeighborRing,
        getWaterBorderFrame,
        hasUnsupportedTransition,
      }
    }
    return {}
  }
  return originalLoad(request, parent, isMain)
}

function loadRuntimeGenerators() {
  const Module = require('node:module')
  const babel = require('@babel/core')
  const originalLoad = Module._load
  const originalExtension = require.extensions['.ts']
  Module._load = (request, parent, isMain) => loadHeadlessImport(request, parent, isMain, originalLoad)
  require.extensions['.ts'] = (module, filename) => {
    if (isMapRuntime(filename)) {
      const code = babel.transformFileSync(filename, {
        presets: [['@babel/preset-env', { targets: { node: 'current' } }], '@babel/preset-typescript'],
      }).code
      module._compile(code, filename)
      return
    }
    originalExtension(module, filename)
  }
  try {
    const { MapTerrain } = require(path.join(ROOT, 'app/classes/map/terrain/MapTerrain.ts'))
    const { MapResources } = require(path.join(ROOT, 'app/classes/map/resources/MapResources.ts'))
    const animalGeneration = require(path.join(ROOT, 'app/classes/map/generation/AmbientAnimalGeneration.ts'))
    return { MapTerrain, MapResources, animalGeneration }
  } finally {
    Module._load = originalLoad
    require.extensions['.ts'] = originalExtension
  }
}

const { MapTerrain, MapResources, animalGeneration } = loadRuntimeGenerators()

const runtimeRelief = MapTerrain.prototype.generateMapRelief

const runtimeClampReliefAroundWaterLevels = MapTerrain.prototype.clampReliefAroundWaterLevels

const runtimeEnforceReliefStepContinuity = MapTerrain.prototype.enforceReliefStepContinuity

const runtimeFormatCellsWaterBorder = MapTerrain.prototype.formatCellsWaterBorder

const runtimeFormatCellsRelief = MapTerrain.prototype.formatCellsRelief

const runtimeNeutralResources = MapResources.prototype.generateNeutralResourceGroupsAsync

const runtimeBiomeTrees = MapResources.prototype.generateBiomeTreesAsync

const runtimeGenerateForestAroundPlayer = MapResources.prototype.generateForestAroundPlayer

const runtimeFindNeutralResourceCenter = MapResources.prototype.findNeutralResourceCenter

const runtimePlaceResourceGroupAt = MapResources.prototype.placeResourceGroupAt

const runtimeGetSharedGroupTextureName = MapResources.prototype.getSharedGroupTextureName

const runtimePickTreeTextureName = MapResources.prototype.pickTreeTextureName

const runtimeGenerateScatteredStone = MapResources.prototype.generateScatteredStoneAsync

const runtimeGenerateScatteredHerbs = MapResources.prototype.generateScatteredHerbsAsync

module.exports = {
  animalGeneration,
  runtimeFormatPatchBorders: MapTerrain.prototype.formatCellsPatchBorders,
  runtimeFormatWaterOverlays: MapTerrain.prototype.formatCellsWaterBorderOverlays,
  runtimeFillWaterGaps: MapTerrain.prototype.fillWaterGaps,
  runtimeNormalizeWaterTopology: MapTerrain.prototype.normalizeWaterTopology,
  runtimeGetSharedGroupTextureName,
  runtimePickTreeTextureName,
  runtimeGenerateScatteredStone,
  runtimeGenerateScatteredHerbs,
  runtimeClampReliefAroundWaterLevels,
  runtimeEnforceReliefStepContinuity,
  runtimeFormatCellsWaterBorder,
  runtimeFormatCellsRelief,
  runtimeGenerateForestAroundPlayer,
  runtimeFindNeutralResourceCenter,
  runtimePlaceResourceGroupAt,
  runtimeRelief,
  runtimeNeutralResources,
  runtimeBiomeTrees,
}
