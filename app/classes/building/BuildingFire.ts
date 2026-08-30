import { AnimatedSprite, Assets, Container } from 'pixi.js'
import { sound, type IMediaInstance } from '@pixi/sound'
import { BUILDING_TYPES, LABEL_TYPES, SOUND_CUES } from '../../constants'
import {
  bindAnimatedSpriteToTicker,
  getAnimationFrames,
  getBuildingFootprintRadius,
  getHeroDistanceSoundVolume,
  playAudibleSoundCue,
} from '../../lib'
import type { EntityLightSourceConfig } from '../../types/entities'
import type { BuildingControllerHost } from './BuildingTypes'
import type { Texture } from 'pixi.js'

type LightedAnimatedSprite = AnimatedSprite & { lightSource?: EntityLightSourceConfig }
type RuntimeContainer = Container
type FlameTicker = { deltaMS?: number; elapsedMS?: number }

const BUILDING_FIRE_SHEETS = {
  light: { fireStart: 0, smokeStart: 0 },
  medium: { fireStart: 8, smokeStart: 8 },
  heavy: { fireStart: 16, smokeStart: 16 },
} as const

export const CAMPFIRE_DECORATION_LABEL = 'campfireDecorationFire'
export const CAMPFIRE_SMOKE_DECORATION_LABEL = 'campfireDecorationSmoke'
const BUILDING_FIRE_SMOKE_LABEL = 'buildingFireSmoke'
const BUILDING_FIRE_ANIMATION_FRAME_COUNT = 8
const BUILDING_FIRE_TEXTURES = {
  fire: 'effects/fire',
  smoke: 'effects/smoke',
} as const

export type FireAnimation = keyof typeof BUILDING_FIRE_SHEETS

const FLAME_SOUND_BASE_VOLUME = 0.62
const FLAME_SOUND_LERP_PER_SECOND = 7
const CAMPFIRE_DECORATION_X = 0
const CAMPFIRE_DECORATION_Y = -9
const CAMPFIRE_SMOKE_DECORATION_Y = 16

const CAMPFIRE_DECORATION_LIGHT: EntityLightSourceConfig = {
  color: '#ffad4f',
  flicker: 0.09,
  intensity: 1.08,
  radius: 220,
  offsetY: -8,
  verticalScale: 0.68,
}

const BUILDING_FIRE_LIGHT: EntityLightSourceConfig = {
  color: '#ff9d45',
  flicker: 0.12,
  intensity: 0.98,
  radius: 180,
  offsetY: -12,
  verticalScale: 0.72,
}

function attachFireLight(sprite: LightedAnimatedSprite, config: EntityLightSourceConfig = BUILDING_FIRE_LIGHT): void {
  sprite.lightSource = config
}

function lerp(current: number, target: number, amount: number): number {
  return current + (target - current) * Math.max(0, Math.min(1, amount))
}

function getFlameTargetVolume(building: BuildingControllerHost): number {
  if (building.context.paused || building.context.defeat || building.isDead || building.isDestroyed) return 0
  if (!building.context.controls.instanceIsAudible(building)) return 0
  return getHeroDistanceSoundVolume(building, 'flame', FLAME_SOUND_BASE_VOLUME)
}

function updateFlameSoundVolume(building: BuildingControllerHost, elapsedMs = 16.67): void {
  const loop = building.flameSoundLoop
  if (!loop) return
  const elapsedSeconds = Math.max(0, Math.min(elapsedMs, 250)) / 1000
  loop.volume = lerp(loop.volume, getFlameTargetVolume(building), elapsedSeconds * FLAME_SOUND_LERP_PER_SECOND)
}

function getBuildingFireFrames(variant: FireAnimation, sheetType: keyof typeof BUILDING_FIRE_TEXTURES): Texture[] {
  const sheet = Assets.cache.get(BUILDING_FIRE_TEXTURES[sheetType])
  if (!sheet?.textures) return []
  const frameOffset = BUILDING_FIRE_SHEETS[variant][sheetType === 'fire' ? 'fireStart' : 'smokeStart']
  const frames = getAnimationFrames(sheet.textures) as Texture[]
  return frames.slice(frameOffset, frameOffset + BUILDING_FIRE_ANIMATION_FRAME_COUNT)
}

export function hasBuildingFlameVisual(building: BuildingControllerHost): boolean {
  return Boolean(building.getChildByLabel(CAMPFIRE_DECORATION_LABEL) || building.getChildByLabel(LABEL_TYPES.fire))
}

export function startFlameAmbientSound(building: BuildingControllerHost): void {
  if (building.flameSoundLoop || building.flameSoundTicker || building.flameSoundStopped === false) return
  building.flameSoundStopped = false

  const onReady = (instance: IMediaInstance): void => {
    if (building.flameSoundStopped || building.isDead || building.isDestroyed || !hasBuildingFlameVisual(building)) {
      instance.stop()
      return
    }
    building.flameSoundLoop = instance
    instance.volume = getFlameTargetVolume(building)
  }

  const result = sound.play(SOUND_CUES.building.flame, { loop: true, volume: 0 })
  if (result instanceof Promise) result.then(onReady).catch(() => {})
  else onReady(result)

  building.flameSoundTicker = (ticker?: FlameTicker) => {
    updateFlameSoundVolume(building, ticker?.deltaMS ?? ticker?.elapsedMS)
  }
  building.context.app.ticker.add(building.flameSoundTicker)
}

