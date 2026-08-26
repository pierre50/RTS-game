import { AnimatedSprite, Assets, Graphics, type Texture } from 'pixi.js'
import {
  degreeToDirection,
  degreesToRadians,
  getArcHeightForDistance,
  getArcProgressOffset,
  pointsDistance,
} from '../lib/maths'
import { bindAnimatedSpriteToTicker, getAnimationFrames, getMirroredHalfArcFrameIndex } from '../lib/entities/spriteTextures'
import { LABEL_TYPES } from '../constants'
import { getShadowsEnabled } from '../lib/audio/settings'
import type { GameContextLike } from '../types/context'
import type { Point } from '../types/grid'
import {
  EMBEDDED_MASK_PROJECTILE_TYPES,
  EMBEDDED_MASK_SIZE,
  EMBEDDED_PARALLEL_CUT_THRESHOLD,
  EMBEDDED_TIP_DEPTH,
  GROUND_EMBED_DEPTH,
  PROJECTILE_SHADOW_ALPHA,
  PROJECTILE_SHADOW_MAX_ALTITUDE_FADE,
  PROJECTILE_SHADOW_MAX_ALTITUDE_SCALE,
  PROJECTILE_SHADOW_SCALE_Y,
  TREE_EMBED_DEPTH,
  applyTextureAnchor,
  clipPolygonWithHalfPlane,
  getDirectionalAnimation,
  getDirectionalFrameIndex,
  getSortedTextureNames,
  type ProjectileTexture,
} from './ProjectileGeometry'

export type RuntimeProjectileVisual = {
  animationSpeed?: number
  assets: string
  context: GameContextLike
  currentAltitude: number
  degree?: number
  destinationPoint: Point
  directionalAnimationFrames?: number
  directionalFrameOrder?: string[]
  directionalFrames?: number
  embeddedMask?: Graphics | null
  fullCircleStartDegree?: number
  groundOrigin: Point
  impactEffect?: { assets: string; animationSpeed?: number; scale?: number }
  isAnimated?: boolean
  owner?: { zIndex?: number }
  projectileScale?: number
  rotateSprite?: boolean
  size: number
  spawnOrigin: Point
  sprite?: ProjectileSprite
  spriteBaseAngle?: number
  staticDirectionalAnimationFrame?: number
  staticFrame?: number
  shadow?: ProjectileSprite
  totalDistance: number
  trajectory?: { kind: string; minArcHeight?: number; arcHeightFactor?: number; maxArcHeight?: number }
  trajectoryState: { kind: string; arcHeight: number } | null
  type: string
  x: number
  y: number
  zIndex?: number
  addChild(...children: unknown[]): unknown
  getProjectileScale(): number
  updateShadowVisual(progress: number): void
}

export type ProjectileSprite = AnimatedSprite
export type EmbeddedMaskKind = 'ground' | 'tree'

const EMBED_DEPTH_JITTER = 3

export function createShadowSprite(projectile: RuntimeProjectileVisual, source: ProjectileSprite): ProjectileSprite {
  const shadow = new AnimatedSprite(source.textures as Texture[]) as ProjectileSprite
  bindAnimatedSpriteToTicker(shadow, projectile.context.app)
  shadow.label = LABEL_TYPES.shadow
  shadow.eventMode = 'none'
  shadow.roundPixels = true
  shadow.tint = 0x000000
  shadow.alpha = PROJECTILE_SHADOW_ALPHA
  shadow.visible = getShadowsEnabled()
  shadow.animationSpeed = source.animationSpeed
  shadow.loop = source.loop
  shadow.anchor.set(source.anchor.x, source.anchor.y)
  shadow.rotation = source.rotation
  shadow.scale.set(source.scale.x, source.scale.y * PROJECTILE_SHADOW_SCALE_Y)
  if (source.playing) {
    shadow.gotoAndPlay(source.currentFrame)
  } else {
    shadow.gotoAndStop(source.currentFrame)
  }
  return shadow
}

