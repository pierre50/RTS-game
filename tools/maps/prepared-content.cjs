const { loadGenerationTs } = require('./load-generation-ts.cjs')
const { PASSABLE_RESOURCE_TYPES } = loadGenerationTs('app/constants/entities.ts')
const fs = require('node:fs')
const path = require('node:path')
const { randomFrom } = require('./noise.cjs')
const {
  animalGeneration,
  runtimeFormatCellsWaterBorder,
  runtimeFormatCellsRelief,
  runtimeFormatPatchBorders,
  runtimeFormatWaterOverlays,
} = require('./headless-loader.cjs')

function prepareContent(blueprint) {
  const appearance = new Map()
  const entry = cell => {
    const key = cell.i * (blueprint.size + 1) + cell.j
    if (!appearance.has(key)) appearance.set(key, { i: cell.i, j: cell.j })
    return appearance.get(key)
  }
  const grid = blueprint.terrain.map((row, i) =>
    row.map((type, j) => ({
      i,
      j,
      type,
      z: blueprint.relief[i][j],
      category: type === 'Water' ? 'Water' : 'Land',
      solid: false,
      has: null,
      border: false,
      waterBorder: false,
      inclined: false,
      setWaterBorder(sheet, frame) {
        this.waterBorder = this.border = true
        entry(this).water = [sheet, frame]
      },
      setReliefBorder(frame, elevation = 0) {
        this.inclined = true
        entry(this).relief = [frame, elevation]
      },
      setPatchBorder(direction, ground = 'Desert') {
        const data = entry(this)
        data.patches ??= []
        if (!data.patches.includes(direction)) data.patches.push(direction)
        data.ground = ground
      },
    }))
  )
  const map = { size: blueprint.size, grid, seed: blueprint.seed, addChild() {} }
  const scope = { map, rebuildTerrainBackfill() {} }
  runtimeFormatCellsWaterBorder.call(scope)
  runtimeFormatCellsRelief.call(scope)
  runtimeFormatPatchBorders.call(scope)
  runtimeFormatWaterOverlays.call(scope)
  for (const resource of blueprint.resources ?? []) {
    const cell = grid[resource.i]?.[resource.j]
    if (cell) {
      cell.has = resource
      cell.solid = !PASSABLE_RESOURCE_TYPES.has(resource.type)
    }
  }
  const random = randomFrom(`${blueprint.seed}:ambient-animals`)
  Object.assign(map, {
    random,
    randomRange: (min, max) => min + Math.floor(random() * (max - min + 1)),
    randomItem: list => list[Math.floor(random() * list.length)],
  })
  const animals = []
  const config = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../../public/assets/data/gameplay/animals.json'), 'utf8')
  )
  const safe = (i, j, radius) =>
    [...(blueprint.spawns ?? []), ...(blueprint.banditCampPositions ?? [])].some(
      pos => pos && (pos.i - i) ** 2 + (pos.j - j) ** 2 < radius ** 2
    )
  const nearby = (i, j, radius, predicate) => {
    for (let di = -radius; di <= radius; di++)
      for (let dj = -radius; dj <= radius; dj++) {
        if (Math.abs(di) + Math.abs(dj) <= radius && predicate(grid[i + di]?.[j + dj])) return true
      }
    return false
  }
  const water = (i, j) => nearby(i, j, 2, cell => cell?.category === 'Water' || cell?.waterBorder)
  const canPlace = (i, j) =>
    animalGeneration.canPlaceAmbientAnimalAt(map, i, j, {
      hasWaterNeighbor: () => water(i, j),
      isInPlayerStartSafeZone: radius => safe(i, j, radius),
    })
  animalGeneration.generateAmbientAnimalSets(map, {
    hasSolidNeighbor: (i, j) => nearby(i, j, 1, cell => cell?.solid),
    hasWaterNeighbor: water,
    pickType: (i, j) =>
      animalGeneration.pickAmbientAnimalType({
        animals: config,
        biome: blueprint.environment === 'Steppe' ? 'Steppe' : grid[i][j].type,
        random,
        isInPlayerStartSafeZone: radius => safe(i, j, radius),
      }),
    placeGroup: (i, j, type) =>
      animalGeneration.placeAmbientAnimalGroup(map, i, j, type, {
        canPlace,
        createAnimal: animal => {
          animals.push(animal)
          grid[animal.i][animal.j].has = animal
          grid[animal.i][animal.j].solid = true
        },
      }),
  })
  return { terrainAppearance: [...appearance.values()], animals }
}
module.exports = { prepareContent }
