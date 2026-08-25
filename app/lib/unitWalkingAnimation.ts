import { SHEET_TYPES } from '../constants'
import type { UnitEntity } from '../types/entities'

type AnimationSpriteLike = {
  animationSpeed: number
}

type LayeredUnit = UnitEntity & {
  appearanceLayerSprites?: Map<unknown, AnimationSpriteLike>
}

const baseAnimationSpeedBySprite = new WeakMap<AnimationSpriteLike, number>()

function applySpriteAnimationSpeed(sprite: AnimationSpriteLike | null | undefined, factor: number): void {
  if (!sprite) return
  if (!baseAnimationSpeedBySprite.has(sprite)) {
    baseAnimationSpeedBySprite.set(sprite, sprite.animationSpeed)
  }
  const baseSpeed = baseAnimationSpeedBySprite.get(sprite) ?? sprite.animationSpeed
  sprite.animationSpeed = baseSpeed * factor
  if (factor === 1) baseAnimationSpeedBySprite.set(sprite, sprite.animationSpeed)
}

export function applyUnitWalkingAnimationSpeed(unit: UnitEntity, factor: number): void {
  if (unit.currentSheet !== SHEET_TYPES.walking) return
  const safeFactor = Math.max(0, Math.min(1, factor))
  applySpriteAnimationSpeed(unit.sprite, safeFactor)
  applySpriteAnimationSpeed(unit.shadow, safeFactor)
  for (const sprite of (unit as LayeredUnit).appearanceLayerSprites?.values() ?? []) {
    applySpriteAnimationSpeed(sprite, safeFactor)
  }
}
