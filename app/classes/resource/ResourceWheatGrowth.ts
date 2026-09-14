import { AnimatedSprite } from 'pixi.js'
import { RESOURCE_TYPES } from '../../constants'
import type { Resource } from '../Resource'

export function advanceResourceWheatGrowth(this: Resource, frames = 1): boolean {
  if (this.type !== RESOURCE_TYPES.wheat || !(this.sprite instanceof AnimatedSprite)) return false
  if (this.isDead || this.isDestroyed) return false
  const lastFrame = Math.max(0, this.sprite.textures.length - 1)
  const currentFrame = Math.max(0, Math.min(lastFrame, this.sprite.currentFrame ?? 0))
  const nextFrame = Math.min(lastFrame, currentFrame + Math.max(1, Math.floor(frames)))
  if (nextFrame === currentFrame) return false
  this.sprite.gotoAndStop(nextFrame)
  this.syncShadow()
  if (this.isWindAnimatedWheat()) this.startWindMotion()
  return true
}
