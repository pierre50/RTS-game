import { entityHudAnchor, type EntityHudAnchorSource } from '../EntityHudAnchor'

type PixiHudAnchorHost = EntityHudAnchorSource & {
  reliefLift?: number | null
  displayObject?: { x: number; y: number }
}

/** HUD children live in the entity container; reliefLift is Pixi's projected terrain offset. */
export function pixiHudLocalPosition(
  host: PixiHudAnchorHost,
  visualTopY: number,
  offsetX = 0,
  offsetY = 0
): { x: number; y: number } {
  const anchor = entityHudAnchor(host)
  const display = host.displayObject ?? host
  return {
    x: anchor.position.x - (display.x ?? anchor.position.x) + offsetX,
    y: anchor.position.y - (display.y ?? anchor.position.y) + visualTopY + (host.reliefLift ?? 0) + offsetY,
  }
}
