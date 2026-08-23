import type { AnimatedSprite } from 'pixi.js'
import { clearSpriteTintFrameEffect, startSpriteTintFrameEffect } from './spriteTransientEffects'

const DEATH_FLASH_TINT = 0xff3030
const DEFAULT_TINT = 0xffffff

export function clearDeathFlash(sprite: AnimatedSprite | null | undefined): void {
  clearSpriteTintFrameEffect(sprite)
}

export function startDeathFlash(sprite: AnimatedSprite | null | undefined): () => void {
  if (!sprite) return () => {}

  const originalTextures = sprite.textures
  return startSpriteTintFrameEffect(sprite, {
    applyFrame: (frame, originalTint, clear) => {
      if (sprite.textures !== originalTextures) {
        clear()
        return
      }
      sprite.tint = frame % 2 === 0 ? DEATH_FLASH_TINT : (originalTint ?? DEFAULT_TINT)
    },
  })
}

export function runAfterDeathFlash(sprite: AnimatedSprite | null | undefined, onComplete: () => void): () => void {
  const stopDeathFlash = startDeathFlash(sprite)

  return () => {
    stopDeathFlash()
    onComplete()
  }
}
