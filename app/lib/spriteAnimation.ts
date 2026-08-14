import type { AnimatedSprite } from 'pixi.js'

type PlaySpriteAnimationOptions = {
  clearFrameChange?: boolean
  clearLoop?: boolean
  loop?: boolean
  onComplete?: () => void
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
