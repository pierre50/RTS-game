import { AnimatedSprite, Assets, Container, type Texture } from 'pixi.js'
import { BUILDING_TYPES, LABEL_TYPES } from '../../constants'
import { bindAnimatedSpriteToTicker, getAnimationFrames, getBuildingFootprintRadius } from '../../lib'
import type { EntityLightSourceConfig } from '../../types/entities'
import type { BuildingControllerHost } from '../../classes/building/BuildingTypes'
import { getPixiBuildingContainer } from './PixiBuildingContainer'

type LightedAnimatedSprite = AnimatedSprite & { lightSource?: EntityLightSourceConfig }

const BUILDING_FIRE_SHEETS = {
  light: { fireStart: 0, smokeStart: 0 },
  medium: { fireStart: 8, smokeStart: 8 },
  heavy: { fireStart: 16, smokeStart: 16 },
} as const

export type FireAnimation = keyof typeof BUILDING_FIRE_SHEETS
export const CAMPFIRE_DECORATION_LABEL = 'campfireDecorationFire'
export const CAMPFIRE_SMOKE_DECORATION_LABEL = 'campfireDecorationSmoke'
const BUILDING_FIRE_SMOKE_LABEL = 'buildingFireSmoke'
const BUILDING_FIRE_ANIMATION_FRAME_COUNT = 8
const BUILDING_FIRE_TEXTURES = { fire: 'effects/fire', smoke: 'effects/smoke' } as const

const CAMPFIRE_DECORATION_LIGHT: EntityLightSourceConfig = {
  color: '#ffad4f', flicker: 0.09, intensity: 1.08, radius: 500, offsetY: -8, verticalScale: 0.68,
}
const BUILDING_FIRE_LIGHT: EntityLightSourceConfig = {
  color: '#ff9d45', flicker: 0.12, intensity: 0.98, radius: 180, offsetY: -12, verticalScale: 0.72,
}

function getDecorationFlameProfile(type: string): { y: number; scale: number; light: EntityLightSourceConfig } | null {
  if (type === BUILDING_TYPES.fireCamp) return { y: -9, scale: 1, light: CAMPFIRE_DECORATION_LIGHT }
  if (type === BUILDING_TYPES.campBrazier) {
    return { y: -44, scale: 0.65, light: { ...CAMPFIRE_DECORATION_LIGHT, radius: 420, intensity: 0.8 } }
  }
  if (type === BUILDING_TYPES.campTorchStand) {
    return { y: -33, scale: 0.5, light: { ...CAMPFIRE_DECORATION_LIGHT, radius: 220, intensity: 0.7 } }
  }
  return null
}

function attachFireLight(sprite: LightedAnimatedSprite, config: EntityLightSourceConfig = BUILDING_FIRE_LIGHT): void {
  sprite.lightSource = config
}

function getBuildingFireFrames(variant: FireAnimation, sheetType: keyof typeof BUILDING_FIRE_TEXTURES): Texture[] {
  const sheet = Assets.cache.get(BUILDING_FIRE_TEXTURES[sheetType])
  if (!sheet?.textures) return []
  const frameOffset = BUILDING_FIRE_SHEETS[variant][sheetType === 'fire' ? 'fireStart' : 'smokeStart']
  const frames = getAnimationFrames(sheet.textures) as Texture[]
  return frames.slice(frameOffset, frameOffset + BUILDING_FIRE_ANIMATION_FRAME_COUNT)
}

export function hasBuildingFlameVisual(building: BuildingControllerHost): boolean {
  const container = getPixiBuildingContainer(building)
  return Boolean(container.getChildByLabel(CAMPFIRE_DECORATION_LABEL) || container.getChildByLabel(LABEL_TYPES.fire))
}

export function hasBuildingDamageFireVisual(building: BuildingControllerHost): boolean {
  return Boolean(getPixiBuildingContainer(building).getChildByLabel(LABEL_TYPES.fire))
}

export function hasBuildingCampfireDecorationVisual(building: BuildingControllerHost): boolean {
  return Boolean(getPixiBuildingContainer(building).getChildByLabel(CAMPFIRE_DECORATION_LABEL))
}

/** Returns whether a decoration was removed, is awaiting textures, or has live flames. */
export function syncBuildingCampfireDecorationVisual(
  building: BuildingControllerHost
): 'removed' | 'unavailable' | 'active' {
  const container = getPixiBuildingContainer(building)
  const existing = container.getChildByLabel(CAMPFIRE_DECORATION_LABEL)
  const existingSmoke = container.getChildByLabel(CAMPFIRE_SMOKE_DECORATION_LABEL)
  const profile = getDecorationFlameProfile(building.assetType || building.type)
  if (!profile) {
    existing?.destroy({ children: true })
    existingSmoke?.destroy({ children: true })
    return 'removed'
  }

  const fireTextures = getBuildingFireFrames('light', 'fire')
  const smokeTextures = getBuildingFireFrames('light', 'smoke')
  if (!fireTextures.length || !smokeTextures.length) return 'unavailable'
  const flameY = profile.y + (building.reliefLift ?? 0)

  if (existing instanceof AnimatedSprite) {
    existing.textures = fireTextures
    attachFireLight(existing as LightedAnimatedSprite, profile.light)
    existing.position.set(0, flameY)
    existing.scale.set(profile.scale)
    existing.gotoAndPlay(0)
  }
  if (existingSmoke instanceof AnimatedSprite) {
    existingSmoke.textures = smokeTextures
    existingSmoke.position.set(0, flameY)
    existingSmoke.scale.set(profile.scale)
    existingSmoke.gotoAndPlay(0)
  }
  if (!(existingSmoke instanceof AnimatedSprite)) {
    const smoke = new AnimatedSprite(smokeTextures)
    bindAnimatedSpriteToTicker(smoke, building.context.app)
    smoke.label = CAMPFIRE_SMOKE_DECORATION_LABEL
    smoke.eventMode = 'none'
    smoke.roundPixels = true
    smoke.position.set(0, flameY)
    smoke.scale.set(profile.scale)
    smoke.animationSpeed = 0.3
    smoke.gotoAndPlay(0)
    container.addChild(smoke)
  }
  if (!(existing instanceof AnimatedSprite)) {
    const fire = new AnimatedSprite(fireTextures) as LightedAnimatedSprite
    bindAnimatedSpriteToTicker(fire, building.context.app)
    fire.label = CAMPFIRE_DECORATION_LABEL
    attachFireLight(fire, profile.light)
    fire.eventMode = 'none'
    fire.roundPixels = true
    fire.position.set(0, flameY)
    fire.scale.set(profile.scale)
    fire.animationSpeed = 0.3
    fire.gotoAndPlay(0)
    container.addChild(fire)
  }
  return 'active'
}

