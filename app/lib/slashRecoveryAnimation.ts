import { SHEET_TYPES } from '../constants'
import type { UnitEntity } from '../types/entities'
import { debugLog } from './debug'
import { lpcSlashFrameMs } from './lpc/animationSpeeds'
import { buildFrameRange, playSpriteFrameSequence } from './spriteAnimation'
import { isHeroControlled } from './unitControl'

const HERO_SLASH_FRAME_DEBUG = false
const SLASH_REVERSE_RECOVERY_FRAME_MS = lpcSlashFrameMs()
const SLASH_REVERSE_RECOVERY_STOP_FRAME = 0
const SLASH_REVERSE_RECOVERY_SKIP_FRAMES = 2

type ReverseSlashRecoveryOptions = {
  frameMs?: number
  onComplete: () => void
  releaseFrame: number
  stopFrame?: number
}

export function logHeroSlashFrame(unit: UnitEntity, event: string, details: Record<string, unknown> = {}): void {
  if (!isHeroControlled(unit)) return
  debugLog(HERO_SLASH_FRAME_DEBUG, '[hero slash frames]', event, {
    action: unit.action ?? null,
    currentFrame: unit.sprite?.currentFrame ?? null,
    sheet: unit.currentSheet ?? null,
    ...details,
  })
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
  const frames = buildFrameRange(startFrame, stopFrame).slice(0, -1)
  logHeroSlashFrame(unit, 'recovery:start', { frames, latestFrame, releaseFrame, startFrame, stopFrame })
  let completed = false
  const finish = (): void => {
    if (completed) return
    completed = true
    unit.attackRecoveryAnimationTaskId = null
    logHeroSlashFrame(unit, 'recovery:complete')
    onComplete()
  }

  const taskId = playSpriteFrameSequence(sprite, scheduler, {
    frameMs,
    frames,
    onComplete: finish,
    onFrame: (frame, index) => {
      logHeroSlashFrame(unit, 'recovery:frame', { frame, index })
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
