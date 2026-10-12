import { t } from '../../lib/lang'
import { getUnitOverallLevel } from '../../lib/units/unitExperience'
import type { UnitEntity } from '../../types/entities'
import { createValueBadge } from '../ValueBadge'

export function formatUnitLevel(unit: UnitEntity): string {
  return `${t('levelShort')} ${getUnitOverallLevel(unit)}`
}

/** One badge for the HUD, entity summaries and window titles. */
export function createUnitLevelBadge(unit?: UnitEntity): HTMLSpanElement {
  const badge = createValueBadge('level', unit ? formatUnitLevel(unit) : '')
  badge.className += ' unit-level-tag'
  return badge
}
