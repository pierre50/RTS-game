import type { AnimatedSprite } from 'pixi.js'
import {
  degreeToDirection,
  getMirroredHalfArcFrameIndex,
  getReliefOffset,
  isHeroControlled,
  pointsDistance,
} from '../lib'
import { CELL_HEIGHT, CELL_WIDTH, FAMILY_TYPES } from '../constants'
import { debugLog } from '../lib/debug'
import type { Texture } from 'pixi.js'
import type { RuntimeEntity, UnitEntity } from '../types/entities'
import type { Point } from '../types/grid'

const DIRECTIONAL_FRAME_INDEX: Record<string, number> = {
  south: 0,
  southwest: 1,
  west: 2,
  northwest: 3,
  north: 4,
  northeast: 5,
  east: 6,
  southeast: 7,
}

export const PROJECTILE_SHADOW_ALPHA = 0.42
export const PROJECTILE_SHADOW_MAX_ALTITUDE_FADE = 0.28
export const PROJECTILE_SHADOW_MAX_ALTITUDE_SCALE = 0.35
export const PROJECTILE_SHADOW_SCALE_Y = 0.48
export const PROJECTILE_CELL_DISTANCE = Math.hypot(CELL_WIDTH, CELL_HEIGHT)
export const PROJECTILE_SLOWDOWN_START = 0.65
export const PROJECTILE_MIN_SPEED_FACTOR = 0.18
export const PROJECTILE_MIN_DAMAGE_FACTOR = 0.35
export const PROJECTILE_COLLISION_SCALE = 0.35
export const TREE_STICK_JITTER = 5
export const TREE_STICK_HEIGHT = 10
export const EMBEDDED_MASK_PROJECTILE_TYPES = new Set([
  'Arrow',
  'ArrowCeramic',
  'ArrowCopper',
  'ArrowBronze',
  'ArrowIron',
])
export const EMBEDDED_MASK_SIZE = 256
export const GROUND_EMBED_DEPTH = 5
export const TREE_EMBED_DEPTH = 4
export const EMBEDDED_TIP_DEPTH = 9
export const EMBEDDED_PARALLEL_CUT_THRESHOLD = 0.35

const PROJECTILE_GEOMETRY_DEBUG_THROTTLE_MS = 250
const PROJECTILE_GEOMETRY_DEBUG = false
let lastProjectileGeometryLogAt = 0

type RuntimeProjectileGeometry = {
  directionalFrameOrder?: string[]
  directionalAnimationFrames?: number
  fullCircleStartDegree?: number
}

export type ProjectileTexture = Texture & { defaultAnchor?: { x: number; y: number } }

type HalfPlane = {
  normalX: number
  normalY: number
  limit: number
}

type DebugProjectile = {
  owner: RuntimeEntity
  type: string
  spawnPoint?: Point
  spawnOrigin: Point
  target?: RuntimeEntity
  destination?: Point
  maxDistance?: number
  totalDistance: number
}

function halfPlaneValue(point: Point, plane: HalfPlane): number {
  return point.x * plane.normalX + point.y * plane.normalY
}

export function clipPolygonWithHalfPlane(polygon: Point[], plane: HalfPlane): Point[] {
  const clipped: Point[] = []
  for (let index = 0; index < polygon.length; index++) {
    const current = polygon[index]
    const previous = polygon[(index + polygon.length - 1) % polygon.length]
    const currentValue = halfPlaneValue(current, plane)
    const previousValue = halfPlaneValue(previous, plane)
    const currentInside = currentValue <= plane.limit
    const previousInside = previousValue <= plane.limit

    if (currentInside !== previousInside) {
      const progress = (plane.limit - previousValue) / (currentValue - previousValue)
      clipped.push({
        x: previous.x + (current.x - previous.x) * progress,
        y: previous.y + (current.y - previous.y) * progress,
      })
    }
    if (currentInside) clipped.push(current)
  }
  return clipped
}

export function getProjectileVisualOffset(instance: RuntimeEntity | null | undefined): number {
  const mountedRiderY = instance?.getMountedRiderY?.()
  return typeof mountedRiderY === 'number' && Number.isFinite(mountedRiderY) ? mountedRiderY : getReliefOffset(instance)
}

export function getProjectileDestinationVisualDelta(projectile: {
  target?: RuntimeEntity
  destination?: Point
}): number {
  if (!projectile.target || !projectile.destination) return 0
  return getProjectileVisualOffset(projectile.target) - getReliefOffset(projectile.target)
}

export function getDirectionalFrameIndex(projectile: RuntimeProjectileGeometry, direction: string) {
  if (Array.isArray(projectile.directionalFrameOrder)) {
    const frameIndex = projectile.directionalFrameOrder.indexOf(direction)
    if (frameIndex >= 0) return frameIndex
  }
  return DIRECTIONAL_FRAME_INDEX[direction] ?? 0
}

