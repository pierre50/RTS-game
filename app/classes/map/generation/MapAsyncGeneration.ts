import { getIdealSpawnRangeForMapSize } from '../../../config/mapSizes'
import { createSpawnSearchCell } from './AmbientAnimalGeneration'
import type { GenerateMapOptions, MapGenerationMap, TerrainGrid, TerrainValue } from '../MapGenerationTypes'

type MapAsyncGenerationCallbacks = {
  destroyGeneratedChildren(): void
  generateCellsAsync(options?: GenerateMapOptions): Promise<void>
  generateTerrainDataAsync(): Promise<TerrainGrid>
  yieldToBrowser(): Promise<void>
}

export async function generateMapAsync(
  map: MapGenerationMap,
  callbacks: MapAsyncGenerationCallbacks,
  positionsCountOverride: number | null = null,
  repeat: number = 0,
  options: GenerateMapOptions = {}
): Promise<void> {
  callbacks.destroyGeneratedChildren()
  if (!Number.isFinite(map.seed)) map.seed = Math.random() * 9999
  map.resetRandom('ideal-spawns')
  const [minIdealSpawns, maxIdealSpawns] = getIdealSpawnRangeForMapSize(map.size)
  map.positionsCount =
    positionsCountOverride ??
    map.randomRange(Math.min(minIdealSpawns, maxIdealSpawns), Math.max(minIdealSpawns, maxIdealSpawns))

  const terrain = await callbacks.generateTerrainDataAsync()
  map.size = terrain.length - 1
  map.grid = terrain.map((row: TerrainValue[], i: number) =>
    row.map((terrainType: TerrainValue, j: number) => createSpawnSearchCell(i, j, terrainType))
  )

  if (!(await findValidSpawnSeed(map, callbacks, repeat))) {
    map.grid = []
    alert('Error while generating the map')
    return
  }

  await callbacks.generateCellsAsync({ ...options, terrain })
}

async function findValidSpawnSeed(
  map: MapGenerationMap,
  callbacks: Pick<MapAsyncGenerationCallbacks, 'yieldToBrowser'>,
  repeat: number
): Promise<boolean> {
  for (let attempt = repeat; attempt <= 10; attempt++) {
    map.resetRandom(attempt)
    map.playersPos = map.findPlayerPlaces()
    if (map.playersPos.length >= map.positionsCount) {
      map.resetRandom(attempt)
      return true
    }
    await callbacks.yieldToBrowser()
  }
  return false
}
