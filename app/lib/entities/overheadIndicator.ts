import { LABEL_TYPES } from '../constants'
import { getEntityHudTopY } from './entityHudPosition'
import { HUD_FADE_MS, HUD_FADE_STEP_MS } from './hudFade'
import { getReliefOffset } from '../maths'
import { createStatusBubble } from './statusBubble'
import type { UnitEntity } from '../../types/entities'
import type { GameContextLike } from '../../types/context'

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
const INDICATOR_POSITION_SYNC_MS = 50

type OverheadIndicatorDisplay = ReturnType<typeof createStatusBubble> & {
  fadeTaskId?: number | null
  fadeScheduler?: GameContextLike['scheduler'] | null
  positionTaskId?: number | null
  positionScheduler?: GameContextLike['scheduler'] | null
}

function updateIndicatorPosition(unit: UnitEntity, indicator: OverheadIndicatorDisplay): void {
  indicator.y = getEntityHudTopY(unit, INDICATOR_TOP_GAP) + getReliefOffset(unit)
}

function destroyOverheadIndicator(indicator: OverheadIndicatorDisplay): void {
  if (indicator.fadeTaskId != null) {
    indicator.fadeScheduler?.remove(indicator.fadeTaskId)
    indicator.fadeTaskId = null
  }
  if (indicator.positionTaskId != null) {
    indicator.positionScheduler?.remove(indicator.positionTaskId)
    indicator.positionTaskId = null
  }
  indicator.parent?.removeChild(indicator)
  if (!indicator.destroyed) indicator.destroy({ children: true })
}

function syncIndicatorPositionWhileVisible(unit: UnitEntity, indicator: OverheadIndicatorDisplay): void {
  const scheduler = unit.context?.scheduler
  if (!scheduler) return
  indicator.positionScheduler = scheduler
  indicator.positionTaskId = scheduler.add(
    () => {
      if (indicator.destroyed || unit.isDestroyed) {
        destroyOverheadIndicator(indicator)
        return
      }
      updateIndicatorPosition(unit, indicator)
    },
    INDICATOR_POSITION_SYNC_MS,
    'unit.overheadIndicatorPosition'
  )
}

export function clearUnitOverheadIndicator(unit: UnitEntity, options: { fade?: boolean } = {}): void {
  const existing = unit.getChildByLabel?.(LABEL_TYPES.overheadIndicator)
  if (!existing) return
  const indicator = existing as OverheadIndicatorDisplay
  if (options.fade === false || !unit.context?.scheduler) {
    destroyOverheadIndicator(indicator)
    return
  }
  if (indicator.fadeTaskId != null) return

  const scheduler = unit.context.scheduler
  const startedAt = scheduler.elapsedMs
  indicator.fadeScheduler = scheduler
  indicator.fadeTaskId = scheduler.add(
    () => {
      if (indicator.destroyed || unit.isDestroyed) {
        destroyOverheadIndicator(indicator)
        return
      }
      const progress = Math.min(1, (scheduler.elapsedMs - startedAt) / HUD_FADE_MS)
      indicator.alpha = 1 - progress
      if (progress >= 1) destroyOverheadIndicator(indicator)
    },
    HUD_FADE_STEP_MS,
    'unit.overheadIndicatorFade'
  )
}

export function setUnitOverheadIndicator(unit: UnitEntity, type: OverheadIndicatorType | null): void {
  clearUnitOverheadIndicator(unit, { fade: !type })
  if (!type) return

  const indicator = createStatusBubble({
    text: INDICATOR_TEXT[type],
    fontSize: INDICATOR_FONT_SIZE[type],
  })
  indicator.label = LABEL_TYPES.overheadIndicator
  indicator.x = 0
  updateIndicatorPosition(unit, indicator)
  indicator.zIndex = 120
  unit.addChild?.(indicator)
  syncIndicatorPositionWhileVisible(unit, indicator)
}
