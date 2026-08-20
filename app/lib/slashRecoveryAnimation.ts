import { SHEET_TYPES } from '../constants'
import type { UnitEntity } from '../types/entities'
import { buildFrameRange, playSpriteFrameSequence } from './spriteAnimation'

const SLASH_REVERSE_RECOVERY_FRAME_MS = 45
const SLASH_REVERSE_RECOVERY_STOP_FRAME = 0
const SLASH_REVERSE_RECOVERY_SKIP_FRAMES = 2

type ReverseSlashRecoveryOptions = {
  frameMs?: number
  onComplete: () => void
  releaseFrame: number
  stopFrame?: number
}

export function playReverseSlashRecovery(
  unit: UnitEntity,
  {
    frameMs = SLASH_REVERSE_RECOVERY_FRAME_MS,
    onComplete,
    releaseFrame,
    stopFrame = SLASH_REVERSE_RECOVERY_STOP_FRAME,
  }: ReverseSlashRecoveryOptions
): boolean {
  const sprite = unit.sprite
  const scheduler = unit.context?.scheduler
  if (!sprite?.gotoAndStop || !scheduler?.add) return false

  const latestFrame = Math.min(Math.floor(sprite.currentFrame), releaseFrame)
  const startFrame = Math.max(stopFrame, latestFrame - SLASH_REVERSE_RECOVERY_SKIP_FRAMES)
  const frames = buildFrameRange(startFrame, stopFrame)
  let completed = false
  const finish = (): void => {
    if (completed) return
    completed = true
    unit.attackRecoveryAnimationTaskId = null
    onComplete()
  }

  const taskId = playSpriteFrameSequence(sprite, scheduler, {
    frameMs,
    frames,
    onComplete: finish,
    onFrame: () => {
      unit.syncShadow?.()
      unit.syncAppearanceLayers?.(SHEET_TYPES.action)
    },
    taskName: 'combat.slashReverseRecovery',
  })

  unit.attackRecoveryAnimationTaskId = taskId
  if (unit.isDead || unit.isDestroyed) {
    if (taskId != null) scheduler.remove(taskId)
    finish()
  }
  return true
}
