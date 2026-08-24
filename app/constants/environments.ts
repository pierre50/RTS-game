// One generated map now represents a single coherent environment. Decorative
// patchwork and lake/oasis shapes stay small and controlled per environment.
export type EnvironmentId = 'Temperate' | 'BlackForest' | 'Jungle' | 'Desert'

export const DEFAULT_ENVIRONMENT_ID: EnvironmentId = 'Temperate'

export const ENVIRONMENT_IDS: EnvironmentId[] = ['Temperate', 'BlackForest', 'Jungle', 'Desert']

// Palette source: scripts/retro_palette/duel.hex.
const TEMPERATE_WATER_BACKGROUND_COLOR = 0x006b6d
const BLACK_FOREST_WATER_BACKGROUND_COLOR = 0x07487c
const JUNGLE_WATER_BACKGROUND_COLOR = 0x008279
const DESERT_WATER_BACKGROUND_COLOR = 0x328ca7

const WATER_BACKGROUND_COLORS_BY_ENVIRONMENT: Record<EnvironmentId, number> = {
  Temperate: TEMPERATE_WATER_BACKGROUND_COLOR,
  BlackForest: BLACK_FOREST_WATER_BACKGROUND_COLOR,
  Jungle: JUNGLE_WATER_BACKGROUND_COLOR,
  Desert: DESERT_WATER_BACKGROUND_COLOR,
}

export interface EnvironmentTerrainParams {
  // The single ground type covering this environment's non-water land. Each environment
  // is exactly one type — there's nothing to classify, so this is a plain literal rather
  // than noise thresholds; the small patchwork/lake shapes below introduce the only
  // alternate ground (Dirt or, for Desert, Jungle oasis rings).
  groundType: 'Grass' | 'Desert' | 'Jungle' | 'DarkForest'
  // Ambient tree chance on groundType itself, when groundType is a forest type covering
  // the whole map (DarkForest for BlackForest, Jungle for Jungle) — null when groundType
  // has no ambient forest chance of its own (Temperate's Grass, Desert's Desert ground;
  // Desert's Jungle only ever comes from patchwork/lakes below, never from groundType).
  // Overrides BIOME_TREE_CHANCE, whose 0.92 was tuned for that type being a small patch on
  // the old mixed-biome map — at 100% environment coverage that density leaves virtually
  // no walkable gaps, so this is kept well under the ~0.59 site-percolation threshold.
  groundTreeChance: number | null
  // Ground patches use small predefined shapes, never broad biome blobs. Temperate,
  // BlackForest and Jungle use Dirt; Desert uses Jungle so the patch reads as grass and
  // can receive palm-tree resources.
  patchwork: {
    count: number
    minRadius: number
    maxRadius: number
    terrainType: 'Jungle' | 'Dirt' | 'Snow'
    // Ambient tree chance on patchwork cells specifically — only meaningful when
    // terrainType is 'Jungle' (Desert's oasis patches); null wherever terrainType is
    // Dirt/Snow, since those patch materials never get trees.
    treeChance: number | null
  }
  // Lakes are carved from rounded-but-irregular predefined shapes. Desert lakes get a
  // Jungle shore to create oasis rings; other environments have no shore (null). 'Dirt'
  // is deliberately not a valid shoreType (unlike patchwork.terrainType above, which does
  // allow it): a shore cell sits directly on a lake's edge, and Dirt's border sheet
  // doesn't compose with the water-edge border there — the same conflict the
  // water-clearance check in generateTerrain's patchwork placement exists to avoid. Adding
  // Dirt back here would need that border-composition conflict solved first, not just a
  // type change.
  lakes: {
    count: number
    minRadius: number
    maxRadius: number
    shoreRadius: number
    shoreType: 'Jungle' | null
    // Ambient tree chance on lake-shore cells specifically (Desert's oasis rings). A
    // shore cell and a patchwork cell can share the same terrainType (both 'Jungle' for
    // Desert) with no per-cell record of which one actually produced a given cell, so
    // MapResources#generateBiomeTreesAsync resolves patchwork.treeChance first for any
    // cell matching that terrainType — this value only takes effect where shoreType
    // differs from patchwork.terrainType. Keep it equal to patchwork.treeChance for now
    // (both environments that use it — only Desert today — want the same oasis density);
    // if that's ever revisited, both patchwork and shore cells would need their own
    // per-cell origin marker to be genuinely independent.
    shoreTreeChance: number | null
  }
  // Multiplier on relief band levels — lower reads as flatter terrain (e.g. Desert dunes).
  reliefAmplitude: number
  // Multiplier on the biome-agnostic tree sources (the per-player starting forest cluster
  // and neutral tree resource groups) that ignore cell.type when placing trees. Since each
  // environment is now single-type ground, these can no longer place a wrong-sprite tree —
  // this is purely a density knob (e.g. Desert's "peu de foret").
  forestDensity: number
  waterBackgroundColor: number
}

