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
  light: 'effects/fire/light',
  medium: 'effects/fire/medium',
  heavy: 'effects/fire/heavy',
} as const

export const CAMPFIRE_DECORATION_LABEL = 'campfireDecorationFire'
const FLAME_SOUND_BASE_VOLUME = 0.62
const FLAME_SOUND_LERP_PER_SECOND = 7
const CAMPFIRE_DECORATION_X = 0
const CAMPFIRE_DECORATION_Y = -9

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

  if (building.type !== BUILDING_TYPES.fireCamp) {
    existing?.destroy({ children: true })
    if (!building.getChildByLabel(LABEL_TYPES.fire)) stopFlameAmbientSound(building)
    return
  }

  const spritesheetFire = Assets.cache.get(BUILDING_FIRE_SHEETS.light)
  if (!spritesheetFire?.textures) return
  const textures = getAnimationFrames(spritesheetFire.textures) as Texture[]
  if (!textures.length) return

  if (existing instanceof AnimatedSprite) {
    existing.textures = textures
    attachFireLight(existing as LightedAnimatedSprite, CAMPFIRE_DECORATION_LIGHT)
    existing.position.set(CAMPFIRE_DECORATION_X, CAMPFIRE_DECORATION_Y)
    existing.gotoAndPlay(0)
    if (building.isBuilt) startFlameAmbientSound(building)
    return
  }

  existing?.destroy({ children: true })
  const fire = new AnimatedSprite(textures) as LightedAnimatedSprite
  bindAnimatedSpriteToTicker(fire, building.context.app)
  fire.label = CAMPFIRE_DECORATION_LABEL
  attachFireLight(fire, CAMPFIRE_DECORATION_LIGHT)
  fire.eventMode = 'none'
  fire.roundPixels = true
  fire.position.set(CAMPFIRE_DECORATION_X, CAMPFIRE_DECORATION_Y)
  fire.animationSpeed = 0.3
  fire.gotoAndPlay(0)
  building.addChild(fire)
  if (building.isBuilt) startFlameAmbientSound(building)
}

export function generateBuildingFire(building: BuildingControllerHost, spriteId: string): void {
  const fire = building.getChildByLabel(LABEL_TYPES.fire)
  const spritesheetFire = Assets.cache.get(spriteId)
  const textures = getAnimationFrames(spritesheetFire.textures) as Texture[]

  if (fire) {
    for (let i = 0; i < fire.children.length; i++) {
      const child = fire.children[i] as LightedAnimatedSprite
      child.textures = textures
      attachFireLight(child)
      child.play()
    }
    startFlameAmbientSound(building)
    return
  }

  const newFire = new Container() as RuntimeContainer
  newFire.label = LABEL_TYPES.fire
  newFire.eventMode = 'none'
  for (const [x, y] of getBuildingFirePositions(building.size)) {
    const spriteFire = new AnimatedSprite(textures) as LightedAnimatedSprite
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
    building.context.villagerShelter?.evacuateVillagersIfShelterUnsafe(building)
    playBuildingBurningSound(building)
    building.generateFire(BUILDING_FIRE_SHEETS.heavy)
  } else if (percentage >= 25 && percentage < 50) {
    playBuildingBurningSound(building)
    building.generateFire(BUILDING_FIRE_SHEETS.medium)
  } else if (percentage >= 50 && percentage < 75) {
    playBuildingBurningSound(building)
    building.generateFire(BUILDING_FIRE_SHEETS.light)
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
