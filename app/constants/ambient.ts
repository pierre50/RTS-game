export const AMBIENT_BIRD_WORLD_ZINDEX = 5e8

// Per-biome probability for each empty cell to receive a tree in generateBiomeTrees.
// Grass/Desert already receive trees via generateForestAroundPlayer + neutral groups.
export const BIOME_TREE_CHANCE = {
  DarkForest: 0.92,
  Jungle: 0.92,
  Grass: 0,
  Desert: 0,
}
// Player safe radius (cells) — no biome trees placed within this distance of any spawn
export const BIOME_TREE_PLAYER_SAFE_DIST = 22

// Ground floor decorations (LABEL_TYPES.floor, zIndex 1)
export const FLOOR_SETS_GRASS = ['292', '293', '294', '295', '296', '297', '298', '299', '300', '301']
export const FLOOR_SETS_DESERT = ['10', '11', '12', '275', '276', '277', '278', '303', '304', '305', '306', '307']
export const FLOOR_SETS_JUNGLE = [...FLOOR_SETS_DESERT, ...FLOOR_SETS_GRASS]
export const FLOOR_SET_CHANCE = 0.03

// Ground decorative sets (LABEL_TYPES.set, zIndex 2)
export const GROUND_SETS = ['531', '532', '533', '534']

// Water decorative sets (LABEL_TYPES.set, zIndex 2)
// Small/medium sprites (width ≤ 57px): safe near any water cell
export const WATER_SETS = ['546', '547', '550', '551', '552', '553', '554', '555', '556', '557']
// Large sprites (width > 64px, spills across cells): require deep water with no land in range
export const WATER_SETS_DEEP = ['548', '549']
export const WATER_SET_DEEP_LAND_MIN_DIST = 3
export const WATER_SET_CHANCE = 0.002

// Bird ambience
export const AMBIENT_BIRD_MAX_CONCURRENT = 3
export const AMBIENT_BIRD_ASSETS = [
  {
    spriteSheet: '404',
    shadowSheet: '405',
    frameCount: 12,
    minScale: 1,
    maxScale: 1.25,
  },
  {
    spriteSheet: '518',
    shadowSheet: '519',
    frameCount: 10,
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
export const AMBIENT_BIRD_SHADOW_ALPHA = 0.28
export const AMBIENT_BIRD_SHADOW_OFFSET_X = 14
export const AMBIENT_BIRD_SHADOW_OFFSET_Y = 20
