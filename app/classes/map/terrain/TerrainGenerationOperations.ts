import { applyGroundPatch, applyLake, applyLakeShore } from './TerrainFeatures'
import { addGroundPatches, addLakes, initializeTerrain, smoothCoast } from './TerrainGenerationStages'
import {
  fbm,
  featureCount,
  hash,
  noise,
  normalizedShapeDistance,
  radialFalloff,
  randomInt,
  randomRange,
} from './TerrainNoise'
import {
  forceOuterWater,
  hasWaterWithin,
  isInteriorNonWaterTerrainCell,
  removeDisconnectedLand,
  collectLandComponent,
  terrainRow,
} from './TerrainTopology'

// The same explicit operations are used on the main thread and serialized into the worker.
export const terrainOperations = {
  hash,
  noise,
  fbm,
  radialFalloff,
  removeDisconnectedLand,
  collectLandComponent,
  terrainRow,
  forceOuterWater,
  featureCount,
  randomRange,
  randomInt,
  normalizedShapeDistance,
  isInteriorNonWaterTerrainCell,
  applyGroundPatch,
  applyLake,
  applyLakeShore,
  hasWaterWithin,
  initializeTerrain,
  smoothCoast,
  addLakes,
  addGroundPatches,
}
