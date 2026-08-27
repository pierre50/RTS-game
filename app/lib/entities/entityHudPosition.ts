import { FAMILY_TYPES } from '../constants'

type HudPositionHost = {
  family?: string
  sprite?: {
    anchor?: { y?: number }
    height?: number
    scale?: { y?: number }
  }
  spriteScale?: number
  type?: string
}

const UNIT_VISUAL_TOP_OFFSET = 42
const DEFAULT_ANIMAL_VISUAL_TOP_OFFSET = 36
const ANIMAL_VISUAL_TOP_OFFSETS: Record<string, number> = {
  BlackGrouse: 34,
  Boar: 31,
  Deer: 40,
  Fox: 35,
  Hare: 35,
  Horse: 49,
  Wolf: 54,
}

function getSpriteScale(host: HudPositionHost): number {
  const spriteScale = Math.abs(host.sprite?.scale?.y ?? host.spriteScale ?? 1)
  return Number.isFinite(spriteScale) && spriteScale > 0 ? spriteScale : 1
}

function getFrameTopOffset(host: HudPositionHost): number {
  const height = host.sprite?.height
  if (typeof height !== 'number' || !Number.isFinite(height)) return 40
  return height * (host.sprite?.anchor?.y ?? 1)
}

function getEntityVisualTopOffset(host: HudPositionHost): number {
  if (host.family === FAMILY_TYPES.unit) return Math.round(UNIT_VISUAL_TOP_OFFSET * getSpriteScale(host))
  if (host.family === FAMILY_TYPES.animal) {
    const topOffset = host.type ? ANIMAL_VISUAL_TOP_OFFSETS[host.type] : undefined
    return Math.round((topOffset ?? DEFAULT_ANIMAL_VISUAL_TOP_OFFSET) * getSpriteScale(host))
  }
  return getFrameTopOffset(host)
}

export function getEntityHudTopY(host: HudPositionHost, yOffset = 0): number {
  return -getEntityVisualTopOffset(host) - yOffset
}
