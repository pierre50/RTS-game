import { clearDamageFeedback } from './combatFeedback'
import { clearDeathFlash } from './deathFlash'
import type { RuntimeEntity } from '../types/entities'
import type { AnimatedSprite } from 'pixi.js'

export function clearEntityVisualFeedback(entity: RuntimeEntity | null | undefined): void {
  if (!entity) return
  clearDeathFlash(entity.sprite as AnimatedSprite | null | undefined)
  clearDamageFeedback(entity)
}
