import type { AnimatedSprite } from 'pixi.js'
import { clearSpriteTintFrameEffect } from './spriteTransientEffects'

export function clearDeathFlash(sprite: AnimatedSprite | null | undefined): void {
  clearSpriteTintFrameEffect(sprite)
}

export function runAfterDeathFlash(sprite: AnimatedSprite | null | undefined, onComplete: () => void): () => void {
  clearDeathFlash(sprite)

  return () => {
    clearDeathFlash(sprite)
    onComplete()
  }
}