export function createSprite(projectile: RuntimeProjectileVisual, degree: number): ProjectileSprite {
  const spritesheet = Assets.cache.get(projectile.assets)
  if (!spritesheet) {
    throw new Error(`Missing projectile spritesheet for ${projectile.type} (${projectile.assets})`)
  }
  const textureNames = getSortedTextureNames(spritesheet.textures)

  if (projectile.isAnimated) {
    const textures = textureNames.map(name => spritesheet.textures[name])
    const directionalAnimation = getDirectionalAnimation(projectile, textures, degree)
    const sprite = new AnimatedSprite(directionalAnimation?.textures ?? textures) as ProjectileSprite
    bindAnimatedSpriteToTicker(sprite, projectile.context.app)
    sprite.updateAnchor = true

    if (directionalAnimation) {
      const staticFrame = projectile.staticDirectionalAnimationFrame
      const frameIndex = Number.isInteger(staticFrame)
        ? Math.max(0, Math.min(staticFrame as number, directionalAnimation.textures.length - 1))
        : 0
      applyTextureAnchor(sprite, directionalAnimation.textures[frameIndex])
      const scale = projectile.getProjectileScale()
      sprite.scale.set(directionalAnimation.mirrored ? -scale : scale, scale)
      if (Number.isInteger(staticFrame)) {
        sprite.gotoAndStop(frameIndex)
      } else {
        sprite.animationSpeed = projectile.animationSpeed ?? 0.4
        sprite.play()
      }
    } else if (projectile.directionalFrames) {
      if (
        typeof projectile.directionalFrames === 'number' &&
        projectile.directionalFrames > 8 &&
        !projectile.directionalFrameOrder
      ) {
        if (projectile.fullCircleStartDegree != null) {
          const normalizedDeg = (((degree - projectile.fullCircleStartDegree) % 360) + 360) % 360
          const degPerFrame = 360 / textures.length
          const frameIndex = Math.round(normalizedDeg / degPerFrame) % textures.length
          applyTextureAnchor(sprite, textures[frameIndex])
          sprite.gotoAndStop(frameIndex)
        } else {
          const { frameIndex, mirrored } = getMirroredHalfArcFrameIndex(degree, textures.length)
          const clampedIndex = Math.min(frameIndex, textures.length - 1)
          applyTextureAnchor(sprite, textures[clampedIndex])
          sprite.gotoAndStop(clampedIndex)
          const scale = projectile.getProjectileScale()
          sprite.scale.set(mirrored ? scale : -scale, scale)
        }
      } else {
        const direction = degreeToDirection(degree)
        const frameIndex = Math.min(getDirectionalFrameIndex(projectile, direction as string), textures.length - 1)
        applyTextureAnchor(sprite, textures[frameIndex])
        sprite.gotoAndStop(frameIndex)
      }
    } else if (projectile.rotateSprite) {
      const frameIndex = projectile.staticFrame ?? 0
      const baseAngle = projectile.spriteBaseAngle ?? 180
      applyTextureAnchor(sprite, textures[frameIndex])
      sprite.gotoAndStop(frameIndex)
      sprite.rotation = degreesToRadians(degree - baseAngle)
    } else {
      applyTextureAnchor(sprite, textures[0])
      sprite.animationSpeed = projectile.animationSpeed ?? 0.4
      sprite.play()
    }

    return sprite
  }

  let textureName = textureNames[0]
  if (projectile.directionalFrames) {
    if (
      typeof projectile.directionalFrames === 'number' &&
      projectile.directionalFrames > 8 &&
      !projectile.directionalFrameOrder
    ) {
      const frameCount = textureNames.length
      const { frameIndex, mirrored } = getMirroredHalfArcFrameIndex(degree, frameCount)
      textureName = textureNames[Math.min(frameIndex, textureNames.length - 1)]
      const texture = spritesheet.textures[textureName]
      const sprite = new AnimatedSprite([texture]) as ProjectileSprite
      bindAnimatedSpriteToTicker(sprite, projectile.context.app)
      sprite.updateAnchor = true
      applyTextureAnchor(sprite, texture)
      sprite.animationSpeed = 0
      sprite.play()
      const scale = projectile.getProjectileScale()
      sprite.scale.set(mirrored ? -scale : scale, scale)
      return sprite
    }

    const direction = degreeToDirection(degree)
    const frameIndex = getDirectionalFrameIndex(projectile, direction as string)
    textureName = textureNames[Math.min(frameIndex, textureNames.length - 1)]
  }
  const texture = spritesheet.textures[textureName]
  const sprite = new AnimatedSprite([texture]) as ProjectileSprite
  bindAnimatedSpriteToTicker(sprite, projectile.context.app)
  sprite.updateAnchor = true
  applyTextureAnchor(sprite, texture)
  sprite.animationSpeed = 0
  sprite.play()
  const scale = projectile.getProjectileScale()
  if (scale !== 1) {
    sprite.scale.set(scale)
  }
  if (projectile.rotateSprite) {
    sprite.rotation = degreesToRadians(degree)
  }
  return sprite
}

