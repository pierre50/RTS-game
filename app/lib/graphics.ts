export * from './graphics/assets'
export * from './graphics/colors'
export * from './graphics/canvas'
export * from './graphics/selection'
export * from './graphics/textures'

type FrameChangeSprite = {
  onFrameChange?: (currentFrame: number) => void
}

export function onSpriteLoopAtFrame(sprite: FrameChangeSprite, frame: number, cb: () => void): void {
  const prev = sprite.onFrameChange
  sprite.onFrameChange = currentFrame => {
    prev?.(currentFrame)
    if (currentFrame === frame) cb()
  }
}