export function getSortedTextureNames(textures: Record<string, Texture>) {
  return Object.keys(textures).sort((a, b) => {
    const na = parseInt(a.split('_')[0], 10)
    const nb = parseInt(b.split('_')[0], 10)
    return na - nb
  })
}

export function debugProjectileGeometry(projectile: DebugProjectile, destinationPoint: Point): void {
  if (!PROJECTILE_GEOMETRY_DEBUG) return
  if (!projectile.type.includes('Arrow')) return
  const now = Date.now()
  if (now - lastProjectileGeometryLogAt < PROJECTILE_GEOMETRY_DEBUG_THROTTLE_MS) return
  lastProjectileGeometryLogAt = now
  const spawnSource = projectile.spawnPoint
    ? {
        x: Number(projectile.spawnPoint.x.toFixed(2)),
        y: Number(projectile.spawnPoint.y.toFixed(2)),
      }
    : {
        x: Number(projectile.spawnOrigin.x.toFixed(2)),
        y: Number(projectile.spawnOrigin.y.toFixed(2)),
      }
  const targetPoint = projectile.target ?? projectile.destination
  const targetLabel = targetPoint && 'label' in targetPoint ? targetPoint.label : undefined
  const targetType = targetPoint && 'type' in targetPoint ? targetPoint.type : undefined
  debugLog(PROJECTILE_GEOMETRY_DEBUG, '[projectile-arrow-geometry]', {
    ownerLabel: projectile.owner.label,
    ownerType: projectile.owner.type,
    ownerWork: (projectile.owner as UnitEntity).work,
    ownerFamily: projectile.owner.family,
    ownerIsHero: projectile.owner.family === FAMILY_TYPES.unit && isHeroControlled(projectile.owner as UnitEntity),
    projectileType: projectile.type,
    spawn: spawnSource,
    destinationRaw:
      projectile.destination == null && targetPoint == null
        ? null
        : {
            x: Number(targetPoint!.x.toFixed(2)),
            y: Number(targetPoint!.y.toFixed(2)),
          },
    targetLabel,
    targetType,
    destinationFinal: {
      x: Number(destinationPoint.x.toFixed(2)),
      y: Number(destinationPoint.y.toFixed(2)),
    },
    requestedMaxDistance: projectile.maxDistance == null ? null : Number(projectile.maxDistance.toFixed(2)),
    pathLengthTotal: Number(projectile.totalDistance.toFixed(2)),
    launchToTargetRawPx:
      targetPoint == null
        ? null
        : Number(pointsDistance(spawnSource.x, spawnSource.y, targetPoint.x, targetPoint.y).toFixed(2)),
  })
}

export function applyTextureAnchor(sprite: Pick<AnimatedSprite, 'anchor'>, texture?: ProjectileTexture) {
  const anchor = texture?.defaultAnchor
  if (
    anchor &&
    Number.isFinite(anchor.x) &&
    Number.isFinite(anchor.y) &&
    anchor.x >= 0 &&
    anchor.x <= 1 &&
    anchor.y >= 0 &&
    anchor.y <= 1
  ) {
    sprite.anchor.set(anchor.x, anchor.y)
    return
  }
  sprite.anchor.set(0.5, 0.5)
}

export function getDirectionalAnimation(projectile: RuntimeProjectileGeometry, textures: Texture[], degree: number) {
  const framesPerDirection = projectile.directionalAnimationFrames as number | undefined
  if (typeof framesPerDirection !== 'number' || !Number.isInteger(framesPerDirection) || framesPerDirection <= 0) {
    return null
  }

  const directionCount = Math.floor(textures.length / framesPerDirection)
  if (directionCount <= 0) return null

  let directionIndex
  let mirrored = false
  if (Array.isArray(projectile.directionalFrameOrder)) {
    const direction = degreeToDirection(degree)
    const orderedIndex = projectile.directionalFrameOrder.indexOf(direction as string)
    directionIndex = orderedIndex >= 0 ? Math.min(orderedIndex, directionCount - 1) : 0
  } else if (projectile.fullCircleStartDegree != null) {
    const normalizedDegree = (((degree - projectile.fullCircleStartDegree) % 360) + 360) % 360
    directionIndex = Math.round(normalizedDegree / (360 / directionCount)) % directionCount
  } else {
    const frame = getMirroredHalfArcFrameIndex(degree, directionCount)
    directionIndex = frame.frameIndex
    mirrored = frame.mirrored
  }

  const start = directionIndex * framesPerDirection
  return {
    textures: textures.slice(start, start + framesPerDirection),
    mirrored,
  }
}