export function createTrajectoryState(projectile: RuntimeProjectileVisual): { kind: string; arcHeight: number } | null {
  if (projectile.trajectory?.kind !== 'arc') {
    return null
  }

  return {
    kind: 'arc',
    arcHeight: getArcHeightForDistance(projectile.totalDistance, projectile.trajectory),
  }
}

export function updateTrajectoryVisual(projectile: RuntimeProjectileVisual): void {
  if (!projectile.sprite) {
    return
  }

  const { spawnOrigin } = projectile
  const traveledDistance = pointsDistance(spawnOrigin.x, spawnOrigin.y, projectile.x, projectile.y)
  const progress = Math.max(0, Math.min(1, traveledDistance / projectile.totalDistance))
  projectile.sprite.y = projectile.trajectoryState
    ? -getArcProgressOffset(progress, projectile.trajectoryState.arcHeight)
    : 0
  const groundY = projectile.groundOrigin.y + (projectile.destinationPoint.y - projectile.groundOrigin.y) * progress
  projectile.currentAltitude = Math.max(0, groundY - (projectile.y + projectile.sprite.y))
  projectile.updateShadowVisual(progress)
}

export function updateShadowVisual(projectile: RuntimeProjectileVisual, progress: number): void {
  if (!projectile.shadow || !projectile.sprite) return
  projectile.shadow.visible = getShadowsEnabled()
  if (!projectile.shadow.visible) return

  const groundX = projectile.groundOrigin.x + (projectile.destinationPoint.x - projectile.groundOrigin.x) * progress
  const groundY = projectile.groundOrigin.y + (projectile.destinationPoint.y - projectile.groundOrigin.y) * progress
  const altitudeRatio = Math.max(0, Math.min(1, projectile.currentAltitude / 180))
  const scaleBoost = 1 + altitudeRatio * PROJECTILE_SHADOW_MAX_ALTITUDE_SCALE

  projectile.shadow.x = groundX - projectile.x
  projectile.shadow.y = groundY - projectile.y
  projectile.shadow.alpha = PROJECTILE_SHADOW_ALPHA - altitudeRatio * PROJECTILE_SHADOW_MAX_ALTITUDE_FADE
  projectile.shadow.rotation = projectile.sprite.rotation
  projectile.shadow.scale.set(
    projectile.sprite.scale.x * scaleBoost,
    projectile.sprite.scale.y * PROJECTILE_SHADOW_SCALE_Y * scaleBoost
  )
}

export function createImpactEffect(projectile: RuntimeProjectileVisual, x: number, y: number): void {
  if (!projectile.impactEffect?.assets) return

  const spritesheet = Assets.cache.get(projectile.impactEffect.assets)
  if (!spritesheet) return

  const sprite = new AnimatedSprite(getAnimationFrames(spritesheet.textures) as Texture[]) as ProjectileSprite
  bindAnimatedSpriteToTicker(sprite, projectile.context.app)
  sprite.updateAnchor = true
  sprite.label = LABEL_TYPES.sprite
  sprite.eventMode = 'none'
  sprite.roundPixels = true
  sprite.loop = false
  sprite.x = x
  sprite.y = y
  sprite.zIndex = (projectile.zIndex ?? projectile.owner?.zIndex ?? 0) + 1
  applyTextureAnchor(sprite, sprite.textures[0] as ProjectileTexture)
  sprite.scale.set(projectile.impactEffect.scale ?? 1)
  sprite.animationSpeed = projectile.impactEffect.animationSpeed ?? 0.3
  sprite.onComplete = () => {
    sprite.parent?.removeChild(sprite)
    sprite.destroy({ children: true, texture: false })
  }
  projectile.context.map.addChild(sprite)
  sprite.play()
}

