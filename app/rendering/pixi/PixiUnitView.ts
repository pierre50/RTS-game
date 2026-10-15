import { AnimatedSprite, Container, type Texture } from 'pixi.js'
import { LABEL_TYPES, SHEET_TYPES } from '../../constants'
import { onSpriteLoopAtFrame } from '../../lib/graphics'
import { runAfterDeathFlash } from '../../lib/entities/deathFlash'
import { attachEntityShadowsToMapSpace, bindAnimatedSpriteToTicker, getAnimationFrames, getEntityCell, setUnitTexture } from '../../lib'
import type { UnitTextureInstance } from '../../lib'
import { onVisualSettingsChange } from '../../lib/audio/settings'
import { getEntitySpaceMapLike } from '../../lib/mapSpaces'
import { syncEntityRelief } from '../../lib/terrain/reliefSurface'
import { applyUnitActionFrameSequence, getUnitWorkActionSheet } from '../../lib/units/visuals/unitWorkAppearance'
import { applyUnitReliefLift } from '../../classes/unit/appearance/UnitVisualState'
import { pauseUnitVisuals, resumeUnitVisuals } from '../../classes/unit/appearance/UnitVisualState'
import type { Unit } from '../../classes/unit/Unit'
import type { UnitViewAdapter, UnitVisualState } from '../UnitView'
import type { AnimationSnapshot } from '../UnitAnimation'

const MAIN_SPRITE_LAYER_Z_INDEX = 10

/** Pixi implementation of the unit presentation; gameplay owns the state. */
export class PixiUnitView implements UnitViewAdapter {
  readonly container = new Container()

  constructor(
    private readonly unit: Unit,
    private readonly onInteract: (id: string) => void
  ) {}

  mount(state: UnitVisualState): void {
    const unit = this.unit
    const spawnCell = getEntityCell(unit, unit.context.map)
    if (!spawnCell) throw new Error(`Cannot display unit on missing cell (${unit.i}, ${unit.j})`)
    this.container.sortableChildren = true
    this.container.eventMode = 'static'
    this.container.label = unit.label
    Object.assign(this.container, { family: unit.family, runtimeEntity: unit, spaceId: unit.spaceId })
    applyUnitActionFrameSequence(unit, unit.work, unit.action)
    unit.actionSheet = unit.actionSheet || getUnitWorkActionSheet(unit, unit.work, unit.action)
    unit.sprite = new AnimatedSprite(
      getAnimationFrames((unit.standingSheet as { textures: Record<string, Texture> }).textures, 'south') as Texture[]
    )
    bindAnimatedSpriteToTicker(unit.sprite, unit.context.app)
    unit.sprite.label = LABEL_TYPES.sprite
    unit.sprite.eventMode = 'auto'
    unit.sprite.roundPixels = true
    unit.sprite.loop = unit.loop ?? true
    unit.sprite.zIndex = MAIN_SPRITE_LAYER_Z_INDEX
    unit.shadow = unit.createShadow()
    attachEntityShadowsToMapSpace(unit.context.map, unit)
    this.container.addChild(unit.sprite)
    unit.setupMountedHorseSprite()
    unit.visualSettingsCleanup = onVisualSettingsChange(() => unit.syncVisualSettings())
    if (unit.isDead) {
      unit.currentSheet === SHEET_TYPES.corpse ? unit.decompose() : unit.death()
    }
    unit.setTextures(unit.currentSheet)

    unit.sprite.currentFrame = Math.min(unit.currentFrame, unit.sprite.textures.length - 1)
    unit.syncShadow()
    unit.syncAppearanceLayers(unit.currentSheet)
    syncEntityRelief(getEntitySpaceMapLike(unit, unit.context.map), unit, spawnCell)
    unit.sprite.updateAnchor = true
    if (unit.shouldKeepHealthBarVisible()) {
      unit.drawHealthBar()
      unit.drawEnergyBar()
    }
    this.container.on('pointerup', () => this.onInteract(state.id))
  }

  update(state: UnitVisualState): void {
    const unit = this.unit
    this.container.position.set(state.position.x, state.position.y)
    this.container.zIndex = state.sortOrder
    this.container.visible = state.visible
    // Pixi draws elevation as a sprite offset. The 3D state keeps it as z.
    applyUnitReliefLift(unit, state.position.z)
  }

  setAction(action: string): void {
    const unit = this.unit
    setUnitTexture(action, unit as unknown as UnitTextureInstance)
    unit.applyOwnerColorToSprite()
    unit.syncShadow()
    unit.syncMountedHorseSprite()
    unit.syncAppearanceLayers(action)
    unit.updateMountedRiderMask(action)
  }

