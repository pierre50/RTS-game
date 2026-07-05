import type { AnimatedSprite } from 'pixi.js'

export type InteractiveSprite = AnimatedSprite & {
  label?: string
  onComplete?: () => void
}
