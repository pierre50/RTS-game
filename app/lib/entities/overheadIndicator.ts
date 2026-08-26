import { LABEL_TYPES } from '../constants'
import { getEntityHudTopY } from './entityHudPosition'
import { createStatusBubble } from './statusBubble'
import type { UnitEntity } from '../../types/entities'

export type OverheadIndicatorType = 'exclamation' | 'sleep'

const INDICATOR_TEXT: Record<OverheadIndicatorType, string> = {
  exclamation: '!',
  sleep: 'zzz',
}

const INDICATOR_FONT_SIZE: Record<OverheadIndicatorType, number> = {
  exclamation: 14,
  sleep: 13,
}
const INDICATOR_TOP_GAP = 6

export function clearUnitOverheadIndicator(unit: UnitEntity): void {
  const existing = unit.getChildByLabel?.(LABEL_TYPES.overheadIndicator)
  if (!existing) return
  unit.removeChild(existing)
  existing.destroy({ children: true })
}

export function setUnitOverheadIndicator(unit: UnitEntity, type: OverheadIndicatorType | null): void {
  clearUnitOverheadIndicator(unit)
  if (!type) return

  const indicator = createStatusBubble({
    text: INDICATOR_TEXT[type],
    fontSize: INDICATOR_FONT_SIZE[type],
  })
  indicator.label = LABEL_TYPES.overheadIndicator
  indicator.x = 0
  indicator.y = getEntityHudTopY(unit, INDICATOR_TOP_GAP)
  indicator.zIndex = 120
  unit.addChild?.(indicator)
}
