import { onSpriteLoopAtFrame } from '../lib/graphics'
import { runAfterDeathFlash } from '../lib/entities/deathFlash'
import type { EnergyEntity, UnitEntity } from '../types/entities'

export type AnimationSnapshot = {
  frame: number
  loop: boolean
  playing: boolean
  callbacks: {
    onComplete?: () => void
    onFrameChange?: (frame: number) => void
    onLoop?: () => void
  }
}

/** Animation events used by actions, independent of the rendering engine. */
export interface UnitAnimation {
  readonly canSignalLoop: boolean
  readonly currentFrame: number | undefined
  readonly frameCount: number
  readonly playing: boolean
  captureSnapshot(): AnimationSnapshot
  clearCallbacks(): void
  clearCompleteCallback(): void
  clearFrameCallback(): void
  clearLoopCallback(): void
  onLoop(callback: () => void): void
  onComplete(callback: () => void): void
  onDeathComplete(callback: () => void): void
  onFrameEachLoop(frame: number, callback: () => void): void
  play(): void
  restart(): void
  restoreCallbacks(snapshot: AnimationSnapshot): void
  seek(frame: number, play: boolean): void
  setLoop(loop: boolean): void
  setSpeed(speed: number): void
  stop(): void
}

/** Existing test doubles still expose a sprite while they move to the port. */
export function getUnitAnimation(unit: UnitEntity): UnitAnimation | null {
  if (unit.visualAnimation) return unit.visualAnimation
  const sprite = unit.sprite
  if (!sprite) return null
  return {
    get canSignalLoop() { return 'onLoop' in sprite },
    get currentFrame() { return sprite.currentFrame },
    get frameCount() { return sprite.textures?.length ?? 0 },
    get playing() { return Boolean(sprite.playing) },
    captureSnapshot() {
      return {
        frame: Math.max(0, Math.floor(sprite.currentFrame ?? 0)),
        loop: sprite.loop,
        playing: Boolean(sprite.playing),
        callbacks: {
          onComplete: sprite.onComplete,
          onFrameChange: sprite.onFrameChange,
          onLoop: sprite.onLoop,
        },
      }
    },
    clearCallbacks() { sprite.onLoop = undefined; sprite.onFrameChange = undefined },
    clearCompleteCallback() { sprite.onComplete = undefined },
    clearFrameCallback() { sprite.onFrameChange = undefined },
    clearLoopCallback() { sprite.onLoop = undefined },
    onLoop(callback) { sprite.onLoop = callback },
    onComplete(callback) { sprite.onComplete = callback },
    onDeathComplete(callback) { sprite.onComplete = runAfterDeathFlash(sprite, callback) },
    onFrameEachLoop(frame, callback) { onSpriteLoopAtFrame(sprite, frame, callback) },
    play() { sprite.play?.() },
    restart() { sprite.gotoAndPlay?.(0) },
    restoreCallbacks(snapshot) {
      sprite.onComplete = snapshot.callbacks.onComplete
      sprite.onFrameChange = snapshot.callbacks.onFrameChange
      sprite.onLoop = snapshot.callbacks.onLoop
    },
    seek(frame, play) {
      if (play) sprite.gotoAndPlay?.(frame)
      else if (sprite.gotoAndStop) sprite.gotoAndStop(frame)
      else sprite.currentFrame = frame
    },
    setLoop(loop) {
      sprite.loop = loop
      if (unit.shadow) unit.shadow.loop = loop
      const layers = (unit as UnitEntity & { appearanceLayerSprites?: Map<number, { loop: boolean }> })
        .appearanceLayerSprites
      for (const layer of layers?.values() ?? []) layer.loop = loop
    },
    setSpeed(speed) { sprite.animationSpeed = speed },
    stop() { sprite.stop?.() },
  }
}

/** Shared combat and energy systems also run for animals. */
export function getEntityAnimation(entity: EnergyEntity): UnitAnimation | null {
  return getUnitAnimation(entity as UnitEntity)
}
