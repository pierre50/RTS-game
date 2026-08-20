import type { AnimatedSprite } from 'pixi.js'
import type { SchedulerLike, SchedulerTaskId } from '../types/context'

type PlaySpriteAnimationOptions = {
  clearFrameChange?: boolean
  clearLoop?: boolean
  loop?: boolean
  onComplete?: () => void
}

type FrameSequenceSprite = Pick<AnimatedSprite, 'currentFrame' | 'gotoAndStop'>

type PlaySpriteFrameSequenceOptions = {
  frameMs: number
  frames: number[]
  onComplete?: () => void
  onFrame?: (frame: number, index: number) => void
  taskName?: string
}

export function playSpriteAnimationFromStart(
  sprite: AnimatedSprite,
  { clearFrameChange = false, clearLoop = true, loop = sprite.loop, onComplete }: PlaySpriteAnimationOptions = {}
): void {
  if (clearFrameChange) sprite.onFrameChange = undefined
  if (clearLoop) sprite.onLoop = undefined
  sprite.loop = loop
  if (onComplete !== undefined) sprite.onComplete = onComplete
  sprite.gotoAndPlay(0)
}

export function buildFrameRange(fromFrame: number, toFrame: number): number[] {
  const from = Math.max(0, Math.floor(fromFrame))
  const to = Math.max(0, Math.floor(toFrame))
  const step = from <= to ? 1 : -1
  const frames: number[] = []
  for (let frame = from; ; frame += step) {
    frames.push(frame)
    if (frame === to) break
  }
  return frames
}

export function playSpriteFrameSequence(
  sprite: FrameSequenceSprite,
  scheduler: Pick<SchedulerLike, 'add' | 'remove'>,
  { frameMs, frames, onComplete, onFrame, taskName = 'sprite.frameSequence' }: PlaySpriteFrameSequenceOptions
): SchedulerTaskId | null {
  const normalizedFrames = frames.map(frame => Math.max(0, Math.floor(frame))).filter(Number.isFinite)
  if (!normalizedFrames.length) {
    onComplete?.()
    return null
  }

  let index = 0
  let taskId: SchedulerTaskId | null = null
  const applyFrame = (): void => {
    const frame = normalizedFrames[index]
    sprite.gotoAndStop(frame)
    onFrame?.(frame, index)
  }
  const finish = (): void => {
    if (taskId != null) scheduler.remove(taskId)
    onComplete?.()
  }

  applyFrame()
  if (normalizedFrames.length === 1) {
    onComplete?.()
    return null
  }

  taskId = scheduler.add(
    () => {
      index += 1
      applyFrame()
      if (index >= normalizedFrames.length - 1) finish()
    },
    frameMs,
    taskName
  )
  return taskId
}
