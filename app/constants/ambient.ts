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
// Tiny technical clearance around the exact spawn footprint. Large empty start zones
// are avoided by resource generation; future city placement can clean resources locally.
export const BIOME_TREE_PLAYER_SAFE_DIST = 6
// Player safe radius (cells) — no animals spawned within this distance of any spawn,
// above the highest runaway sight (Deer: 8) so the camp start isn't a stampede
export const ANIMAL_PLAYER_SAFE_DIST = 14
// Per-cell chance of rolling an ambient wildlife group outside the player safe zone.
// This scales with map area (cells checked ~ size^2), so keep it small: at 0.008 a
// default Small (144x144) map placed ~300 animals and a Medium (256x256) map ~1000.
export const AMBIENT_ANIMAL_CHANCE = 0.0015
