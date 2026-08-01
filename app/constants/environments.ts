// One generated map now represents a single coherent environment instead of a
// patchwork of biomes. Each environment reshapes the same noise-driven terrain
// algorithm (see MapGeneration#generateTerrain) via these thresholds, rather
// than introducing new ground types.
export type EnvironmentId = 'Temperate' | 'BlackForest' | 'Jungle' | 'Desert'

export const DEFAULT_ENVIRONMENT_ID: EnvironmentId = 'Temperate'

export const ENVIRONMENT_IDS: EnvironmentId[] = ['Temperate', 'BlackForest', 'Jungle', 'Desert']

export interface EnvironmentTerrainParams {
  // Biome-noise cutoffs classifying land cells (see generateTerrain): a cell becomes
  // Desert when the noise value is below `desertThreshold`, Jungle when above
  // `jungleThreshold`, else Grass. Values outside [0, 1] (-1 / 2) disable a bucket
  // entirely, or force it to always win, since the underlying noise field never
  // leaves [0, 1]. Each environment is strictly single-type ground (plus Desert's
  // oasis carve) — no cross-environment mixing, so a tree's sprite (picked from the
  // cell it stands on, see resources.json) can never read as the wrong environment.
  desertThreshold: number
  jungleThreshold: number
  // Independent noise overlay turning non-Desert land into DarkForest above this cutoff.
  darkForestThreshold: number
  waterThreshold: number
  // Radius (cells) of the Jungle ring forced around interior ponds; 0 disables oasis carving.
  oasisRadius: number
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
  // Beaucoup d'herbe, des forets, quelques points d'eau. Pure Grass — trees are always the
  // plain sprite, never mixed with DarkForest's pine sprite.
  Temperate: {
    desertThreshold: -1,
    jungleThreshold: 2,
    darkForestThreshold: 2,
    waterThreshold: 0.28,
    oasisRadius: 0,
    reliefAmplitude: 1,
    forestDensity: 1,
    forestCellTreeChance: null,
  },
  // Beaucoup de foret (noire), quelques points d'eau. Pure DarkForest — trees are always the
  // pine sprite, never mixed with Grass's plain sprite.
  BlackForest: {
    desertThreshold: -1,
    jungleThreshold: 2,
    darkForestThreshold: -1,
    waterThreshold: 0.28,
    oasisRadius: 0,
    reliefAmplitude: 1,
    forestDensity: 0.5,
    forestCellTreeChance: 0.35,
  },
  // Beaucoup de foret palmier, quelques points d'eau. Pure Jungle — trees are always the
  // palm sprite, never mixed with Grass's plain sprite.
  Jungle: {
    desertThreshold: -1,
    jungleThreshold: -1,
    darkForestThreshold: 2,
    waterThreshold: 0.28,
    oasisRadius: 0,
    reliefAmplitude: 1,
    forestDensity: 0.5,
    forestCellTreeChance: 0.35,
  },
  // Peu de foret, sol en desert, quelques points d'eau (oasis: herbe + arbres palmier autour),
  // peu de relief. Pure Desert + oasis Jungle rings — both the Desert and Jungle tree assets
  // are the palm sprite, so it never mixes with Grass/DarkForest either.
  Desert: {
    desertThreshold: 2,
    jungleThreshold: 2,
    darkForestThreshold: 2,
    waterThreshold: 0.24,
    oasisRadius: 6,
    reliefAmplitude: 0.3,
    forestDensity: 0.2,
    // Applies to the oasis Jungle rings — much sparser than a full Jungle environment.
    forestCellTreeChance: 0.12,
  },
}

export function getEnvironmentTerrainParams(environment?: string | null): EnvironmentTerrainParams {
  return (
    ENVIRONMENT_TERRAIN_PARAMS[environment as EnvironmentId] ?? ENVIRONMENT_TERRAIN_PARAMS[DEFAULT_ENVIRONMENT_ID]
  )
}
