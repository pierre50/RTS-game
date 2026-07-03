import type { AnimatedSprite } from 'pixi.js'

export type InteractiveSprite = AnimatedSprite & {
  allowMove?: boolean
  allowClick?: boolean
  label?: string
  onComplete?: () => void
}