export function generateBuildingFireVisual(building: BuildingControllerHost, fireState: FireAnimation): boolean {
  const container = getPixiBuildingContainer(building)
  const fireTextures = getBuildingFireFrames(fireState, 'fire')
  const smokeTextures = getBuildingFireFrames(fireState, 'smoke')
  if (!fireTextures.length || !smokeTextures.length) return false
  const fire = container.getChildByLabel(LABEL_TYPES.fire)
  if (fire) {
    for (const sprite of fire.children) {
      const child = sprite as LightedAnimatedSprite
      if (child.label === BUILDING_FIRE_SMOKE_LABEL) child.textures = smokeTextures
      else {
        child.textures = fireTextures
        attachFireLight(child)
      }
      child.play()
    }
    return true
  }

  const newFire = new Container()
  newFire.label = LABEL_TYPES.fire
  newFire.eventMode = 'none'
  for (const [x, y] of getBuildingFirePositions(building.size)) {
    const smokeSprite = new AnimatedSprite(smokeTextures)
    bindAnimatedSpriteToTicker(smokeSprite, building.context.app)
    smokeSprite.label = BUILDING_FIRE_SMOKE_LABEL
    smokeSprite.eventMode = 'none'
    smokeSprite.roundPixels = true
    smokeSprite.x = x
    smokeSprite.y = y + 16
    smokeSprite.animationSpeed = 0.3
    smokeSprite.play()
    newFire.addChild(smokeSprite)

    const spriteFire = new AnimatedSprite(fireTextures) as LightedAnimatedSprite
    bindAnimatedSpriteToTicker(spriteFire, building.context.app)
    attachFireLight(spriteFire)
    spriteFire.eventMode = 'none'
    spriteFire.roundPixels = true
    spriteFire.x = x
    spriteFire.y = y
    spriteFire.play()
    spriteFire.animationSpeed = 0.3
    newFire.addChild(spriteFire)
  }
  container.addChild(newFire)
  return true
}

export function clearBuildingDamageFireVisual(building: BuildingControllerHost): void {
  const container = getPixiBuildingContainer(building)
  const fire = container.getChildByLabel(LABEL_TYPES.fire)
  if (fire) container.removeChild(fire)
}

export function pauseBuildingVisuals(building: BuildingControllerHost): boolean {
  const container = getPixiBuildingContainer(building)
  const sprite = building.sprite
  const wasPlaying = Boolean(sprite instanceof AnimatedSprite && sprite.playing)
  if (wasPlaying && sprite instanceof AnimatedSprite) sprite.stop()
  const fire = container.getChildByLabel(LABEL_TYPES.fire)
  if (fire) fire.children.forEach(child => (child as AnimatedSprite).stop())
  const campfireDecoration = container.getChildByLabel(CAMPFIRE_DECORATION_LABEL) as AnimatedSprite | null
  campfireDecoration?.stop()
  const campfireSmoke = container.getChildByLabel(CAMPFIRE_SMOKE_DECORATION_LABEL) as AnimatedSprite | null
  campfireSmoke?.stop()
  const deco = container.getChildByLabel(LABEL_TYPES.deco) as { stop?: () => void } | null
  deco?.stop?.()
  return wasPlaying
}

export function resumeBuildingVisuals(building: BuildingControllerHost, spriteWasPlaying: boolean): void {
  const container = getPixiBuildingContainer(building)
  if (spriteWasPlaying && building.sprite instanceof AnimatedSprite) building.sprite.play()
  const fire = container.getChildByLabel(LABEL_TYPES.fire)
  if (fire) fire.children.forEach(child => (child as AnimatedSprite).play())
  const campfireDecoration = container.getChildByLabel(CAMPFIRE_DECORATION_LABEL) as AnimatedSprite | null
  campfireDecoration?.play()
  const campfireSmoke = container.getChildByLabel(CAMPFIRE_SMOKE_DECORATION_LABEL) as AnimatedSprite | null
  campfireSmoke?.play()
  const deco = container.getChildByLabel(LABEL_TYPES.deco) as { play?: () => void } | null
  deco?.play?.()
}

function getBuildingFirePositions(size: number): number[][] {
  const radius = getBuildingFootprintRadius(size)
  if (radius <= 0) return [[0, 0]]
  return [[0, -32 * radius], [-64 * radius, 0], [0, 32 * radius], [64 * radius, 0]]
}
