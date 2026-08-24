import type { GameContextLike, SchedulerTaskId } from '../types/context'

const FADE_STEP_MS = 40

type FadeTaskState = {
  scheduler: Pick<NonNullable<GameContextLike['scheduler']>, 'remove'>
  taskId: SchedulerTaskId
  token: number
}

const fadeTaskStates = new WeakMap<FadeableEntity, FadeTaskState>()

// Structural, not the RuntimeEntity union (that excludes Projectile) — anything with an alpha
// to animate and a clear() to finish with (Unit/Animal corpses, spent ground projectiles) fits.
export interface FadeableEntity {
  alpha?: number
  isDestroyed?: boolean
  context?: GameContextLike | null
  clear?: () => void
  shadow?: { alpha?: number; destroyed?: boolean } | null
  horseShadow?: { alpha?: number; destroyed?: boolean } | null
}

function fadeShadows(
  shadows: ({ alpha?: number; destroyed?: boolean } | null | undefined)[],
  alphas: number[],
  ratio: number
): void {
  shadows.forEach((shadow, index) => {
    if (shadow && !shadow.destroyed) shadow.alpha = alphas[index] * ratio
  })
}

function nextFadeToken(entity: FadeableEntity): number {
  const previous = fadeTaskStates.get(entity)
  if (previous) previous.scheduler.remove(previous.taskId)
  fadeTaskStates.delete(entity)
  return (previous?.token ?? 0) + 1
}

export function cancelFade(entity: FadeableEntity): void {
  const previous = fadeTaskStates.get(entity)
  if (!previous) return
  previous.scheduler.remove(previous.taskId)
  fadeTaskStates.delete(entity)
}

export function fadeOut(entity: FadeableEntity, durationMs: number, onComplete?: () => void): void {
  const token = nextFadeToken(entity)
  const scheduler = entity.context?.scheduler
  if (!scheduler) {
    entity.alpha = 0
    fadeShadows([entity.shadow, entity.horseShadow], [entity.shadow?.alpha ?? 1, entity.horseShadow?.alpha ?? 1], 0)
    onComplete?.()
    return
  }
  const steps = Math.max(1, Math.round(durationMs / FADE_STEP_MS))
  let step = 0
  let taskId: SchedulerTaskId | null = null
  const initialAlpha = entity.alpha ?? 1
  const shadows = [entity.shadow, entity.horseShadow]
  const shadowAlphas = shadows.map(shadow => shadow?.alpha ?? 1)
  taskId = scheduler.add(
    () => {
      if (fadeTaskStates.get(entity)?.token !== token) return
      if (entity.isDestroyed) {
        if (taskId != null) scheduler.remove(taskId)
        fadeTaskStates.delete(entity)
        return
      }
      step += 1
      const ratio = Math.max(0, 1 - step / steps)
      entity.alpha = initialAlpha * ratio
      fadeShadows(shadows, shadowAlphas, ratio)
      if (step >= steps) {
        if (taskId != null) scheduler.remove(taskId)
        fadeTaskStates.delete(entity)
        onComplete?.()
      }
    },
    FADE_STEP_MS,
    'entity.fadeOut'
  )
  fadeTaskStates.set(entity, { scheduler, taskId, token })
}

// Steps alpha down to 0 over durationMs, then calls entity.clear(). Bails without animating if
// the entity is destroyed out from under it mid-fade (e.g. a building built on top of it).
export function fadeOutThenClear(entity: FadeableEntity, durationMs: number): void {
  fadeOut(entity, durationMs, () => entity.clear?.())
}

export function fadeIn(entity: FadeableEntity, durationMs: number): void {
  const token = nextFadeToken(entity)
  const targetAlpha = entity.alpha ?? 1
  const shadows = [entity.shadow, entity.horseShadow]
  const targetShadowAlphas = shadows.map(shadow => shadow?.alpha ?? 1)
  const scheduler = entity.context?.scheduler
  if (!scheduler) {
    entity.alpha = targetAlpha
    fadeShadows(shadows, targetShadowAlphas, 1)
    return
  }

  const steps = Math.max(1, Math.round(durationMs / FADE_STEP_MS))
  let step = 0
  let taskId: SchedulerTaskId | null = null
  entity.alpha = 0
  fadeShadows(shadows, targetShadowAlphas, 0)

  taskId = scheduler.add(
    () => {
      if (fadeTaskStates.get(entity)?.token !== token) return
      if (entity.isDestroyed) {
        if (taskId != null) scheduler.remove(taskId)
        fadeTaskStates.delete(entity)
        return
      }
      step += 1
      const ratio = Math.min(1, step / steps)
      entity.alpha = targetAlpha * ratio
      fadeShadows(shadows, targetShadowAlphas, ratio)
      if (step >= steps && taskId != null) {
        scheduler.remove(taskId)
        fadeTaskStates.delete(entity)
      }
    },
    FADE_STEP_MS,
    'entity.fadeIn'
  )
  fadeTaskStates.set(entity, { scheduler, taskId, token })
}
