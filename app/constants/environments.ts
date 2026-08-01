// One generated map now represents a single coherent environment. Decorative
// patchwork and lake/oasis shapes stay small and controlled per environment.
export type EnvironmentId = 'Temperate' | 'BlackForest' | 'Jungle' | 'Desert'

export const DEFAULT_ENVIRONMENT_ID: EnvironmentId = 'Temperate'

export const ENVIRONMENT_IDS: EnvironmentId[] = ['Temperate', 'BlackForest', 'Jungle', 'Desert']

export interface EnvironmentTerrainParams {
  // The single ground type covering this environment's non-water land. Each environment
  // is exactly one type — there's nothing to classify, so this is a plain literal rather
  // than noise thresholds; the small patchwork/lake shapes below introduce the only
  // alternate ground (Dirt or, for Desert, Jungle oasis rings).
  groundType: 'Grass' | 'Desert' | 'Jungle' | 'DarkForest'
  // Ground patches use small predefined shapes, never broad biome blobs. Temperate,
  // BlackForest and Jungle use Dirt; Desert uses Jungle so the patch reads as grass and
  // can receive palm-tree resources.
  patchwork: {
    count: number
    minRadius: number
    maxRadius: number
    terrainType: 'Jungle' | 'Dirt'
  }
  // Lakes are carved from rounded-but-irregular predefined shapes. Desert lakes get a
  // Jungle shore to create oasis rings; other environments get Dirt shores.
  lakes: {
    count: number
    minRadius: number
    maxRadius: number
    shoreRadius: number
    shoreType: 'Jungle' | 'Dirt' | null
  }
  // Multiplier on relief band levels — lower reads as flatter terrain (e.g. Desert dunes).
  reliefAmplitude: number
  // Multiplier on the biome-agnostic tree sources (the per-player starting forest cluster
  // and neutral tree resource groups) that ignore cell.type when placing trees. Since each
  // environment is now single-type ground, these can no longer place a wrong-sprite tree —
  // this is purely a density knob (e.g. Desert's "peu de foret").
  forestDensity: number
  // Ambient tree chance for this environment's one non-Grass/non-Desert forest cell type
  // (DarkForest for BlackForest, Jungle for Jungle and for Desert's oasis rings) — null means
  // "no such cell type exists here" (Temperate, plain Desert ground). A single field is
  // enough because an environment's ground is always single-type: it never needs to tell
  // DarkForest and Jungle apart. Overrides BIOME_TREE_CHANCE, whose 0.92 was tuned for that
  // type being a small patch on the old mixed-biome map — at 100% environment coverage that
  // density leaves virtually no walkable gaps, so this is kept well under the ~0.59
  // site-percolation threshold.
  forestCellTreeChance: number | null
}

export const ENVIRONMENT_TERRAIN_PARAMS: Record<EnvironmentId, EnvironmentTerrainParams> = {
  // Beaucoup d'herbe, des forets, quelques lacs et petites zones de terre.
  Temperate: {
    groundType: 'Grass',
    patchwork: { count: 18, minRadius: 1.6, maxRadius: 3.4, terrainType: 'Dirt' },
    lakes: { count: 2, minRadius: 3.8, maxRadius: 7.2, shoreRadius: 2.5, shoreType: null },
    reliefAmplitude: 1,
    forestDensity: 0.2,
    forestCellTreeChance: null,
  },
  // Beaucoup de foret (noire), quelques lacs et petites zones de terre.
  BlackForest: {
    groundType: 'DarkForest',
    patchwork: { count: 14, minRadius: 1.5, maxRadius: 3.0, terrainType: 'Dirt' },
    lakes: { count: 2, minRadius: 3.6, maxRadius: 6.8, shoreRadius: 2.2, shoreType: null },
    reliefAmplitude: 1,
    forestDensity: 0.3,
    forestCellTreeChance: 0.1,
  },
  // Beaucoup de foret palmier, quelques lacs et petites zones de terre.
  Jungle: {
    groundType: 'Jungle',
    patchwork: { count: 14, minRadius: 1.5, maxRadius: 3.1, terrainType: 'Dirt' },
    lakes: { count: 2, minRadius: 3.6, maxRadius: 6.8, shoreRadius: 2.2, shoreType: null },
    reliefAmplitude: 1,
    forestDensity: 0.3,
    forestCellTreeChance: 0.1,
  },
  // Peu de foret, sol en desert, quelques points d'eau (oasis: herbe + arbres palmier autour),
  // peu de relief. Pure Desert + oasis Jungle rings — both the Desert and Jungle tree assets
  // are the palm sprite, so it never mixes with Grass/DarkForest either.
  Desert: {
    groundType: 'Desert',
    patchwork: { count: 12, minRadius: 1.8, maxRadius: 3.6, terrainType: 'Jungle' },
    lakes: { count: 2, minRadius: 4.2, maxRadius: 8.0, shoreRadius: 4.0, shoreType: 'Jungle' },
    reliefAmplitude: 0.3,
    forestDensity: 0.1,
    // Applies to the oasis Jungle rings — much sparser than a full Jungle environment.
    forestCellTreeChance: null,
  },
}

export function getEnvironmentTerrainParams(environment?: string | null): EnvironmentTerrainParams {
  return ENVIRONMENT_TERRAIN_PARAMS[environment as EnvironmentId] ?? ENVIRONMENT_TERRAIN_PARAMS[DEFAULT_ENVIRONMENT_ID]
}
