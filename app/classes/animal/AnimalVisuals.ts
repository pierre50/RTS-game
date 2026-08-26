import { AnimatedSprite } from 'pixi.js'
import { LABEL_TYPES, RELIEF_LIFT_SMOOTHING } from '../../constants'
import {
  bindAnimatedSpriteToTicker,
  getReliefLiftPixels,
  setSpriteFiltersPreservingDamageFeedback,
} from '../../lib'
import { getShadowsEnabled } from '../../lib/audio/settings'
import { recolorHorseTextures, type HorseColor } from '../../lib/horses/horseColors'
import type { Texture } from 'pixi.js'
import type { GameContextLike } from '../../types/context'
import type { InteractiveSprite } from '../../types/pixi'
import { FLYING_ALTITUDE } from './AnimalTypes'

type AnimalVisualHost = {
  altitude: number
  context: GameContextLike
  horseColor?: HorseColor
  isDestroyed: boolean
  reliefLift: number
  sprite: InteractiveSprite
  shadow: AnimatedSprite | null
  type: string
  visible: boolean
  x: number
  y: number
  syncSelectionMarkersToRelief(): void
  getChildByLabel(label: string): { position: { y: number } } | null
}

const SHADOW_MASK_ALPHA = 1
const SHADOW_SCALE_X = 1.05
const SHADOW_SCALE_Y = -0.42

export class AnimalVisuals {
  animal: AnimalVisualHost

  constructor(animal: AnimalVisualHost) {
    this.animal = animal
  }

  createShadow(): AnimatedSprite {
    const animal = this.animal
    const shadow = new AnimatedSprite(animal.sprite.textures as Texture[])
    bindAnimatedSpriteToTicker(shadow, animal.context.app)
    shadow.label = LABEL_TYPES.shadow
    shadow.eventMode = 'none'
    shadow.roundPixels = true
    shadow.tint = 0x000000
    shadow.alpha = SHADOW_MASK_ALPHA
    shadow.zIndex = -2
    this.syncShadow(shadow)
    return shadow
  }

  syncShadow(shadow = this.animal.shadow): void {
    const animal = this.animal
    if (!shadow || !animal.sprite) return
    const frame = Math.min(animal.sprite.currentFrame, Math.max(animal.sprite.textures.length - 1, 0))
    const altitudeFactor = 1 - (Math.min(animal.altitude ?? 0, FLYING_ALTITUDE) / FLYING_ALTITUDE) * 0.25
    shadow.textures = animal.sprite.textures
    shadow.animationSpeed = animal.sprite.animationSpeed
    shadow.loop = animal.sprite.loop
    shadow.anchor.set(animal.sprite.anchor.x, animal.sprite.anchor.y)
    shadow.alpha = SHADOW_MASK_ALPHA
    shadow.visible = Boolean(getShadowsEnabled() && animal.visible && !animal.isDestroyed)
    shadow.rotation = 0
    shadow.scale.x = animal.sprite.scale.x * SHADOW_SCALE_X * altitudeFactor
    shadow.scale.y = Math.abs(animal.sprite.scale.y) * SHADOW_SCALE_Y * altitudeFactor
    shadow.position.set(animal.x, animal.y + animal.reliefLift)
    if (animal.sprite.playing) {
      shadow.gotoAndPlay(frame)
    } else {
      shadow.gotoAndStop(frame)
    }
  }

  setAltitude(altitude: number): void {
    const animal = this.animal
    animal.altitude = altitude
    animal.sprite.position.y = -altitude + animal.reliefLift
    this.syncShadow()
  }

  applyReliefLift(level: number, immediate = false): void {
    const animal = this.animal
    const target = -getReliefLiftPixels(level)
    animal.reliefLift = immediate ? target : animal.reliefLift + (target - animal.reliefLift) * RELIEF_LIFT_SMOOTHING
    animal.sprite.position.y = -animal.altitude + animal.reliefLift
    this.syncShadow()
    animal.syncSelectionMarkersToRelief()
    const healthBar = animal.getChildByLabel(LABEL_TYPES.healthBar)
    if (healthBar) healthBar.position.y = animal.reliefLift
    const energyBar = animal.getChildByLabel(LABEL_TYPES.energyBar)
    if (energyBar) energyBar.position.y = animal.reliefLift
  }

  syncVisualSettings(): void {
    const animal = this.animal
    if (animal.shadow) {
      animal.shadow.visible = Boolean(getShadowsEnabled() && animal.visible && !animal.isDestroyed)
    }
  }

  afterSetTextures(): void {
    const animal = this.animal
    setSpriteFiltersPreservingDamageFeedback(animal.sprite, null)
    if (animal.type === 'Horse' && animal.horseColor) {
      animal.sprite.textures = recolorHorseTextures(animal.sprite.textures as Texture[], animal.horseColor)
    }
    this.syncShadow()
  }
}
