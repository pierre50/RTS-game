import type { UnitEntity } from '../../types/entities'
import type { HeroCompanionHorseController } from '../HeroCompanionHorseController'
import {
  MOUNT_TRANSITION_CAMERA_MS,
  MOUNT_TRANSITION_FADE_IN_MS,
  MOUNT_TRANSITION_FADE_OUT_MS,
  MOUNT_TRANSITION_HIDDEN_ALPHA,
  MOUNT_TRANSITION_TICK_MS,
  easeInOut,
  type HeroAimPoint,
} from '../HeroControllerSupport'
type Host = Pick<HeroCompanionHorseController, 'controls' | 'mountTransitionTaskId' | 'cancelMountTransition'>
export function startHorseTransition(
  this: Host,
  getHeroUnit: () => UnitEntity | null,
  {
    cameraEnd,
    finish,
    taskName,
    targetValid,
  }: {
    cameraEnd: HeroAimPoint
    finish: () => boolean
    taskName: string
    targetValid?: () => boolean
  }
): boolean {
  const unit = getHeroUnit()
  const scheduler = this.controls.context.scheduler
  if (!unit) return false
  if (this.mountTransitionTaskId != null) return true
  if (!scheduler) return finish()

  const startedAt = scheduler.elapsedMs
  const cameraStart = { x: unit.x, y: unit.y }
  let swapped = false
  unit.alpha = 1
  const taskId = scheduler.add(
    () => {
      const currentUnit = getHeroUnit()
      if (!currentUnit || currentUnit.isDead || currentUnit.isDestroyed || targetValid?.() === false) {
        this.cancelMountTransition()
        return
      }
      const elapsed = scheduler.elapsedMs - startedAt
      const cameraProgress = easeInOut(elapsed / MOUNT_TRANSITION_CAMERA_MS)
      this.controls.setCamera?.(
        cameraStart.x + (cameraEnd.x - cameraStart.x) * cameraProgress,
        cameraStart.y + (cameraEnd.y - cameraStart.y) * cameraProgress
      )
      if (elapsed < MOUNT_TRANSITION_FADE_OUT_MS) {
        const progress = Math.max(0, elapsed / MOUNT_TRANSITION_FADE_OUT_MS)
        currentUnit.alpha = 1 - (1 - MOUNT_TRANSITION_HIDDEN_ALPHA) * progress
        return
      }
      if (!swapped) {
        currentUnit.alpha = MOUNT_TRANSITION_HIDDEN_ALPHA
        if (!finish()) {
          this.cancelMountTransition()
          return
        }
        swapped = true
      }
      const fadeInProgress = Math.min(1, (elapsed - MOUNT_TRANSITION_FADE_OUT_MS) / MOUNT_TRANSITION_FADE_IN_MS)
      currentUnit.alpha = MOUNT_TRANSITION_HIDDEN_ALPHA + (1 - MOUNT_TRANSITION_HIDDEN_ALPHA) * fadeInProgress
      if (fadeInProgress >= 1) this.cancelMountTransition(false)
    },
    MOUNT_TRANSITION_TICK_MS,
    taskName
  )
  this.mountTransitionTaskId = taskId
  return true
}
