import type { EnvironmentTerrainParams } from '../../../constants'
import type { TerrainGrid } from '../MapGenerationTypes'
import type { TerrainContext } from './TerrainGenerationContext'
import { terrainOperations } from './TerrainGenerationOperations'

export type GeneratedTerrainData = { seed: number; terrain: TerrainGrid }

function runTerrainGeneration(
  gridSize: number,
  seed: number | undefined,
  params: Partial<EnvironmentTerrainParams>,
  operations: typeof terrainOperations
): GeneratedTerrainData {
  const terrainValueByType = { Grass: 0, Desert: 1, Jungle: 3, DarkForest: 4, Dirt: 5, Snow: 7 } as const
  const context: TerrainContext = Object.assign(
    {
      resolvedSeed: seed == null ? Math.random() * 9999 : seed,
      gridSize,
      params,
      terrainMap: [],
      groundTypeValue: terrainValueByType[params.groundType ?? 'Grass'],
      terrainValueByType,
      borderWaterWidth: Math.max(4, Math.floor(gridSize * 0.04)),
      scale: 4 / gridSize,
      half: gridSize / 2,
      falloffPlateau: 0.85,
    },
    operations
  )
  context.initializeTerrain()
  context.smoothCoast()
  context.removeDisconnectedLand()
  context.addLakes()
  context.addGroundPatches()
  context.forceOuterWater()
  return { seed: context.resolvedSeed, terrain: context.terrainMap }
}

export function generateTerrainMap(
  gridSize: number = 120,
  seed?: number,
  params: Partial<EnvironmentTerrainParams> = {}
): GeneratedTerrainData {
  return runTerrainGeneration(gridSize, seed, params, terrainOperations)
}

export function createTerrainWorkerSource(): string {
  const operations = Object.entries(terrainOperations)
    .map(([name, operation]) => JSON.stringify(name) + ': (' + operation.toString() + ')')
    .join(',')
  return `const operations = {${operations}};
 const generate = (${runTerrainGeneration.toString()});
 self.onmessage = ({data}) => {
 try { self.postMessage(generate(data.gridSize, data.seed, data.params, operations)); }
 catch (error) { self.postMessage({error: error?.stack || error?.message || String(error)}); }
 };`
}