export const ENVIRONMENT_TERRAIN_PARAMS: Record<EnvironmentId, EnvironmentTerrainParams> = {
  // Beaucoup d'herbe, des forets, quelques lacs et petites zones de terre.
  Temperate: {
    groundType: 'Grass',
    groundTreeChance: 0.1,
    patchwork: { count: 18, minRadius: 1.6, maxRadius: 3.4, terrainType: 'Dirt', treeChance: null },
    lakes: { count: 2, minRadius: 3.8, maxRadius: 7.2, shoreRadius: 2.5, shoreType: null, shoreTreeChance: null },
    reliefAmplitude: 1,
    forestDensity: 0.2,
    waterBackgroundColor: WATER_BACKGROUND_COLORS_BY_ENVIRONMENT.Temperate,
  },
  // Beaucoup de foret (noire), quelques lacs et petites zones de terre.
  BlackForest: {
    groundType: 'DarkForest',
    groundTreeChance: 0.1,
    patchwork: { count: 20, minRadius: 2.4, maxRadius: 5.6, terrainType: 'Snow', treeChance: null },
    lakes: { count: 2, minRadius: 3.6, maxRadius: 6.8, shoreRadius: 2.2, shoreType: null, shoreTreeChance: null },
    reliefAmplitude: 1,
    forestDensity: 0.3,
    waterBackgroundColor: WATER_BACKGROUND_COLORS_BY_ENVIRONMENT.BlackForest,
  },
  // Beaucoup de foret palmier, quelques lacs et petites zones de terre.
  Jungle: {
    groundType: 'Jungle',
    groundTreeChance: 0.1,
    patchwork: { count: 14, minRadius: 1.5, maxRadius: 3.1, terrainType: 'Dirt', treeChance: null },
    lakes: { count: 2, minRadius: 3.6, maxRadius: 6.8, shoreRadius: 2.2, shoreType: null, shoreTreeChance: null },
    reliefAmplitude: 1,
    forestDensity: 0.3,
    waterBackgroundColor: WATER_BACKGROUND_COLORS_BY_ENVIRONMENT.Jungle,
  },
  // Peu de foret, sol en desert, quelques points d'eau (oasis: herbe + arbres palmier autour),
  // peu de relief. Pure Desert + oasis Jungle rings — both the Desert and Jungle tree assets
  // are the palm sprite, so it never mixes with Grass/DarkForest either.
  Desert: {
    groundType: 'Desert',
    groundTreeChance: null,
    // Applies to the oasis Jungle patches/rings — still sparser than a full Jungle environment.
    patchwork: { count: 16, minRadius: 2.0, maxRadius: 4.8, terrainType: 'Jungle', treeChance: 0.28 },
    lakes: { count: 2, minRadius: 3.2, maxRadius: 6.2, shoreRadius: 6.5, shoreType: 'Jungle', shoreTreeChance: 0.28 },
    reliefAmplitude: 0.3,
    forestDensity: 0.1,
    waterBackgroundColor: WATER_BACKGROUND_COLORS_BY_ENVIRONMENT.Desert,
  },
}

export function getEnvironmentTerrainParams(environment?: string | null): EnvironmentTerrainParams {
  return ENVIRONMENT_TERRAIN_PARAMS[environment as EnvironmentId] ?? ENVIRONMENT_TERRAIN_PARAMS[DEFAULT_ENVIRONMENT_ID]
}
