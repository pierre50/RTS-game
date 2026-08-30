import { AnimatedSprite } from 'pixi.js'
import { LABEL_TYPES, RELIEF_LIFT_SMOOTHING, SHEET_TYPES } from '../../constants'
import {
  bindAnimatedSpriteToTicker,
  changeSpriteTexturesColorDirectly,
  getReliefLiftPixels,
  setSpriteFiltersPreservingDamageFeedback,
} from '../../lib'
import { getEntityMapPoint, isEntityInActiveMapSpace } from '../../lib/mapSpaces'
import { getShadowsEnabled } from '../../lib/audio/settings'
import { isSleepingFinalVisual } from '../../services/rest/UnitSleepVisuals'
import type { Texture } from 'pixi.js'
import type { UnitRuntimeHost } from './UnitTypes'

const SHADOW_MASK_ALPHA = 1
const SHADOW_SCALE_X = 1.05
const SHADOW_SCALE_Y = -0.42

function shouldShowUnitShadow(unit: UnitRuntimeHost): boolean {
  return Boolean(getShadowsEnabled() && unit.visible && !unit.isDestroyed && isEntityInActiveMapSpace(unit))
}

export function createUnitShadow(
  unit: UnitRuntimeHost,
  source: AnimatedSprite = unit.sprite,
  label: string = LABEL_TYPES.shadow
): AnimatedSprite {
  const shadow = new AnimatedSprite(source.textures as Texture[])
  bindAnimatedSpriteToTicker(shadow, unit.context.app)
  shadow.label = label
  shadow.eventMode = 'none'
  shadow.roundPixels = true
  shadow.tint = 0x000000
  shadow.alpha = SHADOW_MASK_ALPHA
  shadow.zIndex = -2
  unit.syncShadow(shadow, source)
  return shadow
}

export function syncUnitShadow(
  unit: UnitRuntimeHost,
  shadow = unit.shadow,
  source: AnimatedSprite | null = unit.sprite
): void {
  if (!shadow || !source) return
  const frame = Math.min(source.currentFrame, Math.max(source.textures.length - 1, 0))
  shadow.textures = source.textures
  shadow.animationSpeed = source.animationSpeed
  shadow.loop = source.loop
  shadow.anchor.set(source.anchor.x, source.anchor.y)
  shadow.alpha = SHADOW_MASK_ALPHA
  shadow.rotation = 0
  shadow.scale.x = source.scale.x * SHADOW_SCALE_X
  shadow.scale.y = Math.abs(source.scale.y) * SHADOW_SCALE_Y
  const point = getEntityMapPoint(unit)
  shadow.position.set(point.x + source.position.x, point.y + (unit.reliefLift ?? 0))
  if (source.playing) {
    shadow.gotoAndPlay(frame)
  } else {
    shadow.gotoAndStop(frame)
  }
  shadow.visible = shouldShowUnitShadow(unit) && !isSleepingFinalVisual(unit)
}

export function syncUnitVisualSettings(unit: UnitRuntimeHost): void {
  const visible = shouldShowUnitShadow(unit) && !isSleepingFinalVisual(unit)
  if (unit.shadow) {
    unit.shadow.visible = visible
  }
  if (unit.horseShadow) {
    unit.horseShadow.visible = visible
  }
}

export function applyUnitReliefLift(unit: UnitRuntimeHost, level: number, immediate = false): void {
  const target = -getReliefLiftPixels(level)
  unit.reliefLift = immediate ? target : unit.reliefLift + (target - unit.reliefLift) * RELIEF_LIFT_SMOOTHING
  unit.syncMountedRiderPosition()
  if (unit.horseSprite) unit.horseSprite.position.y = unit.reliefLift
  unit.syncShadow()
  unit.syncShadow(unit.horseShadow, unit.horseSprite)
  unit.syncSelectionMarkersToRelief()
  const healthBar = unit.getChildByLabel(LABEL_TYPES.healthBar)
  if (healthBar) healthBar.position.y = unit.getMountedRiderY()
  const powerBar = unit.getChildByLabel(LABEL_TYPES.powerBar)
  if (powerBar) powerBar.position.y = unit.getMountedRiderY()
  const energyBar = unit.getChildByLabel(LABEL_TYPES.energyBar)
  if (energyBar) energyBar.position.y = unit.getMountedRiderY()
}

export function applyUnitOwnerColorToSprite(unit: UnitRuntimeHost): void {
  if (!unit.sprite?.textures?.length) return

  const frame = unit.sprite.currentFrame
  const playing = unit.sprite.playing
  const textures = changeSpriteTexturesColorDirectly(unit.sprite.textures as Texture[], unit.owner.color ?? '')
  setSpriteFiltersPreservingDamageFeedback(unit.sprite, null)
  unit.sprite.textures = textures as Texture[]

  const restoredFrame = Math.min(frame, Math.max(textures.length - 1, 0))
  if (playing) {
    unit.sprite.gotoAndPlay(restoredFrame)
  } else {
    unit.sprite.gotoAndStop(restoredFrame)
  }
}

export function pauseUnitVisuals(unit: UnitRuntimeHost): void {
  unit.shadow?.stop()
  unit.horseSprite?.stop()
  unit.horseShadow?.stop()
  for (const sprite of unit.appearanceLayerSprites.values()) {
    sprite.stop()
  }
}

export function resumeUnitVisuals(unit: UnitRuntimeHost): boolean {
  // A sleeper frozen on its last "dying" frame must stay frozen — calling .play() here would
  // leave PIXI's own ticker to cycle the sheet forever if `sprite.loop` was left true by an
  // earlier walk (see freezeSleepingOutsideVisual).
  if (isSleepingFinalVisual(unit)) return true
  if (unit.currentSheet !== SHEET_TYPES.standing) return false
  unit.sprite.gotoAndStop(unit.sprite.currentFrame)
  unit.shadow?.gotoAndStop(unit.shadow.currentFrame)
  unit.horseSprite?.play()
  unit.horseShadow?.gotoAndStop(unit.horseShadow.currentFrame)
  for (const sprite of unit.appearanceLayerSprites.values()) {
    sprite.gotoAndStop(sprite.currentFrame)
  }
  return true
}
