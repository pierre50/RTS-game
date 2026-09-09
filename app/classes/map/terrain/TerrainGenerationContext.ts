import type { EnvironmentTerrainParams } from '../../../constants'
import type { TerrainGrid } from '../MapGenerationTypes'
import type { terrainOperations } from './TerrainGenerationOperations'

export type TerrainContext = typeof terrainOperations & {
  resolvedSeed: number
  gridSize: number
  params: Partial<EnvironmentTerrainParams>
  terrainMap: TerrainGrid
  groundTypeValue: TerrainGrid[number][number]
  borderWaterWidth: number
  terrainValueByType: Record<
    'Grass' | 'Desert' | 'Jungle' | 'DarkForest' | 'Dirt' | 'Snow',
    TerrainGrid[number][number]
  >
  scale: number
  half: number
  falloffPlateau: number
}