export function stopFlameAmbientSound(building: BuildingControllerHost): void {
  building.flameSoundStopped = true
  if (building.flameSoundTicker) {
    building.context.app.ticker.remove(building.flameSoundTicker)
    building.flameSoundTicker = null
  }
  building.flameSoundLoop?.stop()
  building.flameSoundLoop = null
}

export function syncBuildingCampfireDecoration(building: BuildingControllerHost): void {
  const existing = building.getChildByLabel(CAMPFIRE_DECORATION_LABEL)
  const existingSmoke = building.getChildByLabel(CAMPFIRE_SMOKE_DECORATION_LABEL)

  if (building.type !== BUILDING_TYPES.fireCamp) {
    existing?.destroy({ children: true })
    existingSmoke?.destroy({ children: true })
    if (!building.getChildByLabel(LABEL_TYPES.fire)) stopFlameAmbientSound(building)
    return
  }

  const fireTextures = getBuildingFireFrames('light', 'fire')
  const smokeTextures = getBuildingFireFrames('light', 'smoke')
  if (!fireTextures.length || !smokeTextures.length) return

  if (existing instanceof AnimatedSprite) {
    existing.textures = fireTextures
    attachFireLight(existing as LightedAnimatedSprite, CAMPFIRE_DECORATION_LIGHT)
    existing.position.set(CAMPFIRE_DECORATION_X, CAMPFIRE_DECORATION_Y)
    existing.gotoAndPlay(0)
  }

  if (existingSmoke instanceof AnimatedSprite) {
    existingSmoke.textures = smokeTextures
    existingSmoke.position.set(CAMPFIRE_DECORATION_X, CAMPFIRE_SMOKE_DECORATION_Y)
    existingSmoke.gotoAndPlay(0)
  }

  if (!(existingSmoke instanceof AnimatedSprite)) {
    const smoke = new AnimatedSprite(smokeTextures)
    smoke.label = CAMPFIRE_SMOKE_DECORATION_LABEL
    smoke.eventMode = 'none'
    smoke.roundPixels = true
    smoke.position.set(CAMPFIRE_DECORATION_X, CAMPFIRE_SMOKE_DECORATION_Y)
    smoke.animationSpeed = 0.3
    smoke.gotoAndPlay(0)
    building.addChild(smoke)
  }

  if (!(existing instanceof AnimatedSprite)) {
    const fire = new AnimatedSprite(fireTextures) as LightedAnimatedSprite
    bindAnimatedSpriteToTicker(fire, building.context.app)
    fire.label = CAMPFIRE_DECORATION_LABEL
    attachFireLight(fire, CAMPFIRE_DECORATION_LIGHT)
    fire.eventMode = 'none'
    fire.roundPixels = true
    fire.position.set(CAMPFIRE_DECORATION_X, CAMPFIRE_DECORATION_Y)
    fire.animationSpeed = 0.3
    fire.gotoAndPlay(0)
    building.addChild(fire)
  }

  if (building.isBuilt) startFlameAmbientSound(building)
}

export function generateBuildingFire(building: BuildingControllerHost, fireState: FireAnimation): void {
  const fireTextures = getBuildingFireFrames(fireState, 'fire')
  const smokeTextures = getBuildingFireFrames(fireState, 'smoke')
  if (!fireTextures.length || !smokeTextures.length) return

  const fire = building.getChildByLabel(LABEL_TYPES.fire)

  if (fire) {
    for (let i = 0; i < fire.children.length; i++) {
      const child = fire.children[i] as LightedAnimatedSprite
      if (child.label === BUILDING_FIRE_SMOKE_LABEL) {
        child.textures = smokeTextures
      } else {
        child.textures = fireTextures
        attachFireLight(child)
      }
      child.play()
    }
    startFlameAmbientSound(building)
    return
  }

  const newFire = new Container() as RuntimeContainer
  newFire.label = LABEL_TYPES.fire
  newFire.eventMode = 'none'
  for (const [x, y] of getBuildingFirePositions(building.size)) {
    const smokeSprite = new AnimatedSprite(smokeTextures) as LightedAnimatedSprite
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
  building.addChild(newFire)
  startFlameAmbientSound(building)
}

export function updateBuildingFireDamage(building: BuildingControllerHost, percentage: number): void {
  if (percentage > 0 && percentage < 25) {
    building.context.unitRest?.evacuateUnitsIfShelterUnsafe(building)
    playBuildingBurningSound(building)
    building.generateFire('heavy')
  } else if (percentage >= 25 && percentage < 50) {
    playBuildingBurningSound(building)
    building.generateFire('medium')
  } else if (percentage >= 50 && percentage < 75) {
    playBuildingBurningSound(building)
    building.generateFire('light')
  } else if (percentage >= 75) {
    const fire = building.getChildByLabel(LABEL_TYPES.fire)
    if (fire) building.removeChild(fire)
    building.hasActiveBurningSound = false
    if (!building.getChildByLabel(CAMPFIRE_DECORATION_LABEL)) stopFlameAmbientSound(building)
  }
}

export function playBuildingBurningSound(building: BuildingControllerHost): void {
  if (building.hasActiveBurningSound) return
  const playedCue = playAudibleSoundCue(building, building.sounds?.burning ?? SOUND_CUES.building.burning, {
    profile: 'building',
  })
  if (playedCue) building.hasActiveBurningSound = true
}

function getBuildingFirePositions(size: number): number[][] {
  const radius = getBuildingFootprintRadius(size)
  if (radius <= 0) return [[0, 0]]
  return [
    [0, -32 * radius],
    [-64 * radius, 0],
    [0, 32 * radius],
    [64 * radius, 0],
  ]
}
