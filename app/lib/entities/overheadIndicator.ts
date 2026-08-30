import { LABEL_TYPES } from '../constants'
import { getEntityHudTopY } from './entityHudPosition'
import { HUD_FADE_MS, HUD_FADE_STEP_MS } from './hudFade'
import { getReliefOffset } from '../maths'
import { createStatusBubble } from './statusBubble'
import type { RuntimeEntity, UnitEntity } from '../../types/entities'
import type { GameContextLike } from '../../types/context'

export type OverheadIndicatorType = 'exclamation' | 'question' | 'sleep'

const INDICATOR_TEXT: Record<OverheadIndicatorType, string> = {
  exclamation: '!',
  question: '?',
  sleep: 'zzz',
}

const INDICATOR_FONT_SIZE: Record<OverheadIndicatorType, number> = {
  exclamation: 14,
  question: 14,
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

type OverheadIndicatorHost = RuntimeEntity & {
  overheadIndicatorOffsetX?: number
  overheadIndicatorOffsetY?: number
}

function getFiniteOffset(value: number | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function updateIndicatorPosition(entity: RuntimeEntity, indicator: OverheadIndicatorDisplay): void {
  const host = entity as OverheadIndicatorHost
  indicator.x = getFiniteOffset(host.overheadIndicatorOffsetX)
  indicator.y =
    getEntityHudTopY(entity, INDICATOR_TOP_GAP) +
    getReliefOffset(entity) +
    getFiniteOffset(host.overheadIndicatorOffsetY)
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

function syncIndicatorPositionWhileVisible(entity: RuntimeEntity, indicator: OverheadIndicatorDisplay): void {
  const scheduler = entity.context?.scheduler
  if (!scheduler) return
  indicator.positionScheduler = scheduler
  indicator.positionTaskId = scheduler.add(
    () => {
      if (indicator.destroyed || entity.isDestroyed) {
        destroyOverheadIndicator(indicator)
        return
      }
      updateIndicatorPosition(entity, indicator)
    },
    INDICATOR_POSITION_SYNC_MS,
    'entity.overheadIndicatorPosition'
  )
}

export function clearEntityOverheadIndicator(entity: RuntimeEntity, options: { fade?: boolean } = {}): void {
  const existing = entity.getChildByLabel?.(LABEL_TYPES.overheadIndicator)
  if (!existing) return
  const indicator = existing as OverheadIndicatorDisplay
  if (options.fade === false || !entity.context?.scheduler) {
    destroyOverheadIndicator(indicator)
    return
  }
  if (indicator.fadeTaskId != null) return

  const scheduler = entity.context.scheduler
  const startedAt = scheduler.elapsedMs
  indicator.fadeScheduler = scheduler
  indicator.fadeTaskId = scheduler.add(
    () => {
      if (indicator.destroyed || entity.isDestroyed) {
        destroyOverheadIndicator(indicator)
        return
      }
      const progress = Math.min(1, (scheduler.elapsedMs - startedAt) / HUD_FADE_MS)
      indicator.alpha = 1 - progress
      if (progress >= 1) destroyOverheadIndicator(indicator)
    },
    HUD_FADE_STEP_MS,
    'entity.overheadIndicatorFade'
  )
}

export function setEntityOverheadIndicator(entity: RuntimeEntity, type: OverheadIndicatorType | null): void {
  clearEntityOverheadIndicator(entity, { fade: !type })
  if (!type) return

  const indicator = createStatusBubble({
    text: INDICATOR_TEXT[type],
    fontSize: INDICATOR_FONT_SIZE[type],
  })
  indicator.label = LABEL_TYPES.overheadIndicator
  updateIndicatorPosition(entity, indicator)
  indicator.zIndex = 120
  entity.addChild?.(indicator)
  syncIndicatorPositionWhileVisible(entity, indicator)
}

export function clearUnitOverheadIndicator(unit: UnitEntity, options: { fade?: boolean } = {}): void {
  clearEntityOverheadIndicator(unit, options)
}

export function setUnitOverheadIndicator(unit: UnitEntity, type: OverheadIndicatorType | null): void {
  setEntityOverheadIndicator(unit, type)
}
