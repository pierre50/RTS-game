import { Text } from 'pixi.js'
import { LABEL_TYPES } from '../constants'
import type { UnitEntity } from '../types/entities'

export type OverheadIndicatorType = 'exclamation' | 'sleep'

const INDICATOR_TEXT: Record<OverheadIndicatorType, string> = {
  exclamation: '!',
  sleep: 'zZzZ',
}

export function clearUnitOverheadIndicator(unit: UnitEntity): void {
  const existing = unit.getChildByLabel?.(LABEL_TYPES.overheadIndicator)
  if (!existing) return
  unit.removeChild(existing)
  existing.destroy({ children: true })
}

export function setUnitOverheadIndicator(unit: UnitEntity, type: OverheadIndicatorType | null): void {
  clearUnitOverheadIndicator(unit)
  if (!type) return

  const indicator = new Text({
    text: INDICATOR_TEXT[type],
    style: {
      fill: 0xffe066,
      fontFamily: 'Arial, sans-serif',
      fontSize: 18,
      fontWeight: '900',
      stroke: { color: 0x2b1605, width: 4 },
    },
  })
  indicator.label = LABEL_TYPES.overheadIndicator
  indicator.anchor.set(0.5, 0.5)
  indicator.x = 0
  indicator.y = -Math.max(46, unit.sprite?.height ?? 0)
  indicator.zIndex = 120
  unit.addChild?.(indicator)
}
