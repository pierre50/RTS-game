/** The crop's growth progress belongs to simulation; sprites are a legacy fallback. */
export type ResourceGrowthSource = {
  growthStage?: number
  growthStageCount?: number
  sprite?: unknown
}

export function resourceGrowthState(source: ResourceGrowthSource): { stage: number; count: number } | null {
  if (typeof source.growthStage === 'number' && typeof source.growthStageCount === 'number') {
    return { stage: source.growthStage, count: source.growthStageCount }
  }
  const sprite = source.sprite as { currentFrame?: number; textures?: readonly unknown[] } | null | undefined
  if (typeof sprite?.currentFrame !== 'number' || !sprite.textures?.length) return null
  return { stage: sprite.currentFrame, count: sprite.textures.length }
}
