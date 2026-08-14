import type { GameContextLike, SchedulerTaskId } from '../types/context'

const FADE_STEP_MS = 40

// Structural, not the RuntimeEntity union (that excludes Projectile) — anything with an alpha
// to animate and a clear() to finish with (Unit/Animal corpses, spent ground projectiles) fits.
export interface FadeableEntity {
  alpha?: number
  isDestroyed?: boolean
  context?: GameContextLike | null
  clear?: () => void
  shadow?: { alpha?: number; destroyed?: boolean } | null
}

// Steps alpha down to 0 over durationMs, then calls entity.clear(). Bails without animating if
// the entity is destroyed out from under it mid-fade (e.g. a building built on top of it).
export function fadeOutThenClear(entity: FadeableEntity, durationMs: number): void {
  const scheduler = entity.context?.scheduler
  if (!scheduler) {
    entity.clear?.()
    return
  }
  const steps = Math.max(1, Math.round(durationMs / FADE_STEP_MS))
  let step = 0
  let taskId: SchedulerTaskId | null = null
  const initialAlpha = entity.alpha ?? 1
  const shadow = entity.shadow
  const initialShadowAlpha = shadow?.alpha ?? 1
  taskId = scheduler.add(
    () => {
      if (entity.isDestroyed) {
        if (taskId != null) scheduler.remove(taskId)
        return
      }
      step += 1
      const ratio = Math.max(0, 1 - step / steps)
      entity.alpha = initialAlpha * ratio
      if (shadow && !shadow.destroyed) shadow.alpha = initialShadowAlpha * ratio
      if (step >= steps) {
        if (taskId != null) scheduler.remove(taskId)
        entity.clear?.()
      }
    },
    FADE_STEP_MS,
    'entity.fadeOut'
  )
}

export function fadeIn(entity: FadeableEntity, durationMs: number): void {
  const targetAlpha = entity.alpha ?? 1
  const shadow = entity.shadow
  const targetShadowAlpha = shadow?.alpha ?? 1
  const scheduler = entity.context?.scheduler
  if (!scheduler) {
    entity.alpha = targetAlpha
    if (shadow && !shadow.destroyed) shadow.alpha = targetShadowAlpha
    return
  }

  const steps = Math.max(1, Math.round(durationMs / FADE_STEP_MS))
  let step = 0
  let taskId: SchedulerTaskId | null = null
  entity.alpha = 0
  if (shadow && !shadow.destroyed) shadow.alpha = 0

  taskId = scheduler.add(
    () => {
      if (entity.isDestroyed) {
        if (taskId != null) scheduler.remove(taskId)
        return
      }
      step += 1
      const ratio = Math.min(1, step / steps)
      entity.alpha = targetAlpha * ratio
      if (shadow && !shadow.destroyed) shadow.alpha = targetShadowAlpha * ratio
      if (step >= steps && taskId != null) scheduler.remove(taskId)
    },
    FADE_STEP_MS,
    'entity.fadeIn'
  )
}
