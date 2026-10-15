import { AnimatedSprite, Assets, Container, type Texture } from 'pixi.js'
import { ACTION_TYPES, LABEL_TYPES, SHEET_TYPES } from '../../constants'
import { attachEntityShadowsToMapSpace, bindAnimatedSpriteToTicker, getAnimationFrames, setUnitTexture } from '../../lib'
import type { UnitTextureInstance } from '../../lib'
import { onVisualSettingsChange } from '../../lib/audio/settings'
import { getAnimalRenderBounds } from '../../classes/animal/AnimalRenderBounds'
import type { Animal } from '../../classes/animal/Animal'
import type { InteractiveSprite, SpritesheetLike } from '../../types/pixi'
import type { UnitEntity } from '../../types/entities'
import { getUnitAnimation, type UnitAnimation } from '../UnitAnimation'
import { AnimalVisuals } from './PixiAnimalVisuals'

export function getCachedAnimalSpritesheet(id: string): SpritesheetLike | undefined {
  return Assets.cache.has(id) ? (Assets.cache.get(id) as SpritesheetLike | undefined) : undefined
}

/** Owns lazy Pixi sprites while the animal keeps its simulation state. */
export class PixiAnimalView {
  readonly container = new Container()
  readonly visuals: AnimalVisuals
  private renderSprite?: InteractiveSprite
  private ready = false
  private movementAnimationPlaying = true

  constructor(private readonly animal: Animal) {
    this.visuals = new AnimalVisuals(animal)
  }

  markReady(): void {
    const animal = this.animal
    this.container.label = animal.label
    this.container.eventMode = 'static'
    Object.assign(this.container, { family: animal.family, runtimeEntity: animal, spaceId: animal.spaceId })
    this.ready = true
  }
  get isReady(): boolean { return this.ready }
  get sprite(): InteractiveSprite | undefined { return this.renderSprite }
  get animation(): UnitAnimation {
    const animation = getUnitAnimation({ sprite: this.ensure(), shadow: this.animal.shadow } as UnitEntity)
    if (!animation) throw new Error('Cannot animate an animal without visuals')
    return animation
  }

  get deferredBounds() {
    const animal = this.animal
    if (this.renderSprite || !this.ready) return undefined
    const sheet =
      animal.currentSheet === SHEET_TYPES.flying
        ? animal.flyingSheet
        : animal.currentSheet === SHEET_TYPES.running
          ? animal.runningSheet
          : animal.currentSheet === SHEET_TYPES.standing
            ? animal.standingSheet
            : animal.walkingSheet
    return getAnimalRenderBounds(sheet ?? animal.walkingSheet, animal.spriteScale ?? 1)
  }

  getMovementPlaying(): boolean {
    return this.renderSprite?.playing ?? this.movementAnimationPlaying
  }

  setMovementPlaying(playing: boolean): void {
    this.movementAnimationPlaying = playing
    if (playing) this.renderSprite?.play()
    else this.renderSprite?.stop()
  }

  ensure(): InteractiveSprite {
    const animal = this.animal
    if (this.renderSprite) return this.renderSprite
    if (animal.isDestroyed) throw new Error('Cannot create visuals for a destroyed animal')
    const initialSheet = animal.standingSheet ?? animal.walkingSheet
    const sprite = new AnimatedSprite(getAnimationFrames(initialSheet.textures, 'south') as Texture[])
    this.renderSprite = sprite
    bindAnimatedSpriteToTicker(sprite, animal.context.app)
    sprite.label = LABEL_TYPES.sprite
    sprite.eventMode = 'auto'
    sprite.roundPixels = true
    sprite.loop = animal.loop ?? true
    sprite.updateAnchor = true
    this.container.addChild(sprite)
    setUnitTexture(animal.currentSheet, animal as unknown as UnitTextureInstance)
    this.visuals.afterSetTextures()
    sprite.currentFrame = Math.min(animal.currentFrame, sprite.textures.length - 1)
    sprite.position.y = -animal.altitude + animal.reliefLift
    if (!this.movementAnimationPlaying) sprite.stop()
    animal.shadow = animal.createShadow()
    attachEntityShadowsToMapSpace(animal.context.map, animal)
    animal.visualSettingsCleanup = onVisualSettingsChange(() => animal.syncVisualSettings())
    return sprite
  }

  release(): void {
    const animal = this.animal
    const sprite = this.renderSprite
    // Combat and death callbacks remain animation clocks until simulation owns them.
    if (
      !sprite ||
      animal.isDead ||
      animal.selected ||
      animal.action === ACTION_TYPES.attack ||
      sprite.onComplete ||
      sprite.onLoop ||
      sprite.onFrameChange
    ) return
    animal.currentFrame = sprite.currentFrame
    animal.loop = sprite.loop
    this.movementAnimationPlaying = animal.playingBeforePause ?? sprite.playing
    animal.visualSettingsCleanup?.()
    animal.visualSettingsCleanup = null
    animal.shadow?.parent?.removeChild(animal.shadow)
    animal.shadow?.destroy({ children: true, texture: false })
    animal.shadow = null
    sprite.parent?.removeChild(sprite)
    sprite.destroy({ children: true, texture: false })
    this.renderSprite = undefined
  }

  setTextures(sheet: string): void {
    const animal = this.animal
    if (!this.renderSprite && !animal.visible && !animal.isDead) {
      if (animal.currentSheet !== sheet) animal.currentFrame = 0
      animal.currentSheet = sheet
      this.movementAnimationPlaying = true
      return
    }
    this.ensure()
    setUnitTexture(sheet, animal as unknown as UnitTextureInstance)
    this.visuals.afterSetTextures()
  }

  clearReference(): void { this.renderSprite = undefined }
}
