export * from './graphics/assets'
export * from './graphics/colors'
export * from './graphics/canvas'
export * from './graphics/selection'
export * from './graphics/textures'

type FrameChangeSprite = {
  onFrameChange?: (currentFrame: number) => void
}

// Fires `cb` once per animation loop, on the first frame-change where
// `currentFrame` reaches or passes `frame` — every loop, including the very
// first one (1>2>3>4 → BOOM → 5>6>7>8 → wraps → 1>2>3>4 → BOOM again). Uses
// `>=` rather than `===` so a slow render tick that jumps straight past the
// target frame still fires exactly once; `firedThisLoop` resets once the
// sprite wraps back below `frame` at the start of the next loop. Overwrites
// any previous `onFrameChange` registration rather than composing with it,
// since callers re-invoke this every time an action restarts (e.g.
// re-targeting) and the action/dying/corpse sheets are never auto-cleared
// between those restarts (see setUnitTexture in app/lib/extra.ts) — composing
// would otherwise stack stale handlers indefinitely.
export function onSpriteLoopAtFrame(sprite: FrameChangeSprite, frame: number, cb: () => void): void {
  let firedThisLoop = false
  sprite.onFrameChange = currentFrame => {
    if (currentFrame < frame) {
      firedThisLoop = false
      return
    }
    if (firedThisLoop) return
    firedThisLoop = true
    cb()
  }
}

// Baked LPC action sheets are per-direction slices (scripts/lpc/config.py
// SHEETS). These are the in-loop frame where the weapon/projectile actually
// connects/releases, found by inspecting the source equipment-overlay
// spritesheets frame-by-frame for when the weapon/arrow is at full extension.
export const SLASH_IMPACT_FRAME = 1
export const THRUST_RELEASE_FRAME = 3
export const SHOOT_RELEASE_FRAME = 5

type RateSyncedSprite = {
  textures: unknown[]
  animationSpeed: number
}

// Sets the sprite's playback speed so its current (already direction-sliced)
// animation loop takes exactly `1 / ratePerSecond` seconds — i.e. the visual
// swing/draw/gather cycle IS the gameplay tick, instead of a second timer
// running alongside an animation with an unrelated, fixed playback speed.
export function syncAnimationSpeedToRate(sprite: RateSyncedSprite, ratePerSecond: number): void {
  const framesPerLoop = sprite.textures.length || 1
  sprite.animationSpeed = (framesPerLoop * Math.max(ratePerSecond, 0.001)) / 60
}
