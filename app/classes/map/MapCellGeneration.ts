import { getEnvironmentTerrainParams } from '../../constants'
import { Cell, GenerationCell } from '../cell'
import { generateTerrainMap } from './MapTerrainGeneration'
import type { GameContextLike } from '../../types/context'
import type { RuntimeCell } from '../../types/map'
import type { EnvironmentTerrainParams } from '../../constants'
import type {
  GenerateMapOptions,
  MapGenerationMap,
  TerrainGrid,
  TerrainValue,
} from './MapGenerationTypes'

const TERRAIN_TYPES: Record<TerrainValue, string> = {
  0: 'Grass',
  1: 'Desert',
  2: 'Water',
  3: 'Jungle',
  4: 'DarkForest',
  5: 'Dirt',
  7: 'Snow',
}

type YieldToBrowser = () => Promise<void>

function runtimeContext(map: MapGenerationMap): GameContextLike {
  const { context } = map
  if (!context.app || !context.gamebox || !context.map || !context.scheduler) {
    throw new Error('Map generation requires a runtime context')
  }
  return context as GameContextLike
}

export function generateTerrain(
  map: MapGenerationMap,
  gridSize: number = 120,
  seed?: number,
  params: Partial<EnvironmentTerrainParams> = {}
): TerrainGrid {
  const { seed: resolvedSeed, terrain } = generateTerrainMap(gridSize, seed, params)
  map.seed = resolvedSeed
  return terrain
}

export function generateTerrainInWorker(
  map: MapGenerationMap,
  gridSize: number,
  seed: number,
  params: Partial<EnvironmentTerrainParams> = {}
): Promise<TerrainGrid> {
  if (typeof Worker === 'undefined') {
    return Promise.resolve(generateTerrain(map, gridSize, seed, params))
  }
  const source = generateTerrainMap.toString()
  const functionSource = source.startsWith('function') ? `(${source})` : `(function ${source})`
  const workerSource = `
    const generateTerrain = ${functionSource};
    self.onmessage = ({ data }) => {
      try {
        self.postMessage(generateTerrain(data.gridSize, data.seed, data.params));
      } catch (error) {
        self.postMessage({ error: error?.stack || error?.message || String(error) });
      }
    };
  `
  const url = URL.createObjectURL(new Blob([workerSource], { type: 'text/javascript' }))
  return new Promise((resolve, reject) => {
    const worker = new Worker(url)
    const cleanup = () => {
      worker.terminate()
      URL.revokeObjectURL(url)
    }
    worker.onmessage = ({ data }) => {
      cleanup()
      if (data.error) {
        reject(new Error(data.error))
        return
      }
      map.seed = data.seed
      resolve(data.terrain)
    }
    worker.onerror = error => {
      cleanup()
      reject(error)
    }
    worker.postMessage({
      gridSize,
      seed,
      positionsCount: map.positionsCount,
      params,
    })
  })
}

export function generateCells(map: MapGenerationMap): void {
  const context = runtimeContext(map)
  const z = 0
  map.grid = []
  map.invalidateReliefCoastDistances()
  const terrain = generateTerrain(
    map,
    map.size ? map.size + 1 : 121,
    map.seed == null ? undefined : Number(map.seed),
    getEnvironmentTerrainParams(map.environment)
  )
  map.size = terrain.length - 1

  for (let i = 0; i <= map.size; i++) {
    if (!map.grid[i]) map.grid[i] = []
    for (let j = 0; j <= map.size; j++) {
      const type = TERRAIN_TYPES[terrain[i][j]]
      const cell = new Cell({ i, j, z, type }, context)
      map.addChild(cell)
      map.grid[i][j] = cell
    }
  }

  map.fillWaterGaps()
  map.normalizeWaterTopology()
  map.formatCellsWaterBorder()
}

export async function generateTerrainDataAsync(
  map: MapGenerationMap,
  generateTerrainInWorkerFn: (
    gridSize: number,
    seed: number,
    params?: Partial<EnvironmentTerrainParams>
  ) => Promise<TerrainGrid>
): Promise<TerrainGrid> {
  const terrainStartedAt = performance.now()
  const gridSize = map.size ? map.size + 1 : 121
  const seed = map.seed == null ? Math.random() * 9999 : Number(map.seed)
  const params = getEnvironmentTerrainParams(map.environment)
  let terrain: TerrainGrid
  try {
    terrain = await generateTerrainInWorkerFn(gridSize, seed, params)
  } catch (error) {
    console.warn('Terrain worker unavailable, falling back to main thread', error)
    terrain = generateTerrain(map, gridSize, seed, params)
  }
  map.context.performance?.record('terrainData', performance.now() - terrainStartedAt)
  return terrain
}

export async function generateCellsAsync(
  map: MapGenerationMap,
  yieldToBrowser: YieldToBrowser,
  generateTerrainData: () => Promise<TerrainGrid>,
  { onProgress = async (_stage: string, _progress: number) => {}, terrain: preparedTerrain = null }: GenerateMapOptions = {}
): Promise<void> {
  const context = runtimeContext(map)
  const z = 0
  map.grid = []
  map.invalidateReliefCoastDistances()
  const terrain: TerrainGrid = preparedTerrain || (await generateTerrainData())
  map.size = terrain.length - 1

  const startedAt = performance.now()
  for (let i = 0; i <= map.size; i++) {
    const row: RuntimeCell[] = []
    map.grid[i] = row
    for (let j = 0; j <= map.size; j++) {
      const cell = new GenerationCell({ i, j, z, type: TERRAIN_TYPES[terrain[i][j]] }, context)
      row[j] = cell
    }
    if (i % 8 === 0) {
      await onProgress('loadingPregeneratedMap', 0.03 + (i / map.size) * 0.14)
      await yieldToBrowser()
    }
  }
  map.context.performance?.record('cellCreation', performance.now() - startedAt)

  map.fillWaterGaps()
  await yieldToBrowser()
  map.normalizeWaterTopology()
  await yieldToBrowser()
  map.formatCellsWaterBorder()
}
