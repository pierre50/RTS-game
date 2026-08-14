export const AMBIENT_BIRD_WORLD_ZINDEX = 5e8

// Per-cell-type probability for an empty cell to receive a tree in generateBiomeTrees.
// Grass/Desert already receive trees via generateForestAroundPlayer + neutral groups.
// DarkForest/Jungle have no entry here: wherever an environment can produce those cell
// types, EnvironmentTerrainParams.groundTreeChance/patchwork.treeChance/lakes.shoreTreeChance
// overrides this table entirely (see MapResources#generateBiomeTreesAsync) — an
// environment-independent default for them would never actually be read.
export const BIOME_TREE_CHANCE = {
  Grass: 0,
  Desert: 0,
}
// Player safe radius (cells) — no biome trees placed within this distance of any spawn
export const BIOME_TREE_PLAYER_SAFE_DIST = 22
// Player safe radius (cells) — no animals spawned within this distance of any spawn,
// above the highest runaway sight (Deer: 8) so the camp start isn't a stampede
export const ANIMAL_PLAYER_SAFE_DIST = 14
// Per-cell chance of rolling an ambient wildlife group outside the player safe zone.
// This scales with map area (cells checked ~ size^2), so keep it small: at 0.008 a
// default Small (144x144) map placed ~300 animals and a Medium (256x256) map ~1000.
export const AMBIENT_ANIMAL_CHANCE = 0.0015

// Bird ambience
export const AMBIENT_BIRD_MAX_CONCURRENT = 3
export const AMBIENT_BIRD_ASSETS = [
  {
    spriteSheet: 'environment/birds/eagle',
    frameCount: 1,
    minScale: 1,
    maxScale: 1.25,
  },
  {
    spriteSheet: 'environment/birds/hawk',
    frameCount: 1,
    minScale: 1.35,
    maxScale: 1.7,
  },
]

export const AMBIENT_BIRD_FIRST_PASS_MIN_MS = 8000
export const AMBIENT_BIRD_FIRST_PASS_MAX_MS = 16000
export const AMBIENT_BIRD_PASS_INTERVAL_MIN_MS = 28000
export const AMBIENT_BIRD_PASS_INTERVAL_MAX_MS = 55000
export const AMBIENT_BIRD_SPEED_MIN = 60
export const AMBIENT_BIRD_SPEED_MAX = 100
export const AMBIENT_BIRD_SCREEN_MARGIN = 100
export const AMBIENT_BIRD_PATH_OFFSET_RATIO = 0.3
export const AMBIENT_BIRD_ANIMATION_SPEED = 0.24
// Shadow is the body sprite tinted to a flat silhouette (no dedicated shadow sheet)
export const AMBIENT_BIRD_SHADOW_TINT = 0x000000
export const AMBIENT_BIRD_SHADOW_ALPHA = 0.28
export const AMBIENT_BIRD_SHADOW_OFFSET_X = 22
export const AMBIENT_BIRD_SHADOW_OFFSET_Y = 32
