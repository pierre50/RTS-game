import { setHeroGameCursorEnabled } from '../lib/hero/heroCursor'
import type Controls from './Controls'
export type TickerLike = { elapsedMS?: number; deltaMS?: number; deltaTime: number }
const MAX_CAMERA_FRAME_SCALE = 3
const TARGET_FRAME_MS = 1000 / 60

export function onTick(controls: Controls, ticker: TickerLike): void {
  if (!controls.runtimeInputEnabled) {
    setHeroGameCursorEnabled(false)
    return
  }
  setHeroGameCursorEnabled(controls.isHeroControlActive() && !controls.isInGameMenuOpen())
  const gameFrameScale = (ticker.deltaMS ?? ticker.deltaTime * TARGET_FRAME_MS) / TARGET_FRAME_MS
  if (controls.isInteractionBlocked()) {
    controls.heroController.updateCriticalHealthEffects(TARGET_FRAME_MS * gameFrameScale, false)
    controls.heroController.updateOcclusionFade(TARGET_FRAME_MS * gameFrameScale, false)
    controls.cancelActiveInteraction()
    return
  }

  const frameScale = Math.min(
    (ticker.elapsedMS ?? ticker.deltaTime * TARGET_FRAME_MS) / TARGET_FRAME_MS,
    MAX_CAMERA_FRAME_SCALE
  )

  if (controls.isHeroControlActive()) {
    controls.gamepadInput.update()
    controls.heroController.update(gameFrameScale)
    if (controls.freeCameraActive) {
      controls.panCameraWithArrowKeys(frameScale)
    } else {
      const cameraCenter = controls.getHeroCameraCenter()
      if (cameraCenter) controls.cameraController.set(cameraCenter.x, cameraCenter.y, false, false)
    }
    if (controls.mouseBuilding || controls.rallyPointController.active) {
      controls.mouseBuilding
        ? controls.buildingPlacer.handleMouseMove()
        : controls.rallyPointController.handleMouseMove()
    }
    return
  }

  controls.heroController.updateCriticalHealthEffects(TARGET_FRAME_MS * gameFrameScale, false)
  controls.heroController.updateOcclusionFade(TARGET_FRAME_MS * gameFrameScale, false)
  controls.cameraController.updateMouseMove(frameScale)
  controls.panCameraWithArrowKeys(frameScale)
}
