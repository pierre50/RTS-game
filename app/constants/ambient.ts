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
// Kept independent from GROUND_SET_CHANCE/FLOOR_SET_CHANCE so disabling ground clutter
// (rocks/floor variants) never silently kills wildlife spawning, and vice versa.
export const AMBIENT_ANIMAL_CHANCE = 0.008

// Ground floor decorations (LABEL_TYPES.floor, zIndex 1)
export const FLOOR_SETS_GRASS = ['environment/floor/grass-1', 'environment/floor/grass-2', 'environment/floor/grass-3', 'environment/floor/grass-4', 'environment/floor/grass-5', 'environment/floor/grass-6', 'environment/floor/grass-7', 'environment/floor/grass-8', 'environment/floor/grass-9', 'environment/floor/grass-10']
export const FLOOR_SETS_DESERT = ['environment/floor/desert-1', 'environment/floor/desert-2', 'environment/floor/desert-3', 'environment/floor/desert-4', 'environment/floor/desert-5', 'environment/floor/desert-6', 'environment/floor/desert-7', 'environment/floor/desert-8', 'environment/floor/desert-9', 'environment/floor/desert-10', 'environment/floor/desert-11', 'environment/floor/desert-12']
export const FLOOR_SETS_JUNGLE = [...FLOOR_SETS_DESERT, ...FLOOR_SETS_GRASS]
export const FLOOR_SET_CHANCE = 0//0.03

// Ground decorative sets (LABEL_TYPES.set, zIndex 2)
export const GROUND_SETS = ['environment/ground/stone-set-1', 'environment/ground/stone-set-2', 'environment/ground/stone-set-3', 'environment/ground/stone-set-4']
export const GROUND_SET_CHANCE = 0//0.02

// Water decorative sets (LABEL_TYPES.set, zIndex 2)
// Small/medium sprites (width ≤ 57px): safe near any water cell
export const WATER_SETS = ['environment/water/shore-set-1', 'environment/water/shore-set-2', 'environment/water/shore-set-3', 'environment/water/shore-set-4', 'environment/water/shore-set-5', 'environment/water/shore-set-6', 'environment/water/shore-set-7', 'environment/water/shore-set-8', 'environment/water/shore-set-9', 'environment/water/shore-set-10']
// Large sprites (width > 64px, spills across cells): require deep water with no land in range
export const WATER_SETS_DEEP = ['environment/water/deep-set-1', 'environment/water/deep-set-2']
export const WATER_SET_DEEP_LAND_MIN_DIST = 3
export const WATER_SET_CHANCE = 0//0.002
// Per-cell chance of spawning a fish resource on a water cell. Kept independent from
// GROUND_SET_CHANCE (rocks) so fish, a gameplay resource, doesn't die with ground clutter.
export const FISH_SPAWN_CHANCE = 0.02

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