  isAnimationPlaying(): boolean {
    return Boolean(this.unit.sprite?.playing)
  }

  playAnimation(): void {
    this.unit.sprite?.play()
  }

  stopAnimation(): void {
    this.unit.sprite?.stop()
  }

  get currentFrame(): number { return this.unit.sprite?.currentFrame ?? 0 }
  get canSignalLoop(): boolean { return Boolean(this.unit.sprite) }
  get frameCount(): number { return this.unit.sprite?.textures.length ?? 0 }
  get playing(): boolean { return this.isAnimationPlaying() }
  captureSnapshot(): AnimationSnapshot {
    const sprite = this.unit.sprite
    return {
      frame: Math.max(0, Math.floor(sprite?.currentFrame ?? 0)),
      loop: sprite?.loop ?? true,
      playing: Boolean(sprite?.playing),
      callbacks: {
        onComplete: sprite?.onComplete,
        onFrameChange: sprite?.onFrameChange,
        onLoop: sprite?.onLoop,
      },
    }
  }
  clearCallbacks(): void {
    this.clearLoopCallback()
    this.clearFrameCallback()
  }
  clearCompleteCallback(): void { if (this.unit.sprite) this.unit.sprite.onComplete = undefined }
  clearFrameCallback(): void { if (this.unit.sprite) this.unit.sprite.onFrameChange = undefined }
  clearLoopCallback(): void { if (this.unit.sprite) this.unit.sprite.onLoop = undefined }
  onLoop(callback: () => void): void { if (this.unit.sprite) this.unit.sprite.onLoop = callback }
  onComplete(callback: () => void): void { if (this.unit.sprite) this.unit.sprite.onComplete = callback }
  onDeathComplete(callback: () => void): void {
    if (this.unit.sprite) this.unit.sprite.onComplete = runAfterDeathFlash(this.unit.sprite, callback)
  }
  onFrameEachLoop(frame: number, callback: () => void): void {
    if (this.unit.sprite) onSpriteLoopAtFrame(this.unit.sprite, frame, callback)
  }
  play(): void { this.playAnimation() }
  restart(): void { this.unit.sprite?.gotoAndPlay(0) }
  restoreCallbacks(snapshot: AnimationSnapshot): void {
    const sprite = this.unit.sprite
    if (!sprite) return
    sprite.onComplete = snapshot.callbacks.onComplete
    sprite.onFrameChange = snapshot.callbacks.onFrameChange
    sprite.onLoop = snapshot.callbacks.onLoop
  }
  seek(frame: number, play: boolean): void {
    if (play) this.unit.sprite?.gotoAndPlay(frame)
    else this.unit.sprite?.gotoAndStop(frame)
  }
  setLoop(loop: boolean): void { this.setAnimationLoop(loop) }
  setSpeed(speed: number): void { if (this.unit.sprite) this.unit.sprite.animationSpeed = speed }
  stop(): void { this.stopAnimation() }

  setAnimationLoop(loop: boolean): void {
    const unit = this.unit
    if (unit.sprite) unit.sprite.loop = loop
    if (unit.shadow) unit.shadow.loop = loop
    for (const sprite of unit.appearanceLayerSprites.values()) sprite.loop = loop
  }

  pause(): void {
    this.unit.playingBeforePause ??= this.isAnimationPlaying()
    this.stopAnimation()
    pauseUnitVisuals(this.unit)
  }

  resume(): void {
    const unit = this.unit
    if (resumeUnitVisuals(unit)) {
      unit.playingBeforePause = undefined
      return
    }
    if (unit.playingBeforePause !== false) this.playAnimation()
    else this.stopAnimation()
    unit.playingBeforePause = undefined
    for (const sprite of [unit.shadow, unit.horseSprite, unit.horseShadow]) {
      if (this.isAnimationPlaying()) sprite?.play()
      else sprite?.stop()
    }
    unit.syncAppearanceLayers(unit.currentSheet)
  }

  setSelected(selected: boolean): void {
    const unit = this.unit
    if (selected) {
      unit.drawHealthBar()
      unit.drawEnergyBar()
    } else if (unit.shouldKeepHealthBarVisible()) {
      unit.drawHealthBar()
      unit.drawEnergyBar()
    } else {
      unit.removeHealthBar()
      unit.removeEnergyBar()
    }
  }

  unmount(): void {
    const unit = this.unit
    unit.visualSettingsCleanup?.()
    unit.visualSettingsCleanup = null
    unit.shadow?.parent?.removeChild(unit.shadow)
    unit.shadow?.destroy({ children: true, texture: false })
    unit.shadow = null
    unit.removeMountedHorseSprite()
  }
}
