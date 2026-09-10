import { degreeToDirection } from '../maths'
import type { AnimatedSprite } from 'pixi.js'

type Direction = 'south' | 'southwest' | 'west' | 'northwest' | 'north' | 'northeast' | 'east' | 'southeast'
export type DirectionOrder = Direction[]
export type TextureMap<TTexture = AnimatedSprite['textures'][number]> = Record<string, TTexture>

const THREE_DIRECTION_ORDER: DirectionOrder = ['north', 'west', 'south']
const FIVE_DIRECTION_ORDER: DirectionOrder = ['south', 'southwest', 'west', 'northwest', 'north']
const FOUR_DIRECTION_ORDER: DirectionOrder = ['north', 'west', 'south', 'east']
const EIGHT_DIRECTION_ORDER: DirectionOrder = [
  'south',
  'southwest',
  'west',
  'northwest',
  'north',
  'northeast',
  'east',
  'southeast',
]

function getSheetDirectionOrder<TTexture>(
  textures: TextureMap<TTexture>,
  directionCount: number | null,
  explicitOrder: DirectionOrder | string[] | null = null
): DirectionOrder | null {
  const frameCount = Object.keys(textures).length

  if (explicitOrder?.length) {
    return explicitOrder as DirectionOrder
  }
  if (directionCount === 1) {
    return null
  }
  if (directionCount === 8) {
    return EIGHT_DIRECTION_ORDER
  }
  if (directionCount === 5) {
    return FIVE_DIRECTION_ORDER
  }
  if (directionCount === 4) {
    return FOUR_DIRECTION_ORDER
  }
  if (directionCount === 3) {
    return THREE_DIRECTION_ORDER
  }
  if (frameCount % 5 === 0) {
    return FIVE_DIRECTION_ORDER
  }
  if (frameCount % 8 === 0) {
    return EIGHT_DIRECTION_ORDER
  }
  return null
}

export function getAnimationFrames<TTexture>(
  textures: TextureMap<TTexture>,
  direction?: Direction,
  directionCount: number | null = null,
  directionOrderOverride: DirectionOrder | string[] | null = null
): TTexture[] {
  const frames = getSortedFrames(textures)

  if (!direction) {
    return frames
  }

  const directionOrder = getSheetDirectionOrder(textures, directionCount, directionOrderOverride)
  if (!directionOrder) {
    return frames
  }
  const framesPerDirection = frames.length / directionOrder.length
  const directionIndex = directionOrder.indexOf(direction)

  if (directionIndex < 0) {
    throw new Error(`Unknown direction: ${direction}`)
  }

  const start = directionIndex * framesPerDirection
  const end = start + framesPerDirection

  return frames.slice(start, end)
}

export function getSpriteFrameSelection<TTexture>(
  textures: TextureMap<TTexture>,
  degree: number,
  directionCount: number | null = null,
  directionOrderOverride: DirectionOrder | string[] | null = null
): { textures: TTexture[]; mirrored: boolean } {
  const frames = getSortedFrames(textures)
  const direction = (degreeToDirection(degree) ?? 'south') as Direction

  if (directionCount === 1) {
    return {
      textures: getAnimationFrames(textures, 'south', directionCount, directionOrderOverride),
      mirrored: false,
    }
  }

  if (directionCount === 9) {
    const { frameIndex, mirrored } = getMirroredHalfArcFrameIndex(degree, directionCount)
    const framesPerDirection = Math.max(1, Math.floor(frames.length / directionCount))
    const start = frameIndex * framesPerDirection
    return {
      textures: frames.slice(start, start + framesPerDirection),
      mirrored,
    }
  }

  const directionOrder = getSheetDirectionOrder(textures, directionCount, directionOrderOverride)

  const cardinalDirections: Partial<Record<Direction, Direction>> = {
    northwest: 'north',
    northeast: 'north',
    southwest: 'south',
    southeast: 'south',
  }
  const mirroredDirections: Partial<Record<Direction, Direction>> = {
    southeast: 'southwest',
    northeast: 'northwest',
    east: 'west',
  }
  let spriteDirection = direction
  let mirrored = false
  if (directionOrder?.length === 3 || directionOrder?.length === 4) {
    spriteDirection = cardinalDirections[direction] ?? direction
    mirrored = directionOrder.length === 3 && spriteDirection === 'east'
    if (mirrored) spriteDirection = 'west'
  } else if (directionOrder?.length !== 8) {
    const replacement = mirroredDirections[direction]
    if (replacement) {
      spriteDirection = replacement
      mirrored = true
    }
  }

  return {
    textures: getAnimationFrames(textures, spriteDirection, directionCount, directionOrderOverride),
    mirrored,
  }
}

export function getMirroredHalfArcFrameIndex(
  degree: number,
  frameCount: number
): { frameIndex: number; mirrored: boolean } {
  const normalizedDegree = ((degree % 360) + 360) % 360
  const mirrored = normalizedDegree > 90 && normalizedDegree < 270
  const halfArcDegree = mirrored
    ? 270 - normalizedDegree
    : normalizedDegree >= 270
      ? normalizedDegree - 270
      : normalizedDegree + 90
  const maxIndex = Math.max(frameCount - 1, 0)
  const step = maxIndex > 0 ? 180 / maxIndex : 180
  const frameIndex = Math.max(0, Math.min(maxIndex, Math.round(halfArcDegree / step)))

  return { frameIndex, mirrored }
}

function getSortedFrames<TTexture>(textures: TextureMap<TTexture>): TTexture[] {
  return Object.entries(textures)
    .sort(([a], [b]) => parseInt(a.split('_')[0] ?? '', 10) - parseInt(b.split('_')[0] ?? '', 10))
    .map(([, texture]) => texture)
}