export function canUseEmbeddedMask(projectile: RuntimeProjectileVisual): boolean {
  return EMBEDDED_MASK_PROJECTILE_TYPES.has(projectile.type)
}

export function getEmbeddedMaskJitter(projectile: RuntimeProjectileVisual): number {
  const seed = Math.abs(Math.round(projectile.x * 13 + projectile.y * 17 + (projectile.degree ?? 0) * 7))
  return (seed % (EMBED_DEPTH_JITTER * 2 + 1)) - EMBED_DEPTH_JITTER
}

export function applyEmbeddedMask(projectile: RuntimeProjectileVisual, kind: EmbeddedMaskKind): void {
  if (!projectile.sprite || !canUseEmbeddedMask(projectile)) return

  if (projectile.embeddedMask) {
    projectile.sprite.mask = null
    projectile.embeddedMask.destroy()
    projectile.embeddedMask = null
  }

  const mask = new Graphics()
  mask.label = `${kind}-embedded-mask`
  mask.eventMode = 'none'

  const maxScale = Math.max(1, Math.abs(projectile.sprite.scale.x), Math.abs(projectile.sprite.scale.y))
  const size = EMBEDDED_MASK_SIZE * maxScale
  const half = size / 2
  const travelX = projectile.destinationPoint.x - projectile.spawnOrigin.x
  const travelY = projectile.destinationPoint.y - projectile.spawnOrigin.y
  const travelLength = Math.max(1, Math.hypot(travelX, travelY))
  const unitX = travelX / travelLength
  const unitY = travelY / travelLength
  const spriteLength = Math.max(projectile.sprite.texture.width, projectile.sprite.texture.height) * maxScale
  const tipX = unitX * (spriteLength / 2)
  const tipY = projectile.sprite.y + unitY * (spriteLength / 2)
  const depth = (kind === 'ground' ? GROUND_EMBED_DEPTH : TREE_EMBED_DEPTH) + getEmbeddedMaskJitter(projectile)
  let polygon: Point[] = [
    { x: -half, y: -half },
    { x: half, y: -half },
    { x: half, y: half },
    { x: -half, y: half },
  ]

  if (kind === 'ground') {
    const direction = travelY >= 0 ? 1 : -1
    const cutY = tipY - direction * depth
    polygon = clipPolygonWithHalfPlane(polygon, {
      normalX: 0,
      normalY: direction,
      limit: direction * cutY,
    })
    if (Math.abs(unitY) < EMBEDDED_PARALLEL_CUT_THRESHOLD) {
      polygon = clipPolygonWithHalfPlane(polygon, {
        normalX: unitX,
        normalY: unitY,
        limit: tipX * unitX + tipY * unitY - EMBEDDED_TIP_DEPTH,
      })
    }
  } else {
    const direction = travelX >= 0 ? 1 : -1
    const cutX = tipX - direction * depth
    polygon = clipPolygonWithHalfPlane(polygon, {
      normalX: direction,
      normalY: 0,
      limit: direction * cutX,
    })
    if (Math.abs(unitX) < EMBEDDED_PARALLEL_CUT_THRESHOLD) {
      polygon = clipPolygonWithHalfPlane(polygon, {
        normalX: unitX,
        normalY: unitY,
        limit: tipX * unitX + tipY * unitY - EMBEDDED_TIP_DEPTH,
      })
    }
  }

  if (polygon.length < 3) {
    mask.destroy()
    return
  }

  mask.poly(polygon.flatMap(point => [point.x, point.y]))
  mask.fill({ color: 0xffffff })
  projectile.addChild(mask)
  projectile.sprite.mask = mask
  projectile.embeddedMask = mask
}
