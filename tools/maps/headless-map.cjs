const {
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
} = require('./headless-loader.cjs')
const { TERRAIN, DEFAULT_ENVIRONMENT_ID, RELIEF_WATER_BUFFER_RADIUS } = require('./config.cjs')
const { randomFrom } = require('./noise.cjs')
const { compactPositions } = require('./grid.cjs')

function createResourceScope(map) {
  const resourcesScope = {
    map,
    getSharedGroupTextureName: (...args) => runtimeGetSharedGroupTextureName.apply(resourcesScope, args),
    pickTreeTextureName: (...args) => runtimePickTreeTextureName.apply(resourcesScope, args),
    generateScatteredStoneAsync: (...args) => runtimeGenerateScatteredStone.apply(resourcesScope, args),
    generateScatteredHerbsAsync: (...args) => runtimeGenerateScatteredHerbs.apply(resourcesScope, args),
  }
  return resourcesScope
}

function coastDistances(map) {
  const n = map.size + 1
  const distances = new Int16Array(n * n).fill(9999)
  const queue = []
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      if (map.grid[i][j].category === 'Water') {
        const index = i * n + j
        distances[index] = 0
        queue.push(index)
      }
    }
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const index = queue[cursor],
      i = Math.floor(index / n),
      j = index % n
    for (const [di, dj] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ]) {
      const ni = i + di,
        nj = j + dj
      if (ni < 0 || ni >= n || nj < 0 || nj >= n) continue
      const next = ni * n + nj
      if (distances[next] > distances[index] + 1) {
        distances[next] = distances[index] + 1
        queue.push(next)
      }
    }
  }
  return distances
}

function populateHeadlessGrid(map, terrain, size) {
  for (let i = 0; i <= size; i++) {
    map.grid[i] = []
    for (let j = 0; j <= size; j++) {
      const type = TERRAIN[terrain[i][j]]
      map.grid[i][j] = {
        i,
        j,
        type,
        category: type === 'Water' ? 'Water' : 'Land',
        z: 0,
        y: 0,
        has: null,
        waterBorder: false,
        border: false,
        solid: false,
        inclined: false,
        setWaterBorder(resourceName, index) {
          this.border = true
          this.waterBorder = true
          this.solid = false
          this.waterBorderResourceName = resourceName
          this.waterBorderIndex = index
        },
        setReliefBorder() {
          this.inclined = true
        },
      }
    }
  }
}

function buildHeadlessMap(
  terrain,
  size,
  seed,
  playersPos,
  positionsCount = playersPos.length,
  environment = DEFAULT_ENVIRONMENT_ID,
  protectedPositions = playersPos
) {
  const map = {
    size,
    seed,
    playersPos,
    mapType: 'continent',
    environment,
    positionsCount,
    resourceDensity: 'moderate',
    grid: [],
    resources: new Set(),
    _coastDistances: null,
    random: randomFrom(`${seed}:0`),
  }
  populateHeadlessGrid(map, terrain, size)
  map.getReliefCoastDistances = () => map._coastDistances || (map._coastDistances = coastDistances(map))
  map.getMaxReliefLevelFromCoastDistance = distance => Math.max(0, distance - RELIEF_WATER_BUFFER_RADIUS)
  map.getMinReliefLevelFromCoastDistance = distance => -map.getMaxReliefLevelFromCoastDistance(distance)
  map.setCellReliefLevelDirect = (cell, level) => {
    cell.z = level
  }
  map.clampReliefAroundWater = dist => {
    for (let i = 0; i <= size; i++)
      for (let j = 0; j <= size; j++) {
        const cell = map.grid[i][j]
        if (cell.category === 'Water') continue
        const max = map.getMaxReliefLevelFromCoastDistance(dist[i * (size + 1) + j])
        cell.z = Math.max(-max, Math.min(max, cell.z))
      }
  }
  map.flattenPlayerStartZones = () => {
    for (const pos of compactPositions(protectedPositions)) {
      for (let i = Math.max(0, pos.i - 6); i <= Math.min(size, pos.i + 6); i++) {
        for (let j = Math.max(0, pos.j - 6); j <= Math.min(size, pos.j + 6); j++) {
          if (map.grid[i][j].category !== 'Water') map.grid[i][j].z = 0
        }
      }
    }
  }
  map.clampReliefAroundWaterLevels = () => runtimeClampReliefAroundWaterLevels.call({ map })
  map.enforceReliefStepContinuity = (...args) => runtimeEnforceReliefStepContinuity.apply({ map }, args)
  map.formatCellsWaterBorder = () => runtimeFormatCellsWaterBorder.call({ map })
  // Mirrors MapTerrain#rebuildTerrainAppearance: sprite backfill is purely visual and
  // has no headless equivalent, so it's stubbed out - only the border/inclined flags matter here.
  map.formatCellsRelief = () => runtimeFormatCellsRelief.call({ map, rebuildTerrainBackfill() {} })
  map.addChild = instance => instance
  map.randomRange = (min, max) => Math.floor(map.random() * (max - min + 1) + min)
  map.randomItem = (items = []) => items[Math.floor(map.random() * items.length)]
  map.context = { map }
  const resourcesScope = createResourceScope(map)
  map.generateForestAroundPlayer = (...args) => runtimeGenerateForestAroundPlayer.apply(resourcesScope, args)
  map.findNeutralResourceCenter = (...args) => runtimeFindNeutralResourceCenter.apply(resourcesScope, args)
  map.placeResourceGroupAt = (...args) => runtimePlaceResourceGroupAt.apply(resourcesScope, args)
  map.generateScatteredStoneAsync = (...args) => runtimeGenerateScatteredStone.apply(resourcesScope, args)
  map.generateScatteredHerbsAsync = (...args) => runtimeGenerateScatteredHerbs.apply(resourcesScope, args)
  return map
}

module.exports = { coastDistances, buildHeadlessMap, createResourceScope }
