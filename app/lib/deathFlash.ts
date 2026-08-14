import type { AnimatedSprite } from 'pixi.js'

const DEATH_FLASH_TINT = 0xff3030
const DEFAULT_TINT = 0xffffff

export function startDeathFlash(sprite: AnimatedSprite | null | undefined): () => void {
  if (!sprite) return () => {}

  const originalTint = sprite.tint ?? DEFAULT_TINT
  const originalTextures = sprite.textures
  const previousOnFrameChange = sprite.onFrameChange
  let active = true

  const applyTint = (frame: number): void => {
    if (sprite.textures !== originalTextures) {
      stop()
      return
    }
    sprite.tint = frame % 2 === 0 ? DEATH_FLASH_TINT : originalTint
  }

  const onFrameChange = (frame: number): void => {
    previousOnFrameChange?.(frame)
    if (active) applyTint(frame)
  }

  applyTint(sprite.currentFrame ?? 0)
  sprite.onFrameChange = onFrameChange

  const stop = () => {
    if (!active) return
    active = false
    if (sprite.onFrameChange === onFrameChange) {
      sprite.onFrameChange = previousOnFrameChange
    }
    sprite.tint = originalTint
  }

  return stop
}

export function runAfterDeathFlash(sprite: AnimatedSprite | null | undefined, onComplete: () => void): () => void {
  const stopDeathFlash = startDeathFlash(sprite)

  return () => {
    stopDeathFlash()
    onComplete()
  }
}
