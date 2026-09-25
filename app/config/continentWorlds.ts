// Both test sizes share the same continent seed, mask and generation rules.
export const CONTINENT_WORLD_SEED = 5000
export const CONTINENT_WORLD_PRESETS = [1000, 5000].map(edge => ({
  edge,
  size: edge - 1,
  worldId: `world-test-${edge}`,
}))

export function isContinentWorld(worldId?: string | null): boolean {
  return CONTINENT_WORLD_PRESETS.some(preset => preset.worldId === worldId)
}
