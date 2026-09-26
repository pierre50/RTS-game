import { Assets } from 'pixi.js'
import { getWorkCycleMs, type WorkSpriteSheet } from './workTiming'
import type { UnitConfig } from '../../types/config'

/** Resolve assets at the boundary; the economic timing calculation takes plain data. */
export function offlineWorkCycleMs(config: UnitConfig, work: string, action?: string): number {
  const assets = config.allAssets as Record<string, { actionSheet?: string }> | undefined
  const name = assets?.[work]?.actionSheet
  return getWorkCycleMs(config, work, name ? Assets.cache.get<WorkSpriteSheet>(name) : undefined, action)
}
