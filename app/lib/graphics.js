export * from './graphics/assets'
export * from './graphics/colors'
export * from './graphics/canvas'
export * from './graphics/selection'
export * from './graphics/textures'

export function onSpriteLoopAtFrame(sprite, frame, cb) {
  const prev = sprite.onFrameChange
  sprite.onFrameChange = currentFrame => {
    prev?.(currentFrame)
    if (currentFrame === frame) cb()
  }
}
