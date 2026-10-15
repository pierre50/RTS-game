import { sound, type IMediaInstance } from '@pixi/sound'
import { SOUND_CUES } from '../../constants'
import { getHeroDistanceSoundVolume, playAudibleSoundCue } from '../../lib'
import type { BuildingControllerHost } from './BuildingTypes'
import {
  CAMPFIRE_DECORATION_LABEL,
  CAMPFIRE_SMOKE_DECORATION_LABEL,
  clearBuildingDamageFireVisual,
  generateBuildingFireVisual,
  hasBuildingCampfireDecorationVisual,
  hasBuildingDamageFireVisual,
  hasBuildingFlameVisual,
  pauseBuildingVisuals,
  resumeBuildingVisuals,
  syncBuildingCampfireDecorationVisual,
  type FireAnimation,
} from '../../rendering/pixi/PixiBuildingFire'

export { CAMPFIRE_DECORATION_LABEL, CAMPFIRE_SMOKE_DECORATION_LABEL, hasBuildingFlameVisual }
export type { FireAnimation }
export { pauseBuildingVisuals, resumeBuildingVisuals }

type FlameTicker = { deltaMS?: number; elapsedMS?: number }
const FLAME_SOUND_BASE_VOLUME = 0.62
const FLAME_SOUND_LERP_PER_SECOND = 7

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
  const result = syncBuildingCampfireDecorationVisual(building)
  if (result === 'removed' && !hasBuildingDamageFireVisual(building)) stopFlameAmbientSound(building)
  if (result === 'active' && building.isBuilt) startFlameAmbientSound(building)
}

export function generateBuildingFire(building: BuildingControllerHost, fireState: FireAnimation): void {
  if (generateBuildingFireVisual(building, fireState)) startFlameAmbientSound(building)
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
    clearBuildingDamageFireVisual(building)
    building.hasActiveBurningSound = false
    if (!hasBuildingCampfireDecorationVisual(building)) stopFlameAmbientSound(building)
  }
}

export function playBuildingBurningSound(building: BuildingControllerHost): void {
  if (building.hasActiveBurningSound) return
  const playedCue = playAudibleSoundCue(building, building.sounds?.burning ?? SOUND_CUES.building.burning, {
    profile: 'building',
  })
  if (playedCue) building.hasActiveBurningSound = true
}
