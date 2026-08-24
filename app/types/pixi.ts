import type { AnimatedSprite, Texture } from 'pixi.js'

export type InteractiveSprite = AnimatedSprite & {
  label?: string
  onComplete?: () => void
}

export type AssetAge = number | string | null | undefined

export type HitAreaLike = object | null

type TextureFrameData = {
  hitArea?: HitAreaLike
}

type TextureMapLike<TTexture = Texture> = Record<string, TTexture>

export type SpritesheetLike<TTexture = Texture> = {
  data?: {
    animationSpeed?: number
    frames?: Record<string, TextureFrameData>
    loop?: boolean
  }
  textures: TextureMapLike<TTexture>
}
