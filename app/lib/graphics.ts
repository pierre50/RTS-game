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
// SHEETS). These are local frame indices inside that sliced direction, found by
// inspecting the source equipment-overlay spritesheets frame-by-frame for when
// the weapon/projectile actually connects/releases. Lasso leaves the hand
// earlier; bow holds and releases on the final, fully extended pose.
export const SLASH_IMPACT_FRAME = 5
export const BOW_SHOOT_RELEASE_FRAME = 8
export const LASSO_SHOOT_RELEASE_FRAME = 5
