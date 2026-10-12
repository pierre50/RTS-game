import { estimateConstructionDuration } from '../lib/buildings/constructionDuration'
import { getLang, t } from '../lib/lang'
import type { BuildingConfig } from '../types/config'

/** Explain the same reference estimate for new construction and renovation work. */
export function constructionDurationDescription(config: BuildingConfig, level = 0, savedWork?: number): string {
  const estimate = estimateConstructionDuration(
    savedWork ?? config.constructionWorkRequired ?? config.constructionTime,
    level
  )
  if (!estimate) return ''
  const duration = t(
    `constructionDuration${estimate.unit === 'days' ? (estimate.value === 1 ? 'Day' : 'Days') : estimate.unit === 'hours' ? 'Hours' : 'Minutes'}`,
    {
      value: estimate.value.toLocaleString(getLang(), { maximumFractionDigits: 1 }),
    }
  )
  return t('constructionDurationDescription', {
    duration,
    workers: estimate.workers,
    material: t(estimate.toolMaterial === 'bronze' ? 'constructionToolBronze' : 'constructionToolStone'),
  })
}
